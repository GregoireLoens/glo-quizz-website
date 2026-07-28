/* E2E validation automatique : l'hôte sélectionne une réponse sans jamais cliquer
   « Valider → » ; à la fin du décompte elle doit partir toute seule (reveal ≠ « Pas de réponse »). */
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
    if (t.toLowerCase().includes(needle.toLowerCase())) return;
    await sleep(300);
  }
  throw new Error('timeout en attendant « ' + needle + ' »');
}

const text = (p) => p.evaluate(() => document.body.innerText);

(async () => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const host = await api('/api/auth/register', null, { username: 'E2Ea-' + suffix });
  const guest = await api('/api/auth/register', null, { username: 'E2Eb-' + suffix });
  const { code } = await api('/api/games', host.token, { random: true });
  console.log('partie créée :', code);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
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
    if (!launched) throw new Error('bouton « Lancer la partie » introuvable ou désactivé');

    await waitForText(pHost, 'question 1 /');

    // hôte : sélectionne la carte A, ne valide JAMAIS
    const picked = await pHost.evaluate(() => {
      const cards = [...document.querySelectorAll('button')].filter(
        (b) => !b.disabled && /^[ABCD]\n/.test(b.innerText),
      );
      if (cards.length !== 4) return null;
      cards[0].click();
      return cards[0].innerText.split('\n')[1] || '';
    });
    if (picked === null) throw new Error('cartes réponse introuvables');
    console.log('hôte : carte A sélectionnée sans valider —', JSON.stringify(picked));

    const hint = await text(pHost);
    if (!/validée automatiquement/i.test(hint)) throw new Error('indication « validée automatiquement » absente');

    // invité : sélectionne + valide (sinon all_answered couperait le décompte)
    await pGuest.evaluate(() => {
      const cards = [...document.querySelectorAll('button')].filter(
        (b) => !b.disabled && /^[ABCD]\n/.test(b.innerText),
      );
      if (cards.length === 4) cards[1].click();
      const v = [...document.querySelectorAll('button')].find((b) => /valider/i.test(b.innerText) && !b.disabled);
      if (v) v.click();
    });

    // attend le reveal (fin du décompte) et lit le retour personnel de l'hôte
    const t0 = Date.now();
    let verdict = null;
    while (Date.now() - t0 < 60000) {
      const t = (await text(pHost)).toLowerCase();
      if (/pas de réponse/.test(t)) verdict = 'pas de réponse';
      else if (/bonne réponse|mauvaise réponse/.test(t)) verdict = /bonne réponse/.test(t) ? 'bonne' : 'mauvaise';
      if (verdict) break;
      await sleep(250);
    }
    if (!verdict) throw new Error('aucun reveal en 60 s');
    if (verdict === 'pas de réponse') {
      await pHost.screenshot({ path: '/work/e2e-autosubmit-fail.png' });
      throw new Error('la réponse sélectionnée N\'A PAS été validée automatiquement');
    }
    console.log('reveal hôte :', verdict, 'réponse ✓ — validation automatique OK');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('E2E ÉCHEC :', e.message);
  process.exit(1);
});
