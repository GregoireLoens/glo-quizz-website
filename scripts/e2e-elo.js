/* E2E classement Elo : une partie à 2 (classée) puis une partie solo (non classée),
   et vérification du classement général. */
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, token, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + (await r.text()));
  return r.json();
}

async function openAs(browser, session, url, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') console.log(`[${tag}]`, m.type(), m.text());
  });
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
    if (t.toLowerCase().includes(needle.toLowerCase())) return t;
    await sleep(300);
  }
  throw new Error('timeout en attendant « ' + needle + ' »');
}

/** Joue jusqu'au podium en cliquant carte puis « Valider → » sur chaque page. */
async function playToPodium(pages, budgetMs = 240000) {
  const t0 = Date.now();
  const lead = pages[0];
  while (Date.now() - t0 < budgetMs) {
    const done = await lead.evaluate(() =>
      /remporte la partie|survit à la partie/i.test(document.body.innerText),
    );
    if (done) return Math.round((Date.now() - t0) / 1000);
    for (const p of pages) {
      await p.evaluate(() => {
        const cards = [...document.querySelectorAll('button')].filter(
          (b) => !b.disabled && /^[ABCD]\n/.test(b.innerText),
        );
        if (cards.length === 4) cards[Math.floor(Math.random() * 4)].click();
        const valider = [...document.querySelectorAll('button')].find(
          (b) => /valider/i.test(b.innerText) && !b.disabled,
        );
        if (valider) valider.click();
      });
    }
    await sleep(400);
  }
  throw new Error('budget épuisé sans podium');
}

(async () => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const host = await api('/api/auth/register', null, { username: 'EloA-' + suffix });
  const guest = await api('/api/auth/register', null, { username: 'EloB-' + suffix });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    // ---------- 1. partie à 2 joueurs : classée ----------
    const { code } = await api('/api/games', host.token, { random: true });
    console.log('partie à 2 :', code);
    const pHost = await openAs(browser, host, `${BASE}/game/${code}`, 'hôte');
    await waitForText(pHost, 'mix aléatoire');
    const pGuest = await openAs(browser, guest, `${BASE}/game/${code}`, 'invité');
    await waitForText(pGuest, 'mix aléatoire');

    const launched = await pHost.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.toLowerCase().includes('lancer la partie') && !b.disabled,
      );
      if (btn) btn.click();
      return Boolean(btn);
    });
    if (!launched) throw new Error('bouton « Lancer la partie » introuvable');

    const seconds = await playToPodium([pHost, pGuest]);
    await waitForText(pHost, 'rejouer', 10000);
    const results = await pHost.evaluate(() => document.body.innerText);
    await pHost.screenshot({ path: '/work/e2e-elo-podium.png' });

    if (!/ton elo\s*:\s*\d+/i.test(results)) throw new Error('pastille « Ton Elo » absente des résultats');
    const deltas = results.split('\n').map((line) => line.trim()).filter((line) => /^(?:[+-]\d+|±0)$/.test(line));
    if (deltas.length < 2) throw new Error('variations d\'Elo absentes du classement : ' + JSON.stringify(deltas));
    if (/partie solo/i.test(results)) throw new Error('partie à 2 annoncée comme non classée');
    console.log(`podium à 2 en ${seconds}s — « Ton Elo » ✓, variations ${deltas.join(' ')} ✓`);

    // ---------- 2. partie solo : non classée ----------
    const solo = await api('/api/games', host.token, { random: true });
    console.log('partie solo :', solo.code);
    const pSolo = await openAs(browser, host, `${BASE}/game/${solo.code}`, 'solo');
    await waitForText(pSolo, 'mix aléatoire');
    await pSolo.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.toLowerCase().includes('lancer la partie') && !b.disabled,
      );
      if (btn) btn.click();
    });
    await playToPodium([pSolo]);
    await waitForText(pSolo, 'rejouer', 10000);
    const soloResults = await pSolo.evaluate(() => document.body.innerText);
    await pSolo.screenshot({ path: '/work/e2e-elo-solo.png' });

    if (!/partie solo.*elo n'est pas impact/i.test(soloResults.replace(/\s+/g, ' '))) {
      throw new Error('mention « partie solo » absente : ' + soloResults.replace(/\s+/g, ' ').slice(0, 200));
    }
    if (/ton elo\s*:/i.test(soloResults)) throw new Error('une partie solo ne doit pas afficher de gain d\'Elo');
    console.log('partie solo : classement Elo non impacté ✓');

    // ---------- 3. classement général ----------
    const pBoard = await openAs(browser, host, `${BASE}/leaderboard`, 'classement');
    await waitForText(pBoard, 'elo');
    const board = await pBoard.evaluate(() => document.body.innerText);
    await pBoard.screenshot({ path: '/work/e2e-elo-leaderboard.png' });
    for (const name of ['EloA-' + suffix, 'EloB-' + suffix]) {
      if (!board.toLowerCase().includes(name.toLowerCase())) {
        throw new Error(name + ' absent du classement Elo');
      }
    }
    const hasDisplayedRating = await pBoard.evaluate(() => {
      const lines = document.body.innerText.split('\n').map((line) => line.trim()).filter(Boolean);
      return lines.some((line) => /^\d{3,4}$/.test(line));
    });
    if (!hasDisplayedRating) throw new Error('aucun rating affiché dans les lignes du classement');
    console.log('classement général : les 2 joueurs classés avec leur Elo ✓');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('E2E ÉCHEC :', e.message);
  process.exit(1);
});
