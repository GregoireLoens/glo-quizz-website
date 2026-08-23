/* E2E des retours utilisateurs : filtres/recherche en haut de l'accueil,
   restriction de thèmes en mode aléatoire, thème affiché sur chaque question. */
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR || '/work';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, token, body) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + (await r.text()));
  return r.json();
}

async function openAs(browser, session, url, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (e) => console.log(`[${tag}] pageerror`, e.message));
  await page.evaluateOnNewDocument((auth) => {
    localStorage.setItem('midi-quizz-auth', JSON.stringify({ state: { token: auth.token, user: auth.user }, version: 0 }));
    addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = '*{animation:none!important;transition:none!important;filter:none!important}';
      document.head.appendChild(s);
    });
  }, session);
  await page.goto(url, { waitUntil: 'networkidle2' });
  return page;
}

async function waitForText(page, needle, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const t = await page.evaluate(() => document.body.innerText);
    if (t.toLowerCase().includes(needle.toLowerCase())) return;
    await sleep(300);
  }
  throw new Error('timeout en attendant « ' + needle + ' »');
}

// clique le bouton dont le texte correspond exactement (insensible à la casse)
async function clickButton(page, label) {
  const ok = await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.innerText.trim().toLowerCase() === needle.toLowerCase() && !b.disabled,
    );
    if (btn) btn.click();
    return Boolean(btn);
  }, label);
  if (!ok) throw new Error('bouton « ' + label + ' » introuvable ou désactivé');
}

(async () => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const host = await api('/api/auth/register', null, { username: 'E2Et-' + suffix });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    // --- 1. accueil : recherche + filtres au-dessus de la grille ---
    const pHome = await openAs(browser, host, BASE + '/', 'accueil');
    await waitForText(pHome, 'quizz populaires');
    const layout = await pHome.evaluate(() => {
      const search = document.querySelector('input[type="search"]');
      const tous = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Tous');
      const play = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.trim().toLowerCase() === 'jouer',
      );
      const card = play ? play.closest('div.bg-card') : null;
      return {
        hasSearch: Boolean(search),
        filtersAboveGrid:
          tous && card ? tous.getBoundingClientRect().top < card.getBoundingClientRect().top : false,
      };
    });
    if (!layout.hasSearch) throw new Error('barre de recherche absente de l’accueil');
    if (!layout.filtersAboveGrid) throw new Error('les filtres ne sont pas au-dessus de la grille');
    console.log('accueil : recherche présente, filtres au-dessus de la grille ✓');

    await pHome.type('input[type="search"]', 'pokemon');
    await sleep(900); // debounce 250 ms + requête
    const titles = await pHome.evaluate(() =>
      [...document.querySelectorAll('div.bg-card span')]
        .filter((s) => s.className.includes('font-display'))
        .map((s) => s.innerText.trim()),
    );
    if (!titles.some((t) => t.toLowerCase().includes('pokemon'))) {
      throw new Error('recherche « pokemon » : aucun résultat Pokemon (' + JSON.stringify(titles) + ')');
    }
    console.log('recherche « pokemon » →', JSON.stringify(titles), '✓');
    await pHome.screenshot({ path: SHOTS + '/theme-1-accueil-recherche.png' });

    // --- 2. lobby aléatoire : restriction des thèmes ---
    const { code } = await api('/api/games', host.token, { random: true });
    const pLobby = await openAs(browser, host, `${BASE}/game/${code}`, 'lobby');
    await waitForText(pLobby, 'thèmes des questions');
    await waitForText(pLobby, 'tous les thèmes');
    await clickButton(pLobby, 'Jeux vidéo');
    await waitForText(pLobby, '1 thème');
    console.log('lobby : restriction à « Jeux vidéo » appliquée ✓');
    await pLobby.screenshot({ path: SHOTS + '/theme-2-lobby-selection.png' });

    // --- 3. en partie : pilule du thème (titre du quiz d'origine) ---
    const allowed = (await api('/api/quizzes?category=' + encodeURIComponent('Jeux vidéo') + '&limit=50'))
      .map((q) => q.title.toLowerCase());
    const launched = await pLobby.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.toLowerCase().includes('lancer la partie') && !b.disabled,
      );
      if (btn) btn.click();
      return Boolean(btn);
    });
    if (!launched) throw new Error('bouton « Lancer la partie » introuvable ou désactivé');;
    await waitForText(pLobby, 'question 1');
    const theme = await pLobby.evaluate(() => {
      const el = [...document.querySelectorAll('span')].find((s) => s.innerText.trim().startsWith('🎯'));
      return el ? el.innerText.replace('🎯', '').trim() : null;
    });
    if (!theme) throw new Error('pilule du thème absente pendant la question');
    if (!allowed.includes(theme.toLowerCase())) {
      throw new Error('thème « ' + theme + ' » hors de la catégorie choisie (' + allowed.join(', ') + ')');
    }
    console.log('question : thème affiché « ' + theme + ' », bien dans « Jeux vidéo » ✓');
    await pLobby.screenshot({ path: SHOTS + '/theme-3-question-theme.png' });

    console.log('E2E thèmes : OK');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('ÉCHEC E2E thèmes :', e.message);
  process.exit(1);
});
