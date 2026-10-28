/* Martinet — suivi administratif.
   100 % local : aucune donnée saisie ne quitte l'appareil (pas de compte, pas de serveur, pas de statistiques). */
'use strict';

/* ───────────────────────── Logique pure (testable sous Node) ───────────────────────── */
const Core = (() => {
  const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const MON3 = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const DAYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

  const D = (y, m, d) => new Date(y, m, d, 12);
  const noon = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12);
  const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
  const lastDay = (y, m) => new Date(y, m + 1, 0, 12);
  const isWE = (dt) => dt.getDay() === 0 || dt.getDay() === 6;
  const prevBiz = (dt) => { const x = new Date(dt); while (isWE(x)) x.setDate(x.getDate() - 1); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return D(y, m - 1, d); };
  const diffDays = (a, b) => Math.round((noon(a) - noon(b)) / 86400000);
  const longDate = (dt) => `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;

  // Cas confirmés par une source officielle (date exacte, sans report au jour ouvré suivant).
  const CONFIRMED = {
    '2026-10-31': 'Date limite confirmée par l’Urssaf : samedi 31 octobre 2026 à 23h59, sans report au 2 novembre.'
  };

  // Calendriers 2027 : ESTIMATIONS d’après les campagnes 2025 et 2026, à confirmer à la publication.
  const EST = {
    2027: {
      impotsOpen: [3, 8],                                    // 8 avril 2027
      impotsLimit: { 1: [4, 20], 2: [4, 27], 3: [5, 3] },    // 20 mai, 27 mai, 3 juin 2027
      aaOpen: [3, 26],                                       // 26 avril 2027
      aaLimit: [5, 18]                                       // 18 juin 2027
    }
  };

  function microItems(freq, start, end) {
    const out = [];
    for (let c = D(start.getFullYear(), start.getMonth(), 1); c <= end; c = D(c.getFullYear(), c.getMonth() + 1, 1)) {
      const y = c.getFullYear(), m = c.getMonth();
      if (freq === 'trim' && m % 3 !== 0) continue;
      let label;
      if (freq === 'trim') {
        const q = m === 0 ? 4 : m / 3;
        label = `CA du T${q} ${m === 0 ? y - 1 : y}`;
      } else {
        const pm = (m + 11) % 12;
        label = `CA ${/^[aeiou]/.test(MONTHS[pm]) ? 'd’' : 'de '}${MONTHS[pm]} ${m === 0 ? y - 1 : y}`;
      }
      const official = lastDay(y, m);
      let date = official, status = 'usual', note = 'Déclaration obligatoire même si le chiffre d’affaires est nul (0 €).';
      const key = iso(official);
      if (CONFIRMED[key]) {
        status = 'confirmed'; note = CONFIRMED[key] + ' Déclaration obligatoire même à 0 €.';
      } else if (isWE(official)) {
        date = prevBiz(official);
        note = `Échéance officielle : ${DAYS[official.getDay()]} ${official.getDate()} ${MONTHS[official.getMonth()]}. Placée au jour ouvré précédent par précaution (un report n’est pas garanti). Déclaration obligatoire même à 0 €.`;
      }
      if (date < start || date > end) continue;
      out.push({ id: `micro-${key}-${freq}`, kind: 'micro', status, date,
        title: `Urssaf micro · ${label}`, note, url: 'https://autoentrepreneur.urssaf.fr', cta: 'Déclarer sur l’Urssaf' });
    }
    return out;
  }

  function fiscalItems(zone, start, end, want) {
    const out = [];
    for (const y of Object.keys(EST).map(Number)) {
      const e = EST[y];
      const push = (id, kind, date, title, note, url, cta) => {
        if (date >= start && date <= end) out.push({ id, kind, status: 'estimated', date, title, note, url, cta });
      };
      if (want.impots) {
        push(`ir-open-${y}`, 'impots', D(y, e.impotsOpen[0], e.impotsOpen[1]), `Impôts · ouverture de la déclaration (revenus ${y - 1})`,
          'Date estimée. Droits d’auteur précomptés par un éditeur : traitements et salaires, avec le même montant brut que sur la déclaration Urssaf. Micro-entreprise : chiffre d’affaires en micro-BNC.',
          'https://www.impots.gouv.fr', 'Ouvrir impots.gouv.fr');
        const [lm, ld] = e.impotsLimit[zone] || e.impotsLimit[3];
        push(`ir-limit-${y}-z${zone}`, 'impots', D(y, lm, ld), `Impôts · date limite en ligne (zone ${zone})`,
          `Date estimée pour la zone ${zone}. À confirmer sur impots.gouv.fr dès la publication du calendrier.`,
          'https://www.impots.gouv.fr', 'Ouvrir impots.gouv.fr');
      }
      if (want.aa) {
        push(`aa-open-${y}`, 'aa', D(y, e.aaOpen[0], e.aaOpen[1]), `Urssaf artistes-auteurs · ouverture de la déclaration (revenus ${y - 1})`,
          'Date estimée. Vérifier que les droits précomptés par l’éditeur sont déclarés dans la bonne rubrique, au montant brut HT du relevé.',
          'https://www.artistes-auteurs.urssaf.fr', 'Ouvrir l’espace Urssaf');
        push(`aa-limit-${y}`, 'aa', D(y, e.aaLimit[0], e.aaLimit[1]), `Urssaf artistes-auteurs · date limite (revenus ${y - 1})`,
          'Date estimée. À confirmer sur artistes-auteurs.urssaf.fr dès l’annonce du calendrier.',
          'https://www.artistes-auteurs.urssaf.fr', 'Ouvrir l’espace Urssaf');
      }
    }
    return out;
  }

  function cfeItems(start, end) {
    const out = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const dt = D(y, 11, 15);
      if (dt >= start && dt <= end) out.push({
        id: `cfe-${y}`, kind: 'micro', status: 'usual', date: isWE(dt) ? prevBiz(dt) : dt,
        title: 'CFE · paiement de la cotisation foncière',
        note: 'Échéance habituelle vers le 15 décembre, uniquement si un avis est reçu (souvent exonéré la première année). À vérifier sur impots.gouv.fr, espace professionnel.',
        url: 'https://www.impots.gouv.fr', cta: 'Ouvrir impots.gouv.fr'
      });
    }
    return out;
  }

  const DEFAULTS = () => ({
    settings: { setup: false, activities: { micro: false, impots: false, aa: false }, freq: 'trim', zone: 3, cfe: false },
    done: {}, steps: {}, pins: {}, custom: [], notes: {}
  });

  function build(settings, custom, now) {
    const act = settings.activities || {};
    const today = noon(now);
    const start = addDays(today, -14);
    const end = D(today.getFullYear(), today.getMonth() + 15, 1);
    const items = [
      ...(act.micro ? microItems(settings.freq, start, end) : []),
      ...fiscalItems(settings.zone || 3, start, end, { impots: !!act.impots, aa: !!act.aa }),
      ...(act.micro && settings.cfe ? cfeItems(start, end) : []),
      ...custom.map((c) => ({ id: c.id, kind: 'custom', status: 'custom', date: fromIso(c.date), title: c.title, note: c.note || '', custom: true }))
    ];
    items.sort((a, b) => a.date - b.date || a.title.localeCompare(b.title));
    return items;
  }

  // Validation stricte de toute donnée venant du stockage ou d'un fichier importé (liste blanche).
  const KEY_RE = /^[A-Za-z0-9_.:@-]{1,90}$/;
  const badKey = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype' || !KEY_RE.test(k);
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  function sanitize(raw) {
    const d = DEFAULTS();
    if (!isObj(raw)) return d;
    const s = isObj(raw.settings) ? raw.settings : {};
    d.settings.setup = s.setup === true;
    const a = isObj(s.activities) ? s.activities : {};
    for (const k of ['micro', 'impots', 'aa']) d.settings.activities[k] = a[k] === true;
    d.settings.freq = s.freq === 'mens' ? 'mens' : 'trim';
    d.settings.zone = [1, 2, 3].includes(s.zone) ? s.zone : 3;
    d.settings.cfe = s.cfe === true;
    for (const f of ['done', 'steps', 'pins']) {
      if (!isObj(raw[f])) continue;
      let n = 0;
      for (const k of Object.keys(raw[f])) { if (n >= 2000) break; if (!badKey(k) && raw[f][k] === true) { d[f][k] = true; n++; } }
    }
    if (Array.isArray(raw.custom)) {
      for (const c of raw.custom.slice(0, 200)) {
        if (!isObj(c) || badKey(String(c.id)) || typeof c.title !== 'string' || !c.title.trim()) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.date)) || iso(fromIso(c.date)) !== c.date) continue;
        d.custom.push({ id: String(c.id), title: c.title.slice(0, 80), date: c.date, note: typeof c.note === 'string' ? c.note.slice(0, 160) : '' });
      }
    }
    if (isObj(raw.notes)) {
      for (const k of Object.keys(raw.notes)) if (!badKey(k) && typeof raw.notes[k] === 'string') d.notes[k] = raw.notes[k].slice(0, 2000);
    }
    return d;
  }

  // Export iCalendar (RFC 5545) : échéances uniquement, jamais les notes.
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => {
    const out = []; let cur = '';
    for (const ch of line) {
      if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
    }
    out.push(cur); return out.join('\r\n');
  };
  function toICS(items, now) {
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Martinet//Suivi administratif//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:Martinet · administratif', 'X-WR-TIMEZONE:Europe/Paris'];
    for (const it of items) {
      const next = addDays(it.date, 1);
      const alarms = it.status === 'estimated' ? [['-P13DT15H', '14 jours'], ['-P6DT15H', '7 jours'], ['-PT15H', 'demain']] : [['-P6DT15H', '7 jours'], ['-PT15H', 'demain']];
      L.push('BEGIN:VEVENT', `UID:${it.id}@martinet`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${iso(it.date).replace(/-/g, '')}`, `DTEND;VALUE=DATE:${iso(next).replace(/-/g, '')}`,
        `SUMMARY:${esc((it.status === 'estimated' ? '(estimé) ' : '') + it.title)}`,
        `DESCRIPTION:${esc(it.note)}`, 'TRANSP:TRANSPARENT');
      for (const [t, lab] of alarms) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title + ' : ' + lab)}`, `TRIGGER:${t}`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  return { MONTHS, MON3, DAYS, D, noon, addDays, iso, fromIso, diffDays, longDate, build, toICS, sanitize, DEFAULTS, isWE, prevBiz };
})();

if (typeof module !== 'undefined') module.exports = Core;

/* ───────────────────────── Dossiers (modèles génériques) ───────────────────────── */
const DOSSIERS = [
  {
    id: 'courrier-urssaf', needs: 'aa', title: 'Régularisation Urssaf artistes-auteurs',
    sub: 'À utiliser si l’Urssaf signale une incohérence dans une déclaration',
    steps: [
      ['Lire le courrier ou l’e-mail et noter ce qui est demandé', 'Relever aussi la date limite éventuelle.'],
      ['Choisir : traitements et salaires ou BNC', 'Les droits précomptés par un éditeur relèvent normalement des traitements et salaires. Le BNC suppose une déclaration d’activité (adjonction d’activité sur le guichet unique).'],
      ['Se connecter sur artistes-auteurs.urssaf.fr', ''],
      ['Corriger la déclaration annuelle (rubrique et montant brut HT du relevé)', ''],
      ['Valider, puis répondre au courrier de l’Urssaf', 'Sans action de ta part, un dossier bloqué ne peut pas être régularisé.'],
      ['Contrôler les appels de cotisations (pas de doublon avec le précompte)', ''],
      ['Contrôler la déclaration d’impôts (cohérence avec la déclaration Urssaf)', '']
    ]
  },
  {
    id: 'rituel-da', needs: 'aa', title: 'Rituel annuel : droits d’auteur',
    sub: 'À refaire chaque année après le relevé de l’éditeur',
    steps: [
      ['Récupérer le relevé de droits de l’éditeur', 'Le conserver sans limite de durée.'],
      ['Noter le montant brut HT', 'C’est l’assiette sociale en traitements et salaires.'],
      ['Déclarer le même montant à l’Urssaf artistes-auteurs (printemps)', ''],
      ['Reporter ces droits au bon endroit sur la déclaration d’impôts', '']
    ]
  },
  {
    id: 'micro', needs: 'micro', title: 'Micro-entreprise : à ne pas oublier',
    sub: 'Rappels de base',
    steps: [
      ['Déclarer le chiffre d’affaires à chaque échéance, même à 0 €', 'Une déclaration manquante peut entraîner une pénalité.'],
      ['Tenir le livre des recettes et conserver les factures', ''],
      ['Ne pas facturer de droits d’auteur via la micro-entreprise', 'Ils passent par le régime des artistes-auteurs.'],
      ['Vérifier les plafonds de chiffre d’affaires en vigueur', 'En cas de droits d’auteur en BNC et de micro-BNC, les montants se cumulent pour le seuil.']
    ]
  },
  {
    id: 'impots', needs: 'impots', title: 'Déclaration de revenus',
    sub: 'Avant la date limite de ta zone',
    steps: [
      ['Rassembler les relevés (éditeur, Urssaf, banque) et le chiffre d’affaires annuel', ''],
      ['Vérifier les montants préremplis', ''],
      ['Déclarer chaque revenu dans la bonne rubrique', 'Micro-BNC, traitements et salaires : ne pas déclarer deux fois le même revenu.'],
      ['Valider et conserver l’accusé de réception', '']
    ]
  }
];

/* ───────────────────────── Application ───────────────────────── */
if (typeof document !== 'undefined') (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* — Stockage local (jamais de réseau) — */
  const raw = {
    get(k) { try { return localStorage.getItem('martinet:' + k); } catch (e) { return null; } },
    set(k, v) { localStorage.setItem('martinet:' + k, v); },
    del(k) { try { localStorage.removeItem('martinet:' + k); } catch (e) { /* ignoré */ } }
  };

  /* — Chiffrement optionnel : AES-256-GCM, clé dérivée du code par PBKDF2-SHA256 — */
  const ITER = 310000;
  const cryptoOK = !!(window.crypto && crypto.subtle);
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const okIter = (n) => Number.isInteger(n) && n >= 100000 && n <= 2000000;
  const Vault = {
    async derive(pass, salt, it) {
      if (!okIter(it)) throw new Error('paramètres invalides');
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    async encrypt(key, salt, obj) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
      return { v: 1, kdf: 'PBKDF2-SHA256', it: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
    },
    async decrypt(key, blob) {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    }
  };
  const session = { key: null, salt: null };

  /* — État — */
  let S = Core.DEFAULTS();
  const ui = { tab: 'agenda', filter: 'all', locked: false, lockErr: '', draft: { micro: false, impots: false, aa: false, freq: 'trim', zone: null } };

  let chain = Promise.resolve();
  function save() {
    chain = chain.then(async () => {
      try {
        if (session.key) raw.set('vault', JSON.stringify(await Vault.encrypt(session.key, session.salt, S)));
        else raw.set('data', JSON.stringify(S));
        return true;
      } catch (e) { toast('Enregistrement impossible : stockage indisponible'); return false; }
    });
    return chain;
  }
  let saveTimer = 0;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); };

  const ICON = {
    agenda: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    dossiers: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/></svg>',
    reglages: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };
  const TABS = [['agenda', 'À venir'], ['cal', 'Calendrier'], ['dossiers', 'Dossiers'], ['reglages', 'Réglages']];
  const STATUS = { confirmed: 'Confirmée', usual: 'Échéance habituelle', estimated: 'Estimée', custom: 'Perso' };
  const KIND = { all: 'Tout', micro: 'Micro', impots: 'Impôts', aa: 'Artistes-auteurs', custom: 'Perso' };
  const ACT = { micro: ['Micro-entreprise', 'Déclaration du chiffre d’affaires à l’Urssaf'], impots: ['Impôt sur le revenu', 'Déclaration annuelle de revenus'], aa: ['Artiste-auteur', 'Déclaration annuelle à l’Urssaf artistes-auteurs'] };

  const now = () => new Date();
  const items = () => Core.build(S.settings, S.custom, now());

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function countdown(date) {
    const n = Core.diffDays(date, now());
    if (n === 0) return { big: '0', unit: 'aujourd’hui', n };
    if (n === 1) return { big: '1', unit: 'jour · demain', n };
    if (n < 0) return { big: String(-n), unit: n === -1 ? 'jour de retard' : 'jours de retard', n };
    return { big: String(n), unit: 'jours', n };
  }

  const dateBox = (dt) => `<div class="date"><b>${dt.getDate()}</b><span>${Core.MON3[dt.getMonth()]}</span></div>`;
  const chip = (it, late) => late ? '<span class="chip late">En retard</span>' : `<span class="chip ${it.status}">${STATUS[it.status]}</span>`;
  const ext = (url, label) => `<a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const toggleRow = (act, k, title, sub, on) => `<button class="switch mt10" data-act="${act}" data-k="${k}" role="switch" aria-checked="${on}"><span><b class="w6">${title}</b><span class="tiny mut block">${sub}</span></span><span class="tog ${on ? 'on' : ''}"></span></button>`;
  const zoneSelect = (id, act, val) => `<select id="${id}" data-act="${act}"><option value="" ${val ? '' : 'selected'} disabled>Choisir…</option>
    <option value="3" ${val === 3 ? 'selected' : ''}>Zone 3 · départements 55 à 976 (dont Paris)</option>
    <option value="2" ${val === 2 ? 'selected' : ''}>Zone 2 · départements 20 à 54</option>
    <option value="1" ${val === 1 ? 'selected' : ''}>Zone 1 · départements 01 à 19 et non-résidents</option></select>`;
  const freqSeg = (act, val) => `<div class="seg"><button data-act="${act}" data-v="trim" class="${val === 'trim' ? 'on' : ''}">Trimestrielle</button><button data-act="${act}" data-v="mens" class="${val === 'mens' ? 'on' : ''}">Mensuelle</button></div>`;

  function itemHTML(it, opts = {}) {
    const isDone = !!S.done[it.id];
    const late = !isDone && Core.diffDays(it.date, now()) < 0;
    return `<article class="item ${isDone ? 'done' : ''} fade">
      ${dateBox(it.date)}
      <div class="grow">
        <h3>${esc(it.title)}</h3>
        <div class="meta">${chip(it, late)}<span class="tiny mut">${esc(Core.longDate(it.date))}</span></div>
        ${opts.noNote ? '' : `<p class="note">${esc(it.note)}</p>`}
        ${it.url && !isDone && !opts.noNote ? `<div class="btns tight">${ext(it.url, it.cta || 'Ouvrir')}</div>` : ''}
      </div>
      <button class="check ${isDone ? 'on' : ''}" data-act="toggle" data-id="${esc(it.id)}" aria-label="Marquer comme fait" aria-pressed="${isDone}">${ICON.tick}</button>
    </article>`;
  }

  const dossierProgress = (d) => d.steps.filter((_, i) => S.steps[`${d.id}-${i}`]).length;

  /* — Vues — */
  function viewLock() {
    return `<section class="card lock fade">
      <div class="lockicon" aria-hidden="true">🔒</div>
      <h3>Martinet est verrouillé</h3>
      <p class="small mut mt6">Saisis ton code pour déverrouiller tes données.</p>
      <label class="f" for="pw">Code</label>
      <input id="pw" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
      ${ui.lockErr ? `<p class="err mt8">${esc(ui.lockErr)}</p>` : ''}
      <div class="btns"><button class="btn primary" data-act="unlock">Déverrouiller</button></div>
      <p class="tiny mut mt14">Code oublié ? Il n’existe aucune récupération possible : la seule issue est d’effacer les données de cet appareil.</p>
      <div class="btns tight"><button class="btn small danger" data-act="wipe">Effacer toutes les données</button></div>
    </section>`;
  }

  function viewOnboarding() {
    const d = ui.draft;
    return `<section class="card fade">
      <h3>Bienvenue</h3>
      <p class="small mut mt6 lh">Choisis les démarches à suivre. Tout se règle ici, sur ton téléphone : rien n’est envoyé sur Internet.</p>
      ${['micro', 'impots', 'aa'].map((k) => toggleRow('obd', k, ACT[k][0], ACT[k][1], d[k])).join('')}
      ${d.micro ? `<label class="f">Périodicité de déclaration de la micro-entreprise</label>${freqSeg('obfreq', d.freq)}` : ''}
      ${d.impots ? `<label class="f" for="obzone">Zone de la date limite de déclaration en ligne</label>${zoneSelect('obzone', 'obzone', d.zone)}<p class="tiny mut mt6">Selon ton département de résidence au 1er janvier.</p>` : ''}
      <div class="btns"><button class="btn primary" data-act="obdone">Commencer</button></div>
    </section>
    <p class="disclaimer">Aucune donnée personnelle n’est intégrée à l’appli. Tu pourras protéger l’accès par un code dans Réglages.</p>`;
  }

  function viewAgenda() {
    const all = items();
    const open = all.filter((i) => !S.done[i.id]);
    const late = open.filter((i) => Core.diffDays(i.date, now()) < 0);
    const upcoming = open.filter((i) => Core.diffDays(i.date, now()) >= 0);
    const first = late[0] || upcoming[0];
    let h = '';

    for (const d of DOSSIERS) {
      const n = dossierProgress(d);
      if (S.pins[d.id] && n < d.steps.length) {
        h += `<button class="alert mb14 fade" data-act="goto" data-tab="dossiers"><span class="ico" aria-hidden="true">📌</span>
          <span class="grow"><b>${esc(d.title)}</b><span class="small mut block mt3">${n}/${d.steps.length} étapes faites</span></span></button>`;
      }
    }

    if (first) {
      const c = countdown(first.date); const isLate = c.n < 0;
      h += `<section class="hero ${isLate ? 'late' : ''} fade">
        <div class="eyebrow">${isLate ? 'En retard' : 'Prochaine échéance'}</div>
        <div class="count"><b>${c.big}</b><span>${c.unit}</span></div>
        <h3>${esc(first.title)}</h3>
        <div class="when">${esc(Core.longDate(first.date))} · ${chip(first, false)}</div>
        <p class="note small mut mt10 lh">${esc(first.note)}</p>
        <div class="btns">
          <button class="btn primary" data-act="toggle" data-id="${esc(first.id)}">✓ Marquer comme fait</button>
          ${first.url ? ext(first.url, first.cta || 'Ouvrir') : ''}
        </div></section>`;
    } else {
      const none = !Object.values(S.settings.activities).some(Boolean) && !S.custom.length;
      h += `<div class="empty card">${none ? 'Aucune démarche suivie. Choisis-en dans Réglages.' : 'Rien à signaler. Tout est à jour. 🎉'}</div>`;
    }

    const rest = [...late, ...upcoming].filter((i) => !first || i.id !== first.id).slice(0, 6);
    if (rest.length) h += `<h2>Ensuite</h2><div class="stack">${rest.map((i) => itemHTML(i, { noNote: true })).join('')}</div>`;
    h += '<p class="disclaimer">Les dates « estimées » reposent sur les campagnes précédentes et sont à confirmer dès la publication des calendriers officiels. Cet outil n’a pas valeur de conseil juridique ou fiscal.</p>';
    return h;
  }

  function viewCal() {
    let list = items();
    if (ui.filter !== 'all') list = list.filter((i) => i.kind === ui.filter);
    let h = `<div class="filters">${Object.entries(KIND).map(([k, l]) => `<button class="pill ${ui.filter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${l}</button>`).join('')}</div>`;
    if (!list.length) return h + '<div class="empty">Aucune échéance pour ce filtre.</div>';
    let cur = '';
    for (const it of list) {
      const label = `${Core.MONTHS[it.date.getMonth()]} ${it.date.getFullYear()}`;
      if (label !== cur) { cur = label; h += `<div class="month">${label}</div>`; }
      h += `<div class="stack mb10">${itemHTML(it)}</div>`;
    }
    return h;
  }

  function viewDossiers() {
    const act = S.settings.activities;
    let list = DOSSIERS.filter((d) => act[d.needs]);
    if (!list.length) list = DOSSIERS;
    return list.map((d) => {
      const n = dossierProgress(d);
      const pct = Math.round((n / d.steps.length) * 100);
      const pinned = !!S.pins[d.id];
      return `<section class="card fade mb14">
        <div class="row"><div class="grow"><h3>${esc(d.title)}</h3><p class="small mut mt4">${esc(d.sub)}</p></div>
        <span class="chip ${n === d.steps.length ? 'confirmed' : 'custom'}">${n}/${d.steps.length}</span></div>
        <div class="bar"><i data-w="${pct}"></i></div>
        <div class="mt8">${d.steps.map(([t, s], i) => {
          const on = !!S.steps[`${d.id}-${i}`];
          return `<button class="step ${on ? 'on' : ''}" data-act="step" data-k="${d.id}-${i}" aria-pressed="${on}">
            <span class="check ${on ? 'on' : ''}">${ICON.tick}</span><span><span class="t">${esc(t)}</span>${s ? `<span class="s">${esc(s)}</span>` : ''}</span></button>`;
        }).join('')}</div>
        <label class="f" for="n-${d.id}">Notes personnelles (restent sur cet appareil)</label>
        <textarea id="n-${d.id}" data-note="${d.id}" maxlength="2000" rows="3" placeholder="Montants, références, numéro de dossier…">${esc(S.notes[d.id] || '')}</textarea>
        <button class="switch mt8" data-act="pin" data-k="${d.id}" role="switch" aria-checked="${pinned}"><span class="small">Rappel en tête de « À venir » tant qu’il n’est pas terminé</span><span class="tog ${pinned ? 'on' : ''}"></span></button>
      </section>`;
    }).join('');
  }

  function viewReglages() {
    const s = S.settings, a = s.activities, locked = !!session.key;
    return `
    <section class="card fade">
      <h3>Démarches suivies</h3>
      ${['micro', 'impots', 'aa'].map((k) => toggleRow('act', k, ACT[k][0], ACT[k][1], a[k])).join('')}
      ${a.micro ? `<label class="f">Périodicité de la micro-entreprise</label>${freqSeg('freq', s.freq)}<p class="tiny mut mt6">Visible sur ton espace autoentrepreneur.urssaf.fr.</p>
        ${toggleRow('cfe', 'cfe', 'Rappel CFE (15 décembre)', 'Seulement si tu reçois un avis', s.cfe)}` : ''}
      ${a.impots ? `<label class="f" for="zone">Zone de la date limite en ligne</label>${zoneSelect('zone', 'zone', s.zone)}` : ''}
    </section>

    <section class="card fade mt12">
      <h3>Ajouter une échéance perso</h3>
      <label class="f" for="ct">Titre</label><input id="ct" type="text" placeholder="Ex. : renouveler une attestation" maxlength="80" autocomplete="off">
      <label class="f" for="cd">Date</label><input id="cd" type="date">
      <label class="f" for="cn">Note (facultatif)</label><input id="cn" type="text" maxlength="160" autocomplete="off">
      <div class="btns"><button class="btn primary" data-act="addcustom">Ajouter</button></div>
      ${S.custom.length ? `<div class="mt14">${S.custom.map((c) => `<div class="row li"><div class="grow"><b class="w6">${esc(c.title)}</b><div class="tiny mut">${esc(Core.longDate(Core.fromIso(c.date)))}</div></div><button class="btn small danger" data-act="delcustom" data-id="${esc(c.id)}">Retirer</button></div>`).join('')}</div>` : ''}
    </section>

    <section class="card fade mt12">
      <h3>Calendrier Apple</h3>
      <p class="small mut mt6 lh">Exporte les échéances à venir vers Calendrier (rappels à 14 et 7 jours et la veille pour les dates estimées). Les notes personnelles ne sont jamais exportées.</p>
      <div class="btns"><button class="btn primary" data-act="ics">Exporter (.ics)</button></div>
    </section>

    <section class="card fade mt12">
      <h3>Confidentialité et sécurité</h3>
      <ul class="facts">
        <li>Tout ce que tu saisis reste dans le stockage de cet appareil. Il n’y a ni compte, ni serveur, ni statistiques.</li>
        <li>Le navigateur bloque toute connexion vers un autre site : l’appli ne peut pas envoyer tes données, même par erreur.</li>
        <li>L’hébergeur voit, comme pour tout site, qu’une visite a lieu (adresse IP), jamais ce que tu saisis.</li>
        <li>Effacer les données du site dans Safari, ou supprimer l’appli, efface tout : fais une sauvegarde.</li>
      </ul>
      <h3 class="mt14">Verrouillage par code</h3>
      ${!cryptoOK ? '<p class="small mut mt6 lh">Indisponible dans ce navigateur (connexion sécurisée requise).</p>' : `
      <p class="small mut mt6 lh">${locked ? 'Activé : tes données sont chiffrées (AES-256) sur l’appareil et l’appli se verrouille après 1 minute en arrière-plan.' : 'Optionnel : chiffre tes données (AES-256) avec un code et verrouille l’appli. Si tu oublies le code, rien n’est récupérable.'}</p>
      <label class="f" for="lp1">${locked ? 'Nouveau code' : 'Code'} (6 caractères minimum, 10 conseillés)</label>
      <input id="lp1" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
      <label class="f" for="lp2">Confirmer le code</label>
      <input id="lp2" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="128">
      <div class="btns"><button class="btn primary" data-act="setlock">${locked ? 'Changer le code' : 'Activer le verrouillage'}</button>
        ${locked ? '<button class="btn" data-act="lockNow">Verrouiller maintenant</button><button class="btn danger" data-act="unlockoff">Désactiver</button>' : ''}</div>
      <p class="tiny mut mt10 lh">Un code court protège contre une personne qui ouvre ton téléphone, pas contre une attaque menée sur l’appareil lui-même.</p>`}
    </section>

    <section class="card fade mt12">
      <h3>Sauvegarde</h3>
      <p class="small mut mt6 lh">Un fichier que tu gardes toi-même. ${locked ? 'Il est chiffré avec ton code.' : 'Sans verrouillage, il est lisible par quiconque l’ouvre : range-le avec soin.'}</p>
      <div class="btns"><button class="btn" data-act="exp">Exporter</button><button class="btn" data-act="imp">Importer</button></div>
    </section>

    <section class="card fade mt12">
      <h3>Effacer</h3>
      <p class="small mut mt6 lh">Supprime tout ce qui est enregistré par Martinet sur cet appareil.</p>
      <div class="btns"><button class="btn danger" data-act="wipe">Tout effacer</button></div>
    </section>
    <p class="disclaimer">Sources : impots.gouv.fr (calendrier 2026), service-public.gouv.fr (date limite avancée au 31/10/2026), Urssaf et Urssaf Limousin (calendriers 2025 et 2026). Dates 2027 estimées.</p>`;
  }

  /* — Rendu — */
  function render() {
    const d = now();
    const dn = Core.DAYS[d.getDay()];
    $('#today').textContent = `${dn[0].toUpperCase() + dn.slice(1)} ${d.getDate()} ${Core.MONTHS[d.getMonth()]}`;
    const tabs = $('#tabs'), view = $('#view');
    if (ui.locked) { tabs.innerHTML = ''; view.innerHTML = viewLock(); const pw = $('#pw'); if (pw) pw.focus(); return; }
    if (!S.settings.setup) { tabs.innerHTML = ''; view.innerHTML = viewOnboarding(); return; }
    tabs.innerHTML = `<div class="in">${TABS.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="goto" data-tab="${k}" aria-current="${ui.tab === k}">${ICON[k]}<span>${l}</span></button>`).join('')}</div>`;
    view.innerHTML = { agenda: viewAgenda, cal: viewCal, dossiers: viewDossiers, reglages: viewReglages }[ui.tab]();
    view.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; });
  }

  /* — Actions — */
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function exportICS() {
    const list = items().filter((i) => !S.done[i.id] && Core.diffDays(i.date, now()) >= 0);
    if (!list.length) return toast('Aucune échéance à exporter');
    download(Core.toICS(list, now()), 'martinet-echeances.ics', 'text/calendar;charset=utf-8');
    toast(`${list.length} échéances exportées`);
  }

  async function exportBackup() {
    await chain;
    const text = session.key ? raw.get('vault') : JSON.stringify(S, null, 2);
    if (!text) return toast('Rien à exporter');
    download(text, 'martinet-sauvegarde.json', 'application/json');
    toast(session.key ? 'Sauvegarde chiffrée exportée' : 'Sauvegarde exportée (non chiffrée)');
  }

  async function importBackup(file) {
    if (!file || file.size > 300000) return toast('Fichier invalide');
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { return toast('Fichier illisible'); }
    if (obj && typeof obj === 'object' && obj.ct && obj.iv && obj.salt) {
      const pw = window.prompt('Code de cette sauvegarde chiffrée :');
      if (!pw) return;
      try {
        const salt = unb64(obj.salt);
        const key = await Vault.derive(pw, salt, obj.it);
        S = Core.sanitize(await Vault.decrypt(key, obj));
        session.key = key; session.salt = salt;
        if (await save()) { raw.del('data'); toast('Sauvegarde restaurée (verrouillage activé)'); }
      } catch (e) { return toast('Code incorrect ou fichier altéré'); }
    } else {
      S = Core.sanitize(obj);
      if (await save()) toast('Sauvegarde restaurée');
    }
    render();
  }

  async function unlock() {
    const pw = $('#pw').value;
    if (!pw) return;
    try {
      const blob = JSON.parse(raw.get('vault'));
      const salt = unb64(blob.salt);
      const key = await Vault.derive(pw, salt, blob.it);
      S = Core.sanitize(await Vault.decrypt(key, blob));
      session.key = key; session.salt = salt; ui.locked = false; ui.lockErr = ''; render();
    } catch (e) {
      await sleep(1200); ui.lockErr = 'Code incorrect.'; render();
    }
  }

  function lockNow() { S = Core.DEFAULTS(); session.key = null; session.salt = null; ui.locked = true; ui.lockErr = ''; ui.tab = 'agenda'; render(); window.scrollTo(0, 0); }

  async function setLock() {
    const a = $('#lp1').value, b = $('#lp2').value;
    if (a.length < 6) return toast('6 caractères minimum');
    if (a !== b) return toast('Les deux codes sont différents');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    session.key = await Vault.derive(a, salt, ITER); session.salt = salt;
    if (await save()) { raw.del('data'); toast('Verrouillage activé'); } else { session.key = null; session.salt = null; }
    render();
  }

  async function unlockOff() {
    if (!window.confirm('Désactiver le verrouillage ? Les données seront enregistrées sans chiffrement sur cet appareil.')) return;
    session.key = null; session.salt = null;
    if (await save()) { raw.del('vault'); toast('Verrouillage désactivé'); }
    render();
  }

  function wipe() {
    if (!window.confirm('Effacer toutes les données de Martinet sur cet appareil ? Cette action est définitive.')) return;
    raw.del('data'); raw.del('vault');
    S = Core.DEFAULTS(); session.key = null; session.salt = null; ui.locked = false; ui.lockErr = '';
    ui.draft = { micro: false, impots: false, aa: false, freq: 'trim', zone: null }; ui.tab = 'agenda';
    render(); toast('Données effacées');
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return;
    const act = el.dataset.act, k = el.dataset.k;
    if (act === 'goto') { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); }
    else if (act === 'toggle') { const id = el.dataset.id; if (S.done[id]) delete S.done[id]; else { S.done[id] = true; toast('Marquée comme faite'); } save(); render(); }
    else if (act === 'step') { if (S.steps[k]) delete S.steps[k]; else S.steps[k] = true; save(); render(); }
    else if (act === 'pin') { if (S.pins[k]) delete S.pins[k]; else S.pins[k] = true; save(); render(); }
    else if (act === 'filter') { ui.filter = k; render(); }
    else if (act === 'obd') { ui.draft[k] = !ui.draft[k]; render(); }
    else if (act === 'obfreq') { ui.draft.freq = el.dataset.v; render(); }
    else if (act === 'obdone') {
      const d = ui.draft;
      if (!d.micro && !d.impots && !d.aa) return toast('Choisis au moins une démarche');
      if (d.impots && !d.zone) return toast('Choisis ta zone');
      S.settings = { setup: true, activities: { micro: d.micro, impots: d.impots, aa: d.aa }, freq: d.freq, zone: d.zone || 3, cfe: false };
      save(); render(); window.scrollTo(0, 0);
    }
    else if (act === 'act') { S.settings.activities[k] = !S.settings.activities[k]; save(); render(); }
    else if (act === 'freq') { S.settings.freq = el.dataset.v; save(); render(); toast('Périodicité mise à jour'); }
    else if (act === 'cfe') { S.settings.cfe = !S.settings.cfe; save(); render(); }
    else if (act === 'ics') exportICS();
    else if (act === 'addcustom') {
      const t = $('#ct').value.trim(), dt = $('#cd').value, n = $('#cn').value.trim();
      if (!t || !dt) return toast('Titre et date requis');
      S.custom.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: t.slice(0, 80), date: dt, note: n.slice(0, 160) });
      save(); render(); toast('Échéance ajoutée');
    }
    else if (act === 'delcustom') { S.custom = S.custom.filter((c) => c.id !== el.dataset.id); save(); render(); }
    else if (act === 'unlock') unlock();
    else if (act === 'setlock') setLock();
    else if (act === 'lockNow') lockNow();
    else if (act === 'unlockoff') unlockOff();
    else if (act === 'exp') exportBackup();
    else if (act === 'imp') $('#impfile').click();
    else if (act === 'wipe') wipe();
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'obzone') ui.draft.zone = Number(t.value);
    else if (t.id === 'zone') { S.settings.zone = Number(t.value); save(); render(); toast('Zone mise à jour'); }
    else if (t.id === 'impfile') { const f = t.files && t.files[0]; t.value = ''; importBackup(f); }
  });

  document.addEventListener('input', (e) => {
    const id = e.target.dataset && e.target.dataset.note;
    if (id) { S.notes[id] = e.target.value.slice(0, 2000); saveSoon(); }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'pw') unlock(); });

  /* — Confidentialité : voile à l'arrière-plan, verrouillage automatique — */
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (session.key) document.body.classList.add('veil'); }
    else {
      document.body.classList.remove('veil');
      if (session.key && Date.now() - hiddenAt > 60000) lockNow();
      else if (!ui.locked) render();
    }
  });

  /* — Démarrage — */
  (function boot() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignoré */ }
    if (raw.get('vault')) { ui.locked = true; render(); return; }
    let parsed = null;
    try { parsed = JSON.parse(raw.get('data') || 'null'); } catch (e) { /* données illisibles : on repart de zéro */ }
    S = Core.sanitize(parsed);
    render();
  })();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignoré */ } });
  }
})();
