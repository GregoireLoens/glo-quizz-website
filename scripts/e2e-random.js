/* E2E mode « Mix aléatoire » : 2 joueurs, partie complète jusqu'au podium. */
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:5173';
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
    // allège le rendu headless : pas d'animations ni de halos flous
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
  const host = await api('/api/auth/register', null, { username: 'E2Eh-' + suffix });
  const guest = await api('/api/auth/register', null, { username: 'E2Eg-' + suffix });
  const { code } = await api('/api/games', host.token, { random: true });
  console.log('partie aléatoire créée :', code);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const pHost = await openAs(browser, host, `${BASE}/game/${code}`, 'hôte');
    await waitForText(pHost, 'mix aléatoire');
    console.log('lobby hôte : « Mix aléatoire » affiché ✓');

    const pGuest = await openAs(browser, guest, `${BASE}/game/${code}`, 'invité');
    await waitForText(pGuest, 'mix aléatoire');
    console.log('lobby invité : « Mix aléatoire » affiché ✓');

    const launched = await pHost.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.innerText.toLowerCase().includes('lancer la partie') && !b.disabled,
      );
      if (btn) btn.click();
      return Boolean(btn);
    });
    if (!launched) throw new Error('bouton « Lancer la partie » introuvable ou désactivé');

    const probe = (p) =>
      p.evaluate(() => {
        const text = document.body.innerText;
        const m = text.match(/Question (\d+) \/ (\d+)/i);
        return {
          counter: m ? m[1] + '/' + m[2] : null,
          podium: /remporte la partie/i.test(text),
          ended: /retour à l'accueil/i.test(text),
          reconnecting: /reconnexion/i.test(text),
          excerpt: text.replace(/\s+/g, ' ').slice(0, 180),
        };
      });

    const seen = new Set();
    const t0 = Date.now();
    let lastProgress = Date.now();
    let finished = false;
    while (Date.now() - t0 < 240000) {
      const state = await probe(pHost);
      if (state.podium) {
        finished = true;
        break;
      }
      if (state.ended || state.reconnecting) {
        const guestState = await probe(pGuest);
        await pHost.screenshot({ path: '/work/e2e-fail-hote.png' });
        await pGuest.screenshot({ path: '/work/e2e-fail-invite.png' });
        console.log('état hôte   :', JSON.stringify(state));
        console.log('état invité :', JSON.stringify(guestState));
        throw new Error('page hôte en erreur/reconnexion en pleine partie');
      }
      if (state.counter && !seen.has(state.counter)) {
        seen.add(state.counter);
        lastProgress = Date.now();
        console.log('question', state.counter);
      }
      if (Date.now() - lastProgress > 45000) {
        await pHost.screenshot({ path: '/work/e2e-stall-hote.png' });
        await pGuest.screenshot({ path: '/work/e2e-stall-invite.png' });
        console.log('état hôte   :', JSON.stringify(await probe(pHost)));
        console.log('état invité :', JSON.stringify(await probe(pGuest)));
        throw new Error('stall : aucune progression depuis 45 s (screenshots pris)');
      }
      for (const p of [pHost, pGuest]) {
        await p.evaluate(() => {
          // 1er passage : choisir une carte ; passage suivant : « Valider → » envoie la réponse
          const cards = [...document.querySelectorAll('button.min-h-24')].filter((b) => !b.disabled);
          if (cards.length === 4) cards[Math.floor(Math.random() * 4)].click();
          const valider = [...document.querySelectorAll('button')].find(
            (b) => /valider/i.test(b.innerText) && !b.disabled,
          );
          if (valider) valider.click();
        });
      }
      await sleep(400);
    }

    if (!finished) throw new Error('budget de 240 s épuisé sans podium');
    await waitForText(pHost, 'rejouer', 10000);
    await pHost.screenshot({ path: '/work/e2e-podium.png' });
    const ranking = await pHost.evaluate(() => document.body.innerText);
    if (!/E2Eh-/i.test(ranking) || !/E2Eg-/i.test(ranking)) throw new Error('podium sans les 2 joueurs');
    console.log('podium atteint avec les 2 joueurs ✓ —', seen.size, 'questions jouées en', Math.round((Date.now() - t0) / 1000) + 's');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('E2E ÉCHEC :', e.message);
  process.exit(1);
});
