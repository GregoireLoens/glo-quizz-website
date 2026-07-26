/* E2E mode « Survie » : 2 joueurs, 3 vies, jusqu'au dernier survivant.
   L'invité tourne en viewport mobile (390×844) pour vérifier l'affichage des vies. */
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR || '/work';
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

async function openAs(browser, session, url, tag, mobile = false) {
  const page = await browser.newPage();
  await page.setViewport(
    mobile
      ? { width: 390, height: 844, isMobile: true, hasTouch: true }
      : { width: 1280, height: 900 },
  );
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

(async () => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const host = await api('/api/auth/register', null, { username: 'SRVh-' + suffix });
  const guest = await api('/api/auth/register', null, { username: 'SRVg-' + suffix });
  const { code } = await api('/api/games', host.token, {});
  console.log('salon :', code);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const pHost = await openAs(browser, host, `${BASE}/game/${code}`, 'hôte');
    await waitForText(pHost, 'choisir un quiz');
    const pGuest = await openAs(browser, guest, `${BASE}/game/${code}`, 'invité', true);
    await waitForText(pGuest, 'salon');

    // l'hôte sélectionne « Mode Survie » dans le picker de quiz
    await pHost.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /choisir un quiz/i.test(b.innerText))?.click();
    });
    await sleep(400);
    await pHost.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /mode survie/i.test(b.innerText))?.click();
    });
    await waitForText(pHost, 'dernier debout gagne');
    await waitForText(pGuest, 'dernier debout gagne');
    console.log('lobby : Mode Survie sélectionné, explication visible chez les 2 joueurs ✓');

    const launched = await pHost.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.toLowerCase().includes('lancer la partie') && !b.disabled,
      );
      if (btn) btn.click();
      return Boolean(btn);
    });
    if (!launched) throw new Error('bouton « Lancer la partie » indisponible');

    await waitForText(pGuest, 'Question 1');
    const guestText = await pGuest.evaluate(() => document.body.innerText);
    if (!guestText.includes('❤️')) throw new Error('vies non affichées côté invité');
    if (/Question 1 \/ /.test(guestText)) throw new Error('total de questions affiché alors que Survie');
    await pGuest.screenshot({ path: `${SHOTS}/e2e-survie-question-mobile.png` });
    console.log('question 1 : vies affichées, pas de total ✓ (capture mobile)');

    // les 2 répondent au hasard jusqu'à ce qu'il ne reste qu'un survivant
    const t0 = Date.now();
    let done = false;
    const seen = new Set();
    while (Date.now() - t0 < 240000) {
      const state = await pHost.evaluate(() => {
        const text = document.body.innerText;
        return {
          over: /survit à la partie|remporte la partie/i.test(text),
          counter: (text.match(/Question (\d+)/i) || [])[1] ?? null,
        };
      });
      if (state.over) { done = true; break; }
      if (state.counter && !seen.has(state.counter)) {
        seen.add(state.counter);
        console.log('question', state.counter);
      }
      for (const p of [pHost, pGuest]) {
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
    if (!done) throw new Error('budget de 240 s épuisé sans fin de partie');

    await waitForText(pHost, 'survit à la partie', 10000);
    await pGuest.screenshot({ path: `${SHOTS}/e2e-survie-podium-mobile.png` });
    const ranking = await pHost.evaluate(() => document.body.innerText);
    if (!/SRVh-/i.test(ranking) || !/SRVg-/i.test(ranking)) throw new Error('podium sans les 2 joueurs');
    console.log(`podium Survie atteint ✓ — ${seen.size} questions jouées en ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('E2E ÉCHEC :', e.message);
  process.exit(1);
});
