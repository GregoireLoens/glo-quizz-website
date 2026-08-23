/* Recette principale : quatre joueurs, deux manches (Mix puis quiz classique),
   les quatre jokers, reconnexion, clavier, classement, Elo, profil et rejeu. */
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR || '/work';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, token, body) {
  const response = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${await response.text()}`);
  return response.json();
}

async function openAs(browser, session, url, tag, mobile = false) {
  const page = await browser.newPage();
  await page.setViewport(mobile
    ? { width: 390, height: 844, isMobile: true, hasTouch: true }
    : { width: 1280, height: 900 });
  page.on('pageerror', (error) => console.log(`[${tag}] pageerror`, error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[${tag}] console`, message.text());
  });
  await page.evaluateOnNewDocument((auth) => {
    localStorage.setItem('midi-quizz-auth', JSON.stringify({ state: { token: auth.token, user: auth.user }, version: 0 }));
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*{animation:none!important;transition:none!important;filter:none!important}';
      document.head.appendChild(style);
    });
  }, session);
  await page.goto(url, { waitUntil: 'networkidle2' });
  return page;
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitForText(page, needle, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const body = await text(page);
    if (body.toLowerCase().includes(needle.toLowerCase())) return body;
    await sleep(250);
  }
  throw new Error(`timeout en attendant « ${needle} »`);
}

async function clickButton(page, label, { startsWith = false } = {}) {
  const clicked = await page.evaluate(({ needle, prefix }) => {
    const normalize = (value) => value.trim().toLowerCase();
    const button = [...document.querySelectorAll('button')].find((candidate) => {
      if (candidate.disabled) return false;
      const value = normalize(candidate.innerText);
      return prefix ? value.startsWith(normalize(needle)) : value === normalize(needle);
    });
    button?.click();
    return Boolean(button);
  }, { needle: label, prefix: startsWith });
  if (!clicked) throw new Error(`bouton « ${label} » introuvable ou désactivé`);
}

async function clickButtonContaining(page, label) {
  const clicked = await page.evaluate((needle) => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => !candidate.disabled && candidate.innerText.toLowerCase().includes(needle.toLowerCase()),
    );
    button?.click();
    return Boolean(button);
  }, label);
  if (!clicked) throw new Error(`bouton contenant « ${label} » introuvable ou désactivé`);
}

async function joinThroughUi(page, code) {
  await waitForText(page, 'Rejoindre une partie');
  await page.type('input', ` ${code.toLowerCase().slice(0, 3)}-${code.toLowerCase().slice(3)} `);
  await clickButton(page, 'Rejoindre', { startsWith: true });
  await waitForText(page, 'Code du salon');
}

async function submitAnswer(page, keyboard = false) {
  if (keyboard) {
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    return;
  }
  const selected = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button')].filter(
      (button) => !button.disabled && /^[ABCD]\n/.test(button.innerText),
    );
    cards[0]?.click();
    return cards.length > 0;
  });
  if (!selected) return; // joueur déjà verrouillé après une reconnexion
  await clickButton(page, 'Valider →');
}

async function playJoker(page, label, target) {
  const clicked = await page.evaluate((name) => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(
      (candidate) => !candidate.disabled && candidate.getAttribute('aria-label')?.startsWith(name),
    );
    button?.click();
    return Boolean(button);
  }, label);
  if (!clicked) throw new Error(`joker « ${label} » introuvable ou désactivé`);
  if (!target) return;
  await waitForText(page, 'Braquer qui ?');
  const picked = await page.evaluate((name) => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => !candidate.disabled && candidate.innerText.toLowerCase().includes(name.toLowerCase()),
    );
    button?.click();
    return Boolean(button);
  }, target);
  if (!picked) throw new Error(`cible « ${target} » introuvable`);
}

async function waitQuestion(pages, number) {
  await Promise.all(pages.map((page) => waitForText(page, `Question ${number}`)));
}

async function waitReveal(pages, number) {
  await Promise.all(pages.map((page) => waitForText(page, `Classement après la question ${number}`)));
}

async function answerRound(pages, number, keyboardIndex = -1) {
  await waitQuestion(pages, number);
  await Promise.all(pages.map((page, index) => submitAnswer(page, index === keyboardIndex)));
  await waitReveal(pages, number);
}

async function assertNoHorizontalOverflow(page, where) {
  const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (size.scrollWidth > size.width) throw new Error(`${where} déborde horizontalement : ${size.scrollWidth} > ${size.width}`);
}

(async () => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const sessions = await Promise.all(['A', 'B', 'C', 'D'].map((letter) =>
    api('/api/auth/register', null, { username: `Q4${letter}-${suffix}` })));
  const names = sessions.map((session) => session.user.username);
  if (sessions.some((session) => !/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(session.code))) {
    throw new Error('un code utilisateur ne respecte pas le format XXXX-XXXX');
  }
  const { code } = await api('/api/games', sessions[0].token, { random: true });
  const classicQuiz = (await api('/api/quizzes?limit=1'))[0];
  console.log('salon à quatre :', code, '—', names.join(', '));

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    // Page publique des règles, y compris à 390 px.
    const rules = await openAs(browser, sessions[3], `${BASE}/jokers`, 'règles', true);
    const rulesText = await waitForText(rules, 'Quatre jokers par joueur');
    for (const label of ['Moitié-moitié', 'Double ou rien', 'Braquage', 'Bouclier']) {
      if (!rulesText.toLowerCase().includes(label.toLowerCase())) throw new Error(`${label} absent de /jokers`);
    }
    await assertNoHorizontalOverflow(rules, 'page /jokers mobile');
    await rules.close();

    // L'hôte arrive directement ; les invités passent par le vrai formulaire de code.
    const pages = [await openAs(browser, sessions[0], `${BASE}/game/${code}`, 'A')];
    await waitForText(pages[0], 'Code du salon');
    for (let index = 1; index < 4; index += 1) {
      const page = await openAs(browser, sessions[index], `${BASE}/join`, names[index], index === 3);
      await joinThroughUi(page, code);
      pages.push(page);
    }
    await Promise.all(pages.map((page) => waitForText(page, '4 joueurs')));
    const lobby = await text(pages[0]);
    for (const name of names) if (!lobby.toLowerCase().includes(name.toLowerCase())) throw new Error(`${name} absent du lobby`);
    await assertNoHorizontalOverflow(pages[3], 'lobby mobile à quatre');

    // Prêt invité, paramètres propagés, puis retour Avec jokers.
    await clickButton(pages[1], 'Je suis prêt !');
    await waitForText(pages[0], 'Prêt');
    await clickButton(pages[0], '5');
    await clickButton(pages[0], '15s');
    await clickButton(pages[0], 'Sans');
    await waitForText(pages[2], 'Sans');
    await clickButton(pages[0], 'Avec');
    await waitForText(pages[2], 'Avec');
    console.log('lobby : 4 joueurs, formulaire de code, prêt et réglages propagés ✓');

    await clickButton(pages[0], 'Lancer la partie');
    await waitQuestion(pages, 1);
    for (const page of pages) {
      const count = await page.evaluate(() => document.querySelectorAll('button[aria-label*="joker" i], button[aria-label^="Moitié-moitié"], button[aria-label^="Double ou rien"], button[aria-label^="Braquage"], button[aria-label^="Bouclier"]').length);
      if (count < 4) throw new Error(`barre de jokers incomplète (${count}/4)`);
    }

    // Les quatre effets sur la même question : le bouclier rend le résultat du braquage déterministe.
    await playJoker(pages[0], 'Moitié-moitié');
    await playJoker(pages[1], 'Double ou rien');
    await playJoker(pages[2], 'Bouclier');
    await playJoker(pages[3], 'Braquage', names[2]);
    await waitForText(pages[0], '— écartée —');
    const cuts = (await text(pages[0])).match(/— écartée —/gi) || [];
    if (cuts.length !== 2) throw new Error(`Moitié-moitié n'écarte pas deux réponses (${cuts.length})`);
    await Promise.all(pages.map((page) => submitAnswer(page)));
    await waitReveal(pages, 1);
    if (!/pari (tenu|perdu)/i.test(await text(pages[1]))) throw new Error('résultat du Double ou rien absent');
    if (!/bouclier tenu/i.test(await text(pages[2]))) throw new Error('bouclier non annoncé au décompte');
    if (!/braquage bloqué/i.test(await text(pages[3]))) throw new Error('braquage bloqué non annoncé');
    console.log('question 1 : quatre jokers et classement intermédiaire ✓');

    // Les grilles doivent contenir les mêmes réponses, dans au moins deux ordres distincts.
    await waitQuestion(pages, 2);
    const grids = await Promise.all(pages.map((page) => page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((button) => /^[ABCD]\n/.test(button.innerText))
        .map((button) => button.innerText.split('\n').slice(1).join(' ').trim()))));
    const canonical = JSON.stringify([...grids[0]].sort());
    if (grids.some((grid) => JSON.stringify([...grid].sort()) !== canonical)) throw new Error('les joueurs ne reçoivent pas les mêmes propositions');
    if (new Set(grids.map(JSON.stringify)).size < 2) throw new Error('les quatre joueurs ont reçu le même ordre de réponses');

    // Réponse + joker survivent à un rechargement en pleine question.
    await playJoker(pages[0], 'Double ou rien');
    await submitAnswer(pages[0]);
    await pages[0].reload({ waitUntil: 'networkidle2' });
    await waitForText(pages[0], 'Question 2');
    await waitForText(pages[0], 'Réponse envoyée');
    await Promise.all(pages.slice(1).map((page) => submitAnswer(page)));
    await waitReveal(pages, 2);
    console.log('question 2 : ordres personnalisés et reconnexion avec réponse restaurée ✓');

    await answerRound(pages, 3, 1); // A puis Entrée côté joueur B
    await answerRound(pages, 4);
    await answerRound(pages, 5);
    await Promise.all(pages.map((page) => waitForText(page, 'remporte la partie', 15000)));
    const firstPodium = await text(pages[0]);
    for (const name of names) if (!firstPodium.toLowerCase().includes(name.toLowerCase())) throw new Error(`${name} absent du premier podium`);
    if ((firstPodium.match(/[+-]\d+|±0/g) || []).length < 4) throw new Error('variations Elo incomplètes au podium à quatre');
    await pages[3].screenshot({ path: `${SHOTS}/e2e-4-podium-mobile.png` });
    await assertNoHorizontalOverflow(pages[3], 'podium mobile à quatre');
    console.log('première manche Mix : podium à quatre et Elo ✓');

    // Rejouer garde le salon, puis deuxième manche classique sans jokers.
    await clickButton(pages[0], 'Rejouer');
    await Promise.all(pages.map((page) => waitForText(page, 'Code du salon')));
    await clickButton(pages[0], 'Mix aléatoire', { startsWith: true });
    // Le bouton courant ouvre le picker ; attendre le quiz avant de le choisir.
    await waitForText(pages[0], classicQuiz.title);
    await clickButtonContaining(pages[0], classicQuiz.title);
    await Promise.all(pages.map((page) => waitForText(page, classicQuiz.title)));
    await clickButton(pages[0], 'Sans');
    await waitForText(pages[3], 'Sans');
    await clickButton(pages[0], 'Lancer la partie');
    await waitQuestion(pages, 1);
    const jokerButtons = await pages[0].evaluate(() => document.querySelectorAll('button[aria-label^="Moitié-moitié"], button[aria-label^="Double ou rien"], button[aria-label^="Braquage"], button[aria-label^="Bouclier"]').length);
    if (jokerButtons !== 0) throw new Error('barre de jokers présente malgré le réglage Sans');
    await Promise.all(pages.map((page) => submitAnswer(page)));
    await waitReveal(pages, 1);
    for (let number = 2; number <= 5; number += 1) await answerRound(pages, number);
    await Promise.all(pages.map((page) => waitForText(page, 'remporte la partie', 15000)));
    console.log('deuxième manche classique sans jokers : podium à quatre ✓');

    const profile = await api('/api/me', sessions[0].token);
    if (profile.stats.games !== 2 || profile.stats.ratedGames !== 2 || profile.games.length < 2) {
      throw new Error(`profil incohérent après deux manches : ${JSON.stringify(profile.stats)}`);
    }
    const profilePage = await openAs(browser, sessions[0], `${BASE}/me`, 'profil');
    const profileText = await waitForText(profilePage, 'Dernières parties');
    if (!profileText.toLowerCase().includes(names[0].toLowerCase())) throw new Error('identité absente du profil');
    console.log('profil : 2 parties classées et historique persistant ✓');

    // Connexion par pseudo + code unique dans une page sans session préchargée.
    const login = await browser.newPage();
    await login.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await login.evaluateOnNewDocument(() => localStorage.clear());
    await login.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    const inputs = await login.$$('input');
    await inputs[0].type(names[0]);
    await inputs[1].type(sessions[0].code.toLowerCase().replace('-', ' '));
    await clickButton(login, 'Se connecter', { startsWith: true });
    await waitForText(login, 'Lance un quizz');
    await assertNoHorizontalOverflow(login, 'accueil après connexion mobile');
    console.log('connexion par pseudo + code normalisé ✓');

    console.log('E2E quatre joueurs : OK');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error('E2E 4 JOUEURS ÉCHEC :', error.message);
  process.exit(1);
});
