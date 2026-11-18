/* Moteur de calcul optique v2 : champ de vue, résolution, capteur, spécification d'objectif neutre,
   import de catalogue, matière, longueur d'onde et filtre.
   Longueurs en mm, sauf pixels et défauts en µm, longueurs d'onde en nm. */
(function (root) {
  'use strict';

  /* ---------- Traduction des textes affichés ----------
     Dans le navigateur, web/i18n.js expose self.I18N ; les textes passent par tr() au moment de l'appel.
     Sans I18N (Node, Deno), tr() rend le français source avec ses variables {k} remplies. */
  function fill(s, v) { return v ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m; }) : s; }
  function i18n() { return (typeof self !== 'undefined' && self.I18N && typeof self.I18N.t === 'function') ? self.I18N : null; }
  function tr(s, v) { var I = i18n(); return I ? I.t(s, v) : fill(s, v); }
  function dc(s) { var I = i18n(); return I && I.lang === 'en' ? String(s) : String(s).replace('.', ','); }

  /* ---------- Sources citées dans l'interface ---------- */
  var SRC = {
    basler: { t: 'Basler : sélection de l\'éclairage', u: 'https://www.baslerweb.com/en-us/learning/illumination-selection' },
    edmundF: { t: 'Edmund Optics : filtres en vision industrielle', u: 'https://www.edmundoptics.co.kr/resources/application-notes/imaging/filtering-in-machine-vision/' },
    edmundP: { t: 'Edmund Optics : polarisation de la lumière', u: 'https://www.edmundoptics.com.tw/resources/application-notes/illumination/successful-light-polarization-techniques/' },
    andover: { t: 'Andover : filtres passe-bande, décalage angulaire', u: 'https://andovercorp.com/optical-bandpass-filters-fundamentals/' },
    qmag: { t: 'Quality Magazine : éclairage et imagerie SWIR', u: 'https://www.qualitymag.com/articles/97669-the-power-of-swir-illumination-and-imaging' },
    vdocUV: { t: 'Vision Doctor : éclairage UV', u: 'https://www.vision-doctor.com/en/lighting/uv-illumination.html' },
    photonics: { t: 'Photonics : inspecter l\'acier chaud', u: 'https://photonics.com/Articles/Inspecting_hot_steel_in_a_new_light/a40630' },
    mvstore: { t: 'Machine Vision Store : prix des Basler ace 2 (USD)', u: 'https://machinevisionstore.com/Catalog/bycategoryfilter?categoryId=1&pageSize=12&pageIndex=2&filterValues=0%2C-1%2CAll+Resolutions%2C-1%2C-1' },
    framos: { t: 'FRAMOS : capteurs SWIR de Sony', u: 'https://framos.com/en/articles/introduction-to-sonys-swir-sensors-and-applications' }
  };

  /* ---------- Base capteurs (pages Basler, LUCID, Atik, Sony, FRAMOS) ---------- */
  var SENSORS = [
    { id: 'IMX174 / IMX249', fam: 'Pregius', w: 1920, h: 1200, p: 5.86, fmt: '1/1.2"', sh: 'global' },
    { id: 'IMX421 / IMX429', fam: 'Pregius (3e gén.)', w: 1936, h: 1464, p: 4.5, fmt: '2/3"', sh: 'global' },
    { id: 'IMX420 / IMX428', fam: 'Pregius (3e gén.)', w: 3208, h: 2200, p: 4.5, fmt: '1.1"', sh: 'global' },
    { id: 'IMX252 / IMX265', fam: 'Pregius', w: 2048, h: 1536, p: 3.45, fmt: '1/1.8"', sh: 'global' },
    { id: 'IMX250 / IMX264', fam: 'Pregius', w: 2448, h: 2048, p: 3.45, fmt: '2/3"', sh: 'global' },
    { id: 'IMX255 / IMX267', fam: 'Pregius', w: 4112, h: 2176, p: 3.45, fmt: '1"', sh: 'global' },
    { id: 'IMX253 / IMX304', fam: 'Pregius', w: 4112, h: 3008, p: 3.45, fmt: '1.1"', sh: 'global' },
    { id: 'IMX537 / IMX547', fam: 'Pregius S', w: 2448, h: 2048, p: 2.74, fmt: '1/1.8"', sh: 'global' },
    { id: 'IMX536 / IMX546', fam: 'Pregius S', w: 2840, h: 2840, p: 2.74, fmt: '2/3"', sh: 'global' },
    { id: 'IMX535 / IMX545', fam: 'Pregius S', w: 4096, h: 3000, p: 2.74, fmt: '1/1.1"', sh: 'global' },
    { id: 'IMX532 / IMX542', fam: 'Pregius S', w: 5320, h: 3040, p: 2.74, fmt: '1.1"', sh: 'global' },
    { id: 'IMX531 / IMX541', fam: 'Pregius S', w: 4504, h: 4504, p: 2.74, fmt: '1.1"', sh: 'global' },
    { id: 'IMX530 / IMX540', fam: 'Pregius S', w: 5320, h: 4600, p: 2.74, fmt: '1.2"', sh: 'global' },
    { id: 'IMX927 / IMX937', fam: 'Pregius S', w: 10272, h: 10272, p: 2.74, fmt: 'type 2.5', sh: 'global' },
    { id: 'IMX585', fam: 'Starvis 2', w: 3840, h: 2160, p: 2.9, fmt: '1/1.2"', sh: 'rolling' },
    { id: 'IMX533', fam: 'Exmor R', w: 3008, h: 3008, p: 3.76, fmt: '1"', sh: 'rolling' },
    { id: 'IMX492', fam: 'Exmor R', w: 8232, h: 5588, p: 2.315, fmt: '1.4"', sh: 'rolling' },
    { id: 'IMX571', fam: 'Exmor R', w: 6244, h: 4168, p: 3.76, fmt: 'APS-C', sh: 'rolling' },
    { id: 'IMX455', fam: 'Exmor R', w: 9576, h: 6388, p: 3.76, fmt: 'plein format', sh: 'rolling' },
    // SWIR (SenSWIR, 400 à 1700 nm), pixel 5 µm, obturateur global (FRAMOS)
    { id: 'IMX990', fam: 'SenSWIR', w: 1280, h: 1024, p: 5.0, fmt: '1/2"', sh: 'global', lo: 400, hi: 1700, swir: true },
    { id: 'IMX991', fam: 'SenSWIR', w: 640, h: 512, p: 5.0, fmt: '1/4"', sh: 'global', lo: 400, hi: 1700, swir: true }
  ];
  SENSORS.forEach(function (s) { if (s.lo == null) s.lo = 400; if (s.hi == null) s.hi = 1000; }); // silicium : jusqu'à environ 1 µm

  /* ---------- Matières et effets : longueurs d'onde conseillées ---------- */
  var COLOR_RULE = {
    rouge: { dark: 525, darkAlt: 'bleu 470 nm', bright: 630 },
    vert: { dark: 630, darkAlt: 'bleu 470 nm', bright: 525 },
    bleu: { dark: 630, darkAlt: 'vert 525 nm', bright: 470 },
    jaune: { dark: 470, darkAlt: '', bright: 610 }
  };
  var MATERIALS = [
    { id: 'general', grp: 'Général', label: 'Non précisée, usage général', lam: 550,
      bands: [{ lo: 400, hi: 700, role: 'Principale', why: 'Lumière visible. Avec une caméra monochrome, une lumière colorée choisie selon le contraste donne souvent mieux que le blanc.' }], src: ['basler'] },
    { id: 'color', grp: 'Général', label: 'Impression, étiquette, motif coloré', colorRule: true, src: ['basler'] },
    { id: 'metal', grp: 'Surfaces', label: 'Métal brillant, surface réfléchissante', lam: 550, pol: true,
      polWhy: 'Le défaut principal est le reflet spéculaire, pas la couleur : polariseur sur l\'éclairage et analyseur à 90° sur l\'objectif.',
      bands: [{ lo: 400, hi: 700, role: 'Principale', why: 'Lumière visible au choix ; la polarisation traite les reflets.' }], src: ['edmundP'] },
    { id: 'glass', grp: 'Surfaces', label: 'Verre ou plastique transparent (contraintes)', lam: 550, pol: true,
      polWhy: 'Polariseurs croisés : la contrainte interne du matériau (biréfringence) devient visible.',
      bands: [{ lo: 400, hi: 700, role: 'Principale', why: 'Lumière visible entre polariseurs croisés.' }], src: ['edmundP'] },
    { id: 'hot', grp: 'Procédé', label: 'Pièce chaude ou incandescente (acier chaud)', lam: 450, hot: true,
      bands: [{ lo: 400, hi: 500, role: 'Principale', why: 'Éclairer loin du spectre émis par la pièce chaude : le bleu est utilisé, parfois le vert ou le violet.' }], src: ['photonics'] },
    { id: 'fluo', grp: 'Ultraviolet', label: 'Colle, adhésif, mastic, encre UV (fluorescence)', lam: 365, filterKind: 'fluo',
      bands: [{ lam: 365, role: 'Excitation', why: 'UV-A à 365 nm : colles, cordons et mastics émettent une lumière visible bleutée ou verdâtre.' }], src: ['vdocUV'] },
    { id: 'pcb', grp: 'Ultraviolet', label: 'Circuit imprimé, soudure, fibre (détails fins)', lam: 365,
      bands: [{ lam: 365, role: 'Principale', why: 'L\'UV, davantage réfléchi, révèle petits défauts, poussières et rayures sur circuits, soudures et fibres.' }], src: ['vdocUV'] },
    { id: 'silicon', grp: 'Infrarouge court (SWIR)', label: 'Silicium (wafer, cellule : fissures internes)', lam: 1300, filterKind: 'swirlp', swirCut: 1100,
      bands: [{ lo: 1100, hi: 1700, role: 'Principale', why: 'Le silicium est transparent au-delà de 1100 nm : fissures, collages et défauts internes deviennent visibles.' }], src: ['qmag', 'framos'] },
    { id: 'water', grp: 'Infrarouge court (SWIR)', label: 'Eau, liquides, niveau de remplissage', lam: 1450,
      bands: [{ lam: 1450, role: 'Principale', why: 'L\'eau absorbe fortement vers 1450 nm et apparaît très sombre ; l\'isopropanol, l\'eau et l\'acétone se distinguent en SWIR.' }], src: ['qmag'] },
    { id: 'fruit', grp: 'Infrarouge court (SWIR)', label: 'Fruits (meurtrissures, humidité)', lam: 1450,
      bands: [{ lo: 1000, hi: 1700, role: 'Principale', why: 'Marques de pression et humidité ressortent en IR et SWIR ; 1450 nm est une valeur de travail (pic d\'absorption de l\'eau).' }], src: ['basler', 'qmag'] },
    { id: 'plastic', grp: 'Infrarouge court (SWIR)', label: 'Plastiques (tri, recyclage)', lam: 1300,
      bands: [{ lo: 1000, hi: 1700, role: 'Principale', why: 'Chaque plastique a sa propre signature SWIR. 1300 nm est une valeur de travail, à affiner sur les spectres de vos plastiques.' }], src: ['qmag'] },
    { id: 'powder', grp: 'Infrarouge court (SWIR)', label: 'Poudres blanches, corps étrangers alimentaires', lam: 1300,
      bands: [{ lo: 1000, hi: 1700, role: 'Principale', why: 'Sel, sucre et farine se ressemblent en couleur mais pas en SWIR ; métal, pierres et plastique ressortent. 1300 nm est une valeur de travail.' }], src: ['framos'] }
  ];

  /* ---------- Fonctions de base ---------- */
  function fmt(x, n) { return isFinite(x) ? x.toFixed(n) : '∞'; }
  function dims(s) {
    var W = s.w * s.p / 1000, H = s.h * s.p / 1000;
    return { W: W, H: H, D: Math.sqrt(W * W + H * H), mpx: s.w * s.h / 1e6 };
  }
  function nyquist(pUm) { return 1000 / (2 * pUm); }
  function cutoff(lambdaNm, nEff) { return 1e6 / (lambdaNm * nEff); }
  function mtfDiff(x) {
    if (x <= 0) return 1;
    if (x >= 1) return 0;
    return (2 / Math.PI) * (Math.acos(x) - x * Math.sqrt(1 - x * x));
  }
  function xForMtf(target) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (mtfDiff(mid) > target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function focalFor(wd, m) { return wd * m / (1 + m); }
  function magAt(f, wd) { return f / (wd - f); }
  function dof(f, N, c_mm, wd) {
    var H = f * f / (N * c_mm) + f;
    var near = wd * (H - f) / (H + wd - 2 * f);
    var far = wd >= H ? Infinity : wd * (H - f) / (H - wd);
    return { near: near, far: far, total: far - near, hyper: H };
  }
  // Décalage vers le bleu d'un filtre interférentiel à l'angle d'incidence th (rad), indice effectif nstar
  function blueShift(l0, th, nstar) {
    var x = Math.sin(th) / (nstar || 2);
    return l0 * (1 - Math.sqrt(1 - x * x));
  }

  /* ---------- Longueur d'onde retenue : contrainte imposée, sinon matière ---------- */
  function materialById(id) {
    for (var i = 0; i < MATERIALS.length; i++) if (MATERIALS[i].id === id) return MATERIALS[i];
    return MATERIALS[0];
  }
  function materialBands(mat, tcolor) {
    if (mat.colorRule) {
      var c = COLOR_RULE[tcolor] || COLOR_RULE.rouge;
      return [
        { lam: c.dark, role: tr('Assombrit le motif'), why: c.darkAlt ? tr('Une couleur complémentaire rend le motif plus sombre sur un fond clair (aussi {alt}). Valeurs de LED usuelles.', { alt: tr(c.darkAlt) }) : tr('Une couleur complémentaire rend le motif plus sombre sur un fond clair. Valeurs de LED usuelles.') },
        { lam: c.bright, role: tr('Éclaircit le motif'), why: tr('Une couleur proche de celle du motif le rend plus clair. Valeur de LED usuelle.') }
      ];
    }
    return mat.bands;
  }
  function resolveLambda(inp) {
    var mat = materialById(inp.material);
    var fw = inp.lamFwhm > 0 ? inp.lamFwhm : 25;
    var r = { mat: mat, fwhm: fw };
    if (inp.lamCons === 'source' && inp.lamC > 0) { r.lam = inp.lamC; r.from = tr('source imposée'); r.mode = 'source'; }
    else if (inp.lamCons === 'band' && inp.lamMax > inp.lamMin && inp.lamMin > 0) {
      r.lam = (inp.lamMin + inp.lamMax) / 2; r.fwhm = inp.lamMax - inp.lamMin; r.from = tr('plage imposée'); r.mode = 'band';
    } else {
      var b = materialBands(mat, inp.tcolor);
      r.lam = mat.colorRule ? b[0].lam : mat.lam;
      r.from = mat.id === 'general' ? tr('défaut (lumière visible)') : tr('matière');
      r.mode = 'material';
    }
    return r;
  }

  /* ---------- Capteurs ---------- */
  function evalSensor(s, inp) {
    var d = dims(s);
    var mA = Math.min(d.W / inp.fovH, d.H / inp.fovV);
    var mB = Math.min(d.H / inp.fovH, d.W / inp.fovV);
    var portrait = mB > mA * 1.0001;
    var m = portrait ? mB : mA;
    var kEff = inp.k * (inp.color ? 2 : 1);
    var ppd = inp.defect * m / s.p;
    var status = ppd >= kEff ? 'ok' : (ppd >= 0.75 * kEff ? 'limite' : 'insuffisant');
    var why = '';
    if (inp.globalOnly && s.sh !== 'global') why = tr('obturateur roulant');
    var lam = inp.lambda || 550;
    if (!why && lam > 1100 && !s.swir) why = tr('hors plage spectrale');
    if (!why && lam > 1700) why = tr('hors plage spectrale');
    return {
      sensor: s, dims: d, m: m, portrait: portrait, ppd: ppd, kEff: kEff, pixObj: s.p / m,
      status: status, excluded: !!why, why: why,
      fovH: (portrait ? d.H : d.W) / m, fovV: (portrait ? d.W : d.H) / m, nyq: nyquist(s.p)
    };
  }
  function requiredPixels(inp) {
    var kEff = inp.k * (inp.color ? 2 : 1);
    var nH = Math.ceil(inp.fovH * 1000 * kEff / inp.defect);
    var nV = Math.ceil(inp.fovV * 1000 * kEff / inp.defect);
    return { nH: nH, nV: nV, mpx: nH * nV / 1e6, kEff: kEff };
  }
  function rankSensors(inp) {
    var lam = inp.lambda || 550;
    var list = SENSORS.map(function (s) { return evalSensor(s, inp); });
    var order = { ok: 0, limite: 1, insuffisant: 2 };
    list.sort(function (a, b) {
      if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      var pa = (a.sensor.swir && lam <= 1000) ? 1 : 0, pb = (b.sensor.swir && lam <= 1000) ? 1 : 0;
      if (pa !== pb) return pa - pb;
      if (a.status === 'ok') return (a.dims.mpx - b.dims.mpx) || (b.sensor.p - a.sensor.p);
      return b.ppd - a.ppd;
    });
    return list;
  }

  /* ---------- Type d'objectif : standard, macro, télécentrique ---------- */
  var MACRO_M = 0.1, TELE_MAX_FOV = 250;
  var KIND_LABEL = { standard: 'Standard (focale fixe)', macro: 'Macro', telecentrique: 'Télécentrique' };
  function lensType(ev, inp) {
    var m = ev.m, fovMax = Math.max(inp.fovH, inp.fovV);
    var perr = inp.depth > 0 ? inp.fovH * inp.depth / inp.wd : 0;
    var perrPx = perr / (ev.pixObj / 1000);
    var meas = inp.task === 'mesure';
    var reasons = [], tele = false;
    if (meas && perrPx > 1) {
      tele = true;
      reasons.push({ t: 'info', m: tr('Mesure avec {d} mm de variation de hauteur : un objectif standard fait varier l\'échelle de {e} mm sur le champ, soit {px} pixels. Un télécentrique supprime cette erreur de perspective.', { d: fmt(inp.depth, 1), e: fmt(perr, 2), px: fmt(perrPx, 1) }) });
    }
    if (meas && inp.backlight) {
      tele = true;
      reasons.push({ t: 'info', m: tr('Mesure en contre-jour : un télécentrique donne des bords nets, sans effet de perspective (à associer à un contre-jour collimaté).') });
    }
    var kind, alt = [];
    if (tele && fovMax > TELE_MAX_FOV) {
      reasons.push({ t: 'warn', m: tr('Champ de {f} mm : un télécentrique doit avoir une lentille frontale plus grande que le champ, peu courant au-delà de {max} mm (seuil de travail du prototype). Objectif standard avec calibration, ou découpage du champ.', { f: fmt(fovMax, 0), max: TELE_MAX_FOV }) });
      kind = m > MACRO_M ? 'macro' : 'standard';
    } else if (tele) {
      kind = 'telecentrique';
      reasons.push({ t: 'info', m: tr('Grossissement fixe et distance de travail imposée par l\'objectif ; à choisir près de {m}× et de {wd} mm.', { m: fmt(m, 3), wd: fmt(inp.wd, 0) }) });
      alt.push(m > MACRO_M ? 'macro' : 'standard');
    } else if (m > MACRO_M) {
      kind = 'macro';
      reasons.push({ t: 'info', m: tr('Grossissement de {m}×, au-dessus de {lim}× : objectif macro, ou standard avec bague allonge (résolution et ouverture à vérifier). Seuil de travail du prototype.', { m: fmt(m, 3), lim: MACRO_M }) });
      alt.push('standard');
      if (meas) alt.push('telecentrique');
    } else {
      kind = 'standard';
      reasons.push({ t: 'info', m: tr('Grossissement de {m}×, jusqu\'à {lim}× : objectif standard à focale fixe.', { m: fmt(m, 3), lim: MACRO_M }) });
      if (meas && inp.depth > 0) reasons.push({ t: 'info', m: tr('Variation de hauteur faible ({px} px d\'erreur de perspective) : un standard calibré suffit.', { px: fmt(perrPx, 1) }) });
    }
    return { kind: kind, label: KIND_LABEL[kind], alt: alt, reasons: reasons, perr: perr, perrPx: perrPx };
  }

  /* ---------- Spécification d'objectif, sans marque ---------- */
  var STD_FOCALS = [4, 6, 8, 12, 16, 25, 35, 50, 75, 100, 135];
  function apertureWindow(ev, m, inp) {
    var coc = inp.cocPx * ev.sensor.p / 1000;
    var nMin = inp.depth > 0 ? inp.depth * m * m / (2 * coc * (1 + m)) : null;
    var x20 = xForMtf(0.2);
    var nEffMax = x20 * 1e6 / (inp.lambda * nyquist(ev.sensor.p));
    return { nMin: nMin, nMax: nEffMax / (1 + m) };
  }
  function lensSpec(ev, inp, lt) {
    var s = ev.sensor, d = ev.dims, m = ev.m, kEff = ev.kEff;
    var nuN = nyquist(s.p);
    var nuReq = 1000 / (2 * inp.defect * m);
    var pitchK = inp.defect * m / kEff;
    var nuK = Math.min(1000 / (2 * pitchK), nuN);
    var spec = {
      m: m, kind: lt.kind, kEff: kEff,
      nuN: nuN, nuReq: nuReq, nuK: nuK, pitchEq: 1000 / (2 * nuK), pitchSensor: s.p,
      objLpmm: 1000 / (2 * inp.defect),
      circleMin: d.D, inch: d.D / 16,
      win: apertureWindow(ev, m, inp),
      mpxSensor: d.mpx
    };
    if (lt.kind !== 'telecentrique') {
      spec.f = focalFor(inp.wd, m);
      var below = null, above = null;
      STD_FOCALS.forEach(function (f) { if (f <= spec.f) below = f; if (f >= spec.f && above == null) above = f; });
      spec.fBelow = below; spec.fAbove = above;
      var coc = inp.cocPx * s.p / 1000;
      spec.dof = dof(spec.f, inp.nom, coc, inp.wd);
    }
    var nEff = inp.nom * (1 + m);
    spec.nEff = nEff;
    spec.cutoff = cutoff(inp.lambda, nEff);
    spec.mtfNyq = mtfDiff(nuN / spec.cutoff);
    spec.mtfK = mtfDiff(nuK / spec.cutoff);
    return spec;
  }

  /* ---------- Catalogue d'objectifs : exemples génériques (sans marque) et import CSV ---------- */
  function minFocusMm(f) {
    if (f <= 16) return 100; if (f <= 25) return 150; if (f <= 35) return 200; if (f <= 50) return 300; if (f <= 75) return 500; return 800;
  }
  var DEMO_FAMILIES = [
    { circle: 9.0, pitch: 2.74, mount: 'C', focals: [6, 8, 12, 16, 25, 35, 50] },
    { circle: 11.0, pitch: 3.45, mount: 'C', focals: [6, 8, 12, 16, 25, 35, 50, 75] },
    { circle: 11.0, pitch: 2.74, mount: 'C', focals: [8, 12, 16, 25, 35, 50] },
    { circle: 17.6, pitch: 3.45, mount: 'C', focals: [8, 12, 16, 25, 35, 50, 75, 100] },
    { circle: 17.6, pitch: 2.74, mount: 'C', focals: [12, 16, 25, 35, 50, 75] },
    { circle: 22.0, pitch: 2.74, mount: 'C', focals: [16, 25, 35, 50, 75] },
    { circle: 43.0, pitch: 3.45, mount: 'F', focals: [28, 35, 50, 85, 100, 135] }
  ];
  var DEMO_CATALOG = [];
  DEMO_FAMILIES.forEach(function (fam) {
    fam.focals.forEach(function (f) {
      DEMO_CATALOG.push({
        ref: 'Exemple ' + f + ' mm, cercle ' + fam.circle + ' mm', brand: '', series: 'demo-' + fam.circle + '-' + fam.pitch, type: 'standard',
        f: f, mount: fam.mount, circle: fam.circle, pixmax: fam.pitch, res: nyquist(fam.pitch), fmin: 1.4, fmax: 16,
        wdmin: minFocusMm(f), wdmax: null, mag: null, demo: true
      });
    });
  });

  function strip(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  var ALIAS = {
    ref: ['ref', 'reference', 'pn', 'partnumber', 'part_number', 'modele', 'model'],
    brand: ['fabricant', 'marque', 'brand', 'manufacturer'],
    series: ['serie', 'series', 'gamme', 'famille'],
    type: ['type', 'categorie', 'category'],
    f: ['focale_mm', 'focale', 'f', 'focal_length', 'focal'],
    mount: ['monture', 'mount'],
    circle: ['cercle_image_mm', 'cercle_image', 'image_circle', 'image_circle_mm', 'cercle'],
    pixmax: ['pixel_max_um', 'pixel_max', 'pixel_um', 'pixel_size_um'],
    res: ['resolution_lpmm', 'lpmm', 'resolution', 'res_lpmm'],
    fmin: ['fnum_min', 'f_min', 'fno_min'],
    fmax: ['fnum_max', 'f_max', 'fno_max'],
    wdmin: ['wd_min_mm', 'wd_min'],
    wdmax: ['wd_max_mm', 'wd_max'],
    mag: ['grossissement', 'magnification', 'mag']
  };
  function splitLine(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (q) { if (c === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function toNum(v, commaDec) {
    if (v == null) return NaN;
    v = String(v).replace(/\s/g, '');
    if (v === '') return NaN;
    if (commaDec) v = v.replace(',', '.');
    return parseFloat(v);
  }
  var CSV_TEMPLATE =
    'ref;fabricant;serie;type;focale_mm;monture;cercle_image_mm;pixel_max_um;resolution_lpmm;fnum_min;fnum_max;wd_min_mm;wd_max_mm;grossissement\n' +
    'REF-001;Fabricant A;Serie 1;standard;25;C;11;3,45;;1,4;16;150;;\n' +
    'REF-002;Fabricant B;Serie 2;macro;50;C;17,6;;160;2,8;22;200;800;\n' +
    'REF-003;Fabricant C;Serie 3;telecentrique;;C;11;;120;;;110;110;0,25';
  function parseCatalog(text) {
    var res = { entries: [], errors: [], delimiter: ';' };
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 2) { res.errors.push(tr('Fichier vide ou sans ligne de données.')); return res; }
    var head = lines[0], best = ';', cnt = -1;
    [';', '\t', ','].forEach(function (d) { var c = head.split(d).length; if (c > cnt) { cnt = c; best = d; } });
    res.delimiter = best;
    var commaDec = best !== ',';
    var cols = splitLine(head, best).map(strip), idx = {};
    Object.keys(ALIAS).forEach(function (k) { idx[k] = -1; ALIAS[k].forEach(function (a) { var i = cols.indexOf(a); if (i >= 0 && idx[k] < 0) idx[k] = i; }); });
    if (idx.type < 0) res.errors.push(tr('Colonne « type » absente (standard, macro ou telecentrique).'));
    if (idx.f < 0 && idx.mag < 0) res.errors.push(tr('Colonne « focale_mm » ou « grossissement » absente.'));
    if (res.errors.length) return res;
    function get(parts, k) { return idx[k] >= 0 ? parts[idx[k]] : ''; }
    for (var li = 1; li < lines.length; li++) {
      var p = splitLine(lines[li], best), line = li + 1;
      var ts = strip(get(p, 'type'));
      var type = ts.indexOf('tele') === 0 ? 'telecentrique' : (ts.indexOf('macro') === 0 ? 'macro' : 'standard');
      var e = {
        ref: String(get(p, 'ref') || '').trim(), brand: String(get(p, 'brand') || '').trim(), series: String(get(p, 'series') || '').trim(),
        type: type, f: toNum(get(p, 'f'), commaDec), mount: String(get(p, 'mount') || '').trim(),
        circle: toNum(get(p, 'circle'), commaDec), pixmax: toNum(get(p, 'pixmax'), commaDec), res: toNum(get(p, 'res'), commaDec),
        fmin: toNum(get(p, 'fmin'), commaDec), fmax: toNum(get(p, 'fmax'), commaDec),
        wdmin: toNum(get(p, 'wdmin'), commaDec), wdmax: toNum(get(p, 'wdmax'), commaDec), mag: toNum(get(p, 'mag'), commaDec), demo: false
      };
      if (!isFinite(e.res) && isFinite(e.pixmax) && e.pixmax > 0) e.res = nyquist(e.pixmax);
      if (!isFinite(e.res)) e.res = null;
      ['circle', 'fmin', 'fmax', 'wdmin', 'wdmax'].forEach(function (k) { if (!isFinite(e[k])) e[k] = null; });
      if (!isFinite(e.pixmax)) e.pixmax = null;
      if (!e.series) e.series = (e.brand || '') + '|' + e.type + '|' + (e.circle || '') + '|' + (e.res ? Math.round(e.res) : '');
      if (type === 'telecentrique') {
        if (!(e.mag > 0)) { res.errors.push(tr('Ligne {n} : un télécentrique demande un grossissement.', { n: line })); continue; }
        if (!isFinite(e.f)) e.f = null;
      } else {
        if (!(e.f > 0)) { res.errors.push(tr('Ligne {n} : focale manquante.', { n: line })); continue; }
        e.mag = null;
      }
      if (!e.ref) e.ref = tr('Ligne {n}', { n: line });
      res.entries.push(e);
    }
    return res;
  }

  /* Évalue un objectif du catalogue pour un capteur et une distance de travail donnés */
  function evalEntry(ev, e, inp, wd) {
    var s = ev.sensor, d = ev.dims, out = { e: e, flags: [] };
    var W = ev.portrait ? d.H : d.W, H = ev.portrait ? d.W : d.H;
    var m;
    if (e.type === 'telecentrique') { m = e.mag; wd = e.wdmin || wd; }
    else { if (wd <= e.f * 1.02) { out.invalid = true; return out; } m = magAt(e.f, wd); }
    out.m = m; out.wd = wd;
    out.fovH = W / m; out.fovV = H / m;
    out.covers = out.fovH >= inp.fovH * 0.999 && out.fovV >= inp.fovV * 0.999;
    out.marginH = out.fovH / inp.fovH - 1;
    out.nEff = inp.nom * (1 + m);
    out.cutoff = cutoff(inp.lambda, out.nEff);
    out.nyq = nyquist(s.p);
    out.mtfNyq = mtfDiff(out.nyq / out.cutoff);
    out.res = e.res;
    var nuReq = 1000 / (2 * inp.defect * m);
    var nuK = Math.min(1000 / (2 * (inp.defect * m / ev.kEff)), out.nyq);
    out.nuReq = nuReq; out.nuK = nuK;
    if (e.res == null) { out.verdict = 'inconnu'; out.pxEff = null; out.ppdEff = ev.inpPpd; }
    else {
      out.pxEff = 1000 / (2 * e.res);
      var used = Math.max(s.p, out.pxEff);
      out.ppdEff = inp.defect * m / used;
      out.mpxResolved = (ev.dims.W * 1000 / used) * (ev.dims.H * 1000 / used) / 1e6;
      out.verdict = e.res >= out.nyq ? 'plein' : (e.res >= nuK ? 'suffisant' : (e.res >= nuReq ? 'limite' : 'insuffisant'));
    }
    if (e.f && e.type !== 'telecentrique') out.dof = dof(e.f, inp.nom, inp.cocPx * s.p / 1000, wd);
    if (e.circle != null && e.circle < d.D) out.flags.push({ t: 'bad', m: tr('Cercle d\'image ({c} mm) plus petit que la diagonale du capteur ({d} mm) : vignetage.', { c: fmt(e.circle, 1), d: fmt(d.D, 1) }) });
    else if (e.circle != null && e.circle < d.D * 1.03) out.flags.push({ t: 'warn', m: tr('Cercle d\'image à peine suffisant : vérifier l\'éclairement dans les coins.') });
    if (e.circle == null) out.flags.push({ t: 'warn', m: tr('Cercle d\'image non renseigné : compatibilité avec le capteur non vérifiée.') });
    if (e.res == null) out.flags.push({ t: 'warn', m: tr('Résolution non renseignée : verdict impossible.') });
    if (e.type !== 'telecentrique') {
      if (e.wdmin != null && wd < e.wdmin) out.flags.push({ t: 'warn', m: tr('Distance de travail sous la mise au point minimale ({v} mm) : bague allonge ou macro.', { v: fmt(e.wdmin, 0) }) });
      if (e.wdmax != null && wd > e.wdmax) out.flags.push({ t: 'warn', m: tr('Distance de travail au-delà de la plage ({v} mm).', { v: fmt(e.wdmax, 0) }) });
    } else if (Math.abs(wd - inp.wd) > 0.1 * inp.wd) out.flags.push({ t: 'warn', m: tr('Distance de travail imposée de {a} mm, contre {b} mm demandés.', { a: fmt(wd, 0), b: fmt(inp.wd, 0) }) });
    if (e.fmin != null && inp.nom < e.fmin) out.flags.push({ t: 'warn', m: tr('Ouverture f/{n} plus ouverte que le minimum de l\'objectif (f/{v}).', { n: inp.nom, v: e.fmin }) });
    if (e.fmax != null && inp.nom > e.fmax) out.flags.push({ t: 'warn', m: tr('Ouverture f/{n} plus fermée que le maximum de l\'objectif (f/{v}).', { n: inp.nom, v: e.fmax }) });
    if (out.mtfNyq < 0.2) out.flags.push({ t: 'warn', m: tr('Diffraction : contraste théorique au Nyquist {p} % (<20 %). Ouvrir le diaphragme.', { p: Math.round(out.mtfNyq * 100) }) });
    if (inp.depth > 0 && out.dof && out.dof.total < inp.depth) out.flags.push({ t: 'warn', m: tr('Profondeur de champ ({a} mm) inférieure à la variation de hauteur ({b} mm).', { a: fmt(out.dof.total, 1), b: inp.depth }) });
    if (inp.speed > 0) {
      out.blur = inp.speed * inp.exposure * 1e-6 / ((s.p / m) / 1000);
      if (out.blur > 0.5) out.flags.push({ t: 'warn', m: tr('Flou de bougé {b} px (>0,5 px) : réduire l\'exposition ou stroboscoper.', { b: out.blur.toFixed(2) }) });
    }
    return out;
  }

  /* Objectifs du catalogue qui conviennent : au type conseillé (ou à ses alternatives), couvrant le champ à votre distance,
     ou à une distance proche. Une carte par série. */
  function matchCatalog(ev, inp, catalog, kinds, wdTol) {
    var d = ev.dims, tol = wdTol == null ? 0.15 : wdTol, groups = {}, out = [];
    ev.inpPpd = ev.ppd;
    catalog.forEach(function (e) {
      if (kinds && kinds.indexOf(e.type) < 0) return;
      if (e.circle != null && e.circle < d.D * 0.97) return;
      if (e.type === 'telecentrique') {
        var r = evalEntry(ev, e, inp, inp.wd);
        if (!r.invalid && r.covers && r.ppdEff >= 0.75 * ev.kEff * 0.75) out.push(r);
        return;
      }
      (groups[e.series] = groups[e.series] || []).push(e);
    });
    Object.keys(groups).forEach(function (k) {
      var best = null, bestAdj = null;
      groups[k].forEach(function (e) {
        var r = evalEntry(ev, e, inp, inp.wd);
        if (r.invalid) return;
        if (r.covers && r.ppdEff >= 0.75 * ev.kEff) { if (!best || r.marginH < best.marginH) best = r; return; }
        var wdNeed = e.f * (1 + ev.m) / ev.m;
        var dev = Math.abs(wdNeed - inp.wd) / inp.wd;
        if (dev <= tol && (e.wdmin == null || wdNeed >= e.wdmin) && (e.wdmax == null || wdNeed <= e.wdmax)) {
          var ra = evalEntry(ev, e, inp, wdNeed);
          if (!ra.invalid) { ra.adjWd = wdNeed; ra.adjDelta = wdNeed - inp.wd; if (!bestAdj || dev < bestAdj.dev) { ra.dev = dev; bestAdj = ra; } }
        }
      });
      if (best) out.push(best); else if (bestAdj) out.push(bestAdj);
    });
    var vo = { plein: 0, suffisant: 1, inconnu: 2, limite: 3, insuffisant: 4 };
    out.sort(function (a, b) {
      var ba = a.flags.filter(function (x) { return x.t === 'bad'; }).length, bb = b.flags.filter(function (x) { return x.t === 'bad'; }).length;
      if (ba !== bb) return ba - bb;
      if (vo[a.verdict] !== vo[b.verdict]) return vo[a.verdict] - vo[b.verdict];
      var da = a.adjWd ? 1 : 0, db = b.adjWd ? 1 : 0;
      if (da !== db) return da - db;
      return (a.adjWd ? a.dev - b.dev : a.marginH - b.marginH);
    });
    // regroupe les références de même spécification : aucune marque n'est mise en avant
    var merged = [], seen = {};
    out.forEach(function (r) {
      var e = r.e, key = [e.type, e.f, e.mag, e.res ? Math.round(e.res) : '', e.circle, r.adjWd ? Math.round(r.adjWd) : ''].join('|');
      if (seen[key]) { seen[key].refs.push(e); return; }
      r.refs = [e]; seen[key] = r; merged.push(r);
    });
    return merged;
  }

  /* ---------- Longueur d'onde, filtre, polarisation ---------- */
  function lightAdvice(inp, ev, lensKind, lr) {
    var mat = lr.mat, lam = lr.lam, fw = lr.fwhm, A = { lam: lam, from: lr.from, mat: mat, flags: [], notes: [], src: (mat.src || []).slice() };
    A.bands = materialBands(mat, inp.tcolor);
    A.fwhm = fw;
    var nstar = inp.nstar > 1 ? inp.nstar : 2;
    var diag = Math.sqrt(inp.fovH * inp.fovH + inp.fovV * inp.fovV);
    var th = lensKind === 'telecentrique' ? 0 : Math.atan(diag / 2 / inp.wd);
    A.thetaDeg = th * 180 / Math.PI;
    A.telecentric = lensKind === 'telecentrique';
    function sh(l) { return blueShift(l, th, nstar); }
    A.shift = sh(lam);

    // compatibilité capteur et optique
    var s = ev.sensor;
    if (lam > 1700) A.flags.push({ t: 'bad', m: tr('Au-delà de 1700 nm : hors de la plage SWIR traitée par ce prototype.') });
    else if (lam > 1100) A.flags.push({ t: 'warn', m: tr('Au-delà de 1100 nm : capteur SWIR requis (la gamme SenSWIR couvre 400 à 1700 nm). Objectif et éclairage prévus pour cette bande.') });
    else if (lam > 1000) A.flags.push({ t: 'warn', m: tr('Entre 1000 et 1100 nm : limite du silicium (sensibilité vers 1 µm), rendement faible.') });
    else if (lam >= 700) A.flags.push({ t: 'info', m: tr('Proche infrarouge : prévoir un objectif traité pour cette bande (décalage de mise au point). Capteur monochrome, car les capteurs couleur portent un filtre IR-cut.') });
    if (lam < 370) A.flags.push({ t: 'bad', m: tr('Sous 370 nm : les capteurs CMOS standard ne répondent plus. Capteur UV dédié et optique en quartz nécessaires (un capteur Pregius S de la gamme UV couvre environ 200 à 1000 nm).') });
    else if (lam < 400) A.flags.push({ t: 'warn', m: tr('Entre 370 et 400 nm : sensibilité réduite, et les objectifs standard et leurs vitres absorbent une grande part des UV. Optique compatible UV à vérifier.') });
    if (inp.color && lam >= 700) A.flags.push({ t: 'warn', m: tr('Capteur couleur coché : son filtre IR-cut bloque cette bande. Choisir un capteur monochrome.') });
    if (s.swir === true && lam <= 1000) A.flags.push({ t: 'info', m: tr('Capteur SWIR sélectionné alors que la bande reste visible : un capteur silicium convient et coûte moins.') });

    // recoupement avec la matière, quand une contrainte est imposée
    if (lr.mode !== 'material' && mat.id !== 'general') {
      var inBand = A.bands.some(function (b) { return b.lam != null ? Math.abs(lam - b.lam) <= 40 : (lam >= b.lo && lam <= b.hi); });
      if (!inBand) A.flags.push({ t: 'warn', m: tr('Votre longueur d\'onde ({l} nm) est hors des bandes conseillées pour cette matière : vérifier le contraste par un essai.', { l: fmt(lam, 0) }) });
    }

    // filtre
    var F = { need: 'optionnel' }, kind = mat.filterKind || 'bandpass';
    if (lr.mode === 'band') kind = 'bandpass';
    if (lam < 400 && kind === 'bandpass' && mat.id !== 'pcb' && lr.mode === 'source') kind = 'fluo';
    if (kind === 'fluo') {
      var x0 = lam + fw / 2;
      F.kind = 'longpass'; F.name = tr('Passe-haut');
      F.cut = x0 + sh(x0);
      F.text = tr('Placé sur la caméra, il bloque la lumière UV d\'excitation et laisse passer la fluorescence visible. Coupure à {cut} nm minimum : borne haute de la source ({x0} nm) plus le décalage vers le bleu en bord de champ ({sh} nm).', { cut: fmt(F.cut, 0), x0: fmt(x0, 0), sh: fmt(sh(x0), 1) });
      F.need = 'recommandé';
      A.notes.push(tr('Si l\'UV sert en réflexion et non en fluorescence, un passe-bande centré sur la source remplace le passe-haut.'));
    } else if (kind === 'swirlp') {
      var c0 = mat.swirCut;
      F.kind = 'longpass'; F.name = tr('Passe-haut');
      F.cut = c0 + sh(c0);
      F.text = tr('Il ne laisse passer que l\'infrarouge où le silicium est transparent. Coupure à {cut} nm minimum (1100 nm plus le décalage de bord de champ).', { cut: fmt(F.cut, 0) });
      F.need = 'recommandé';
    } else {
      F.kind = 'bandpass'; F.name = tr('Passe-bande');
      F.c0 = lam + A.shift / 2;
      F.bmin = fw + A.shift;
      F.text = tr('Centré à {c0} nm, largeur à mi-hauteur de {b} nm au minimum : largeur de la source ({fw} nm) plus le décalage vers le bleu en bord de champ ({sh} nm). Arrondir à la largeur de catalogue supérieure, puis ajouter la tolérance de la fiche du filtre.', { c0: fmt(F.c0, 0), b: fmt(F.bmin, 0), fw: fmt(fw, 0), sh: fmt(A.shift, 1) });
      if (lr.mode !== 'material' || mat.hot || lam < 400 || lam > 1000) F.need = 'recommandé';
      if (mat.hot) A.notes.push(tr('Ajouter un filtre thermique et un passe-bande : seule la lumière réfléchie de la source doit atteindre la caméra, pas le rayonnement de la pièce chaude.'));
    }
    if (inp.ambient === 'forte') {
      F.need = 'recommandé';
      A.notes.push(tr('Lumière ambiante forte : filtre au plus près de la largeur minimale, éclairage dominant et exposition courte. Une densité optique de 4 dépasse le besoin de la plupart des applications.'));
    } else if (F.need === 'optionnel') {
      A.notes.push(tr('Ambiance maîtrisée : le filtre est optionnel. Il devient utile dès que la lumière du jour ou un éclairage d\'atelier entre dans le champ.'));
    }
    if (A.telecentric) A.notes.push(tr('Objectif télécentrique côté objet : les rayons arrivent presque parallèles à l\'axe, le décalage angulaire du filtre est négligeable.'));
    else if (A.thetaDeg > 15) A.flags.push({ t: 'warn', m: tr('Angle de champ de {a}° : la formule de décalage est donnée pour 15° au plus (Andover). Élargir la bande, ou prendre un verre coloré, insensible à l\'angle mais à bandes plus larges.', { a: fmt(A.thetaDeg, 0) }) });
    if (F.kind === 'bandpass' && F.bmin && lr.mode === 'band' && A.shift > 0.2 * fw) A.flags.push({ t: 'warn', m: tr('Le décalage de {sh} nm dépasse 20 % de votre plage de {fw} nm : en bord de champ, une partie de la plage sera coupée.', { sh: fmt(A.shift, 1), fw: fmt(fw, 0) }) });
    F.need = tr(F.need);
    A.filter = F;
    A.filterNstar = nstar;

    // polarisation
    var pol = { use: !!(mat.pol || inp.glare) };
    if (pol.use) {
      pol.text = tr(mat.polWhy || 'Reflets spéculaires : polariseur sur l\'éclairage et analyseur croisé à 90° sur l\'objectif.') + tr(' Compter environ 50 % de lumière perdue en théorie, 60 à 65 % en pratique : compenser par l\'éclairage ou l\'exposition.');
      A.src.push('edmundP');
    }
    A.pol = pol;
    if (lr.mode === 'material' && mat.colorRule) A.notes.push(tr('Les longueurs d\'onde sont des valeurs de LED usuelles. Avec une caméra monochrome, vérifier par un essai sur la pièce réelle.'));
    A.src.push('edmundF', 'andover');
    A.src = A.src.filter(function (k, i, a) { return a.indexOf(k) === i; });
    return A;
  }


  /* ---------- Chiffrage indicatif des caméras (prix catalogue USD, caméras mono USB3 Basler ace 2, revendeur US) ---------- */
  var PRICE_POINTS = [
    { w: 1920, h: 1200, sh: 'global', usd: 359 }, { w: 2600, h: 2160, sh: 'global', usd: 569 }, { w: 2448, h: 2048, sh: 'global', usd: 669 },
    { w: 2840, h: 2840, sh: 'global', usd: 809 }, { w: 4200, h: 2160, sh: 'global', usd: 789 }, { w: 4096, h: 3000, sh: 'global', usd: 1209 },
    { w: 5320, h: 3032, sh: 'global', usd: 1539 }, { w: 4504, h: 4504, sh: 'global', usd: 1939 }, { w: 5328, h: 4608, sh: 'global', usd: 2359 },
    { w: 2592, h: 1944, sh: 'rolling', usd: 309 }, { w: 3840, h: 2160, sh: 'rolling', usd: 339 }
  ];
  var PRICE_SPREAD = 0.25;
  function roundPrice(v) { return v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50; }
  function estimatePrice(s) {
    if (s.swir) return { quote: true, why: tr('Caméra SWIR : prix non publics, demander un devis.') };
    var mpx = s.w * s.h / 1e6, pts = PRICE_POINTS.filter(function (p) { return p.sh === s.sh; }).map(function (p) { return { m: p.w * p.h / 1e6, usd: p.usd }; }).sort(function (a, b) { return a.m - b.m; });
    var mid = null, basis = '';
    pts.forEach(function (p) { if (mid == null && Math.abs(p.m / mpx - 1) <= 0.03) { mid = p.usd; basis = tr('caméra de même résolution relevée'); } });
    if (mid == null) {
      for (var i = 0; i < pts.length - 1; i++) {
        if (mpx > pts[i].m && mpx < pts[i + 1].m) { mid = pts[i].usd + (pts[i + 1].usd - pts[i].usd) * (mpx - pts[i].m) / (pts[i + 1].m - pts[i].m); basis = tr('interpolé entre deux caméras relevées'); }
      }
    }
    if (mid == null) return { quote: true, why: tr('Hors des prix relevés ({r}) : demander un devis.', { r: s.sh === 'rolling' ? tr('obturateur roulant au-delà de 8 Mpx') : tr('résolution hors plage') }) };
    mid = roundPrice(mid);
    return { usd: mid, lo: roundPrice(mid * (1 - PRICE_SPREAD)), hi: roundPrice(mid * (1 + PRICE_SPREAD)), basis: basis };
  }

  /* ---------- Montures d'objectif et références IMX hors base ---------- */
  var MOUNTS = [
    { id: 'm8', label: 'M8', thread: 'M8 × 0,35 ou × 0,5', flange: null, diagStd: 6.7, diagExt: null, fr: [1.5, 6], ext: 'Pas d\'allonge standard : choisir un objectif conçu pour la distance voulue.', note: 'Caméras très compactes, capteurs jusqu\'à 1/2,7" environ.' },
    { id: 's', label: 'S-mount (M12)', thread: 'M12 × 0,5', flange: null, diagStd: 8.9, diagExt: 11, fr: [2.5, 25], ext: 'Pas d\'allonge standard : la mise au point se fait en vissant l\'objectif. Bloquer le réglage une fois terminé.', note: 'Capteurs jusqu\'à 1/1,8" ; quelques objectifs couvrent le 2/3". Le tirage n\'est pas normalisé : il est propre à chaque objectif.' },
    { id: 'cs', label: 'CS', thread: 'filetage 1"-32 UN', flange: 12.526, diagStd: 16, diagExt: null, fr: [2.8, 50], ext: 'Allonges C/CS disponibles. Un objectif C se monte sur une caméra CS avec une bague de 5 mm ; l\'inverse est impossible.', note: 'Caméras compactes, capteurs jusqu\'à 1".' },
    { id: 'c', label: 'C', thread: 'filetage 1"-32 UN', flange: 17.526, diagStd: 16, diagExt: 22, fr: [4, 100], ext: 'Bagues allonge standard et lentilles additionnelles disponibles.', note: 'Monture la plus répandue. Au-delà de 1", il faut des objectifs C grand format (cercle d\'image jusqu\'à ≈ 22 mm environ).' },
    { id: 'tfl', label: 'TFL', thread: 'M35 × 0,75', flange: 17.526, diagStd: 27.9, diagExt: null, fr: [8, 75], ext: 'Allonges propres à cette monture.', note: 'Même tirage que la monture C, pour des capteurs jusqu\'à APS-C (27,9 mm).' },
    { id: 'f', label: 'F (Nikon)', thread: 'baïonnette de 44 mm', flange: 46.5, diagStd: 43.3, diagExt: null, fr: [20, 200], ext: 'Bagues allonge et soufflets F disponibles. Pas de réglage du tirage.', note: 'Grands capteurs, plein format et caméras linéaires (cercle d\'image d\'au moins 43 mm).' },
    { id: 'm42', label: 'M42 × 1', thread: 'M42 × 1', flange: 45.5, diagStd: 30, diagExt: null, fr: [20, 100], ext: 'Bagues allonge M42 courantes.', note: 'Grands capteurs et caméras linéaires. Tirage de 45,46 ou 45,5 mm selon le constructeur. Filetage incompatible avec le T2.' },
    { id: 't2', label: 'T-mount (T2)', thread: 'M42 × 0,75', flange: 55, diagStd: null, diagExt: null, fr: null, ext: 'Bagues et bagues-allonge T2 courantes.', note: 'Capteurs plus grands et haute résolution ; tirage de 55 mm. Le cercle d\'image dépend de l\'objectif.' },
    { id: 'm58', label: 'M58 × 0,75', thread: 'M58 × 0,75', flange: null, diagStd: null, diagExt: null, fr: null, ext: 'Adaptateurs M58 vers M72 courants.', note: 'Caméras linéaires et très grands capteurs. Tirage propre à chaque fabricant : à confirmer.' },
    { id: 'm72', label: 'M72 × 0,75', thread: 'M72 × 0,75', flange: null, diagStd: null, diagExt: null, fr: null, ext: 'Adaptateurs M72 vers M58 courants.', note: 'Caméras linéaires 8k à 16k et très grands capteurs. Tirage propre à chaque fabricant : à confirmer.' },
    { id: 'ef', label: 'Canon EF', thread: 'baïonnette', flange: 44, diagStd: 43.3, diagExt: null, fr: [14, 200], ext: 'Bagues allonge EF disponibles.', note: 'Objectifs photo grand public, cercle d\'image plein format.' },
    { id: 'e', label: 'Sony E', thread: 'baïonnette', flange: 18, diagStd: 43.3, diagExt: null, fr: [10, 200], ext: 'Allonges E disponibles.', note: 'Caméras compactes plein format et APS-C, objectifs photo.' },
    { id: 'z', label: 'Nikon Z', thread: 'baïonnette', flange: 16, diagStd: 43.3, diagExt: null, fr: [14, 200], ext: 'Adaptateurs disponibles.', note: 'Tirage court, nombreuses bagues d\'adaptation (dont F).' },
    { id: 'mft', label: 'Micro 4/3', thread: 'baïonnette', flange: 19.25, diagStd: 21.6, diagExt: null, fr: [7, 300], ext: 'Bagues allonge MFT disponibles.', note: 'Capteurs jusqu\'au format 4/3 (21,6 mm de diagonale).' },
    { id: 'other', label: 'Autre ou sur mesure', thread: 'à préciser', flange: null, diagStd: null, diagExt: null, fr: null, ext: 'À définir avec le fabricant de la caméra.', note: 'Donner le tirage et le cercle d\'image à l\'objectif demandé.' }
  ];
  var IMX_EXTRA = [
    { id: 'IMX290 / IMX291', fam: 'Starvis', w: 1920, h: 1080, p: 2.9, fmt: '1/2.8"', sh: 'rolling' },
    { id: 'IMX296', fam: 'Pregius', w: 1456, h: 1088, p: 3.45, fmt: '1/2.9"', sh: 'global' },
    { id: 'IMX273', fam: 'Pregius', w: 1440, h: 1080, p: 3.45, fmt: '1/2.9"', sh: 'global' },
    { id: 'IMX392', fam: 'Pregius', w: 1920, h: 1200, p: 3.45, fmt: '1/2.3"', sh: 'global' }
  ];
  function mountById(id) { for (var i = 0; i < MOUNTS.length; i++) if (MOUNTS[i].id === id) return MOUNTS[i]; return null; }
  function findSensor(q) {
    q = String(q || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^IMX\d+/.test(q)) return null;
    var all = SENSORS.concat(IMX_EXTRA), out = null;
    all.forEach(function (s) {
      s.id.toUpperCase().split('/').forEach(function (part) {
        var id = part.replace(/[^A-Z0-9]/g, '');
        if (!out && id && q.indexOf(id) === 0 && /^[A-Z]*$/.test(q.slice(id.length))) out = s;
      });
    });
    return out;
  }
  function mountAdvice(R, mountId, tubeAcc) {
    var diag = R.dims.D, M = { flags: [], rec: [] };
    var rule = diag <= 9 ? ['s', 'cs', 'c'] : diag <= 16 ? ['c', 'cs'] : diag <= 22 ? ['c'] : diag <= 28.5 ? ['tfl', 'm42', 'f'] : diag <= 44 ? ['f', 'm42', 't2', 'm58', 'm72'] : ['m58', 'm72'];
    M.rec = rule.map(mountById);
    var dg = { d: fmt(diag, 1) };
    M.recText = diag <= 9 ? tr('Capteur de {d} mm de diagonale : S-mount (M12), CS ou C.', dg) :
      diag <= 16 ? tr('Capteur de {d} mm de diagonale : monture C ou CS.', dg) :
      diag <= 22 ? tr('Capteur de {d} mm de diagonale : monture C avec un objectif grand format (cercle d\'image d\'au moins {d} mm).', dg) :
      diag <= 28.5 ? tr('Capteur de {d} mm de diagonale : TFL, M42 ou F.', dg) :
      diag <= 44 ? tr('Capteur de {d} mm de diagonale : F, M42, T2, M58 ou M72.', dg) :
      tr('Capteur de {d} mm de diagonale, très grand : M58 ou M72, avec un objectif conçu pour ce format.', dg);
    var m = mountId && mountId !== 'none' ? mountById(mountId) : null;
    M.chosen = m;
    if (!m) return M;
    var lim = m.diagExt || m.diagStd;
    if (lim != null) {
      if (diag > lim * 1.02) M.flags.push({ t: 'bad', m: tr('Capteur trop grand pour cette monture : diagonale de {d} mm contre {l} mm environ. Vignetage assuré dans les coins.', { d: fmt(diag, 1), l: fmt(lim, 1) }) });
      else if (m.diagExt && diag > m.diagStd) M.flags.push({ t: 'warn', m: tr('Diagonale de {d} mm : au-delà du format courant de cette monture ({s} mm). Choisir un objectif grand format dont le cercle d\'image dépasse {d} mm.', { d: fmt(diag, 1), s: fmt(m.diagStd, 1) }) });
      else M.flags.push({ t: 'good', m: tr('Le capteur ({d} mm de diagonale) entre dans le format de cette monture.', dg) });
      if (diag < lim * 0.35) M.flags.push({ t: 'info', m: tr('Monture surdimensionnée pour ce capteur : encombrement et coût inutiles. {rec}', { rec: M.recText }) });
    } else M.flags.push({ t: 'info', m: tr('Cercle d\'image maximal non renseigné pour cette monture : le demander au fabricant de l\'objectif.') });
    if (m.fr && R.lt.kind !== 'telecentrique') {
      if (R.fNeed < m.fr[0] * 0.8 || R.fNeed > m.fr[1] * 1.2) M.flags.push({ t: 'warn', m: tr('Focale de ≈ {f} mm peu courante dans cette monture (plage usuelle {a} à {b} mm, valeur de travail). Vérifier l\'offre ou changer de monture.', { f: fmt(R.fNeed, 1), a: m.fr[0], b: m.fr[1] }) });
    }
    if (m.id === 'c' && R.rec && R.rec.f < 8) M.flags.push({ t: 'info', m: tr('Courtes focales en monture C : objectifs plus encombrants qu\'en S-mount, mais plus stables mécaniquement.') });
    // tubeAcc : un accessoire d'allonge ou de lentille additionnelle est proposé (calculé avant traduction des noms)
    if (R.rec && (R.rec.tube > 0.3 || R.lt.kind === 'macro' || (tubeAcc != null ? tubeAcc : R.acc.some(function (a) { return /allonge|additionnelle/i.test(a.n); })))) M.flags.push({ t: 'info', m: tr('Allonges : {ext}', { ext: tr(m.ext) }) });
    M.flags.push({ t: 'info', m: (m.flange != null ? tr('Tirage de {t} mm : l\'objectif et la caméra doivent avoir le même tirage. ', { t: dc(String(parseFloat(m.flange.toFixed(3)))) }) : tr('Tirage non normalisé : à confirmer avec le fabricant. ')) + tr(m.note) });
    return M;
  }

  /* ---------- Conseil d'optique à partir d'un capteur saisi (2e calculateur) ---------- */
  var FOCAL_STD = [4, 6, 8, 12, 16, 25, 35, 50, 75, 100];
  var FOCAL_MAX_STD = 100, DIST_SHORT = 0.01, DIST_LONG = 0.003;  // distorsion de travail : f < 16 mm 1 %, sinon 0,3 %
  function adviseOptic(s) {
    var sensor = { id: 'Capteur saisi', w: s.sw, h: s.sh, p: s.p, sh: 'global' };
    var d = dims(sensor), meas = s.task === 'mesure', k = s.k > 0 ? s.k : 3, subdiv = s.subdiv > 0 ? s.subdiv : 1;
    var reqPix = meas ? s.prec * subdiv : s.defect / k;               // taille maximale du pixel côté objet, µm
    var inp = { fovH: s.fovH, fovV: s.fovV, wd: s.wd, depth: s.depth || 0, defect: reqPix * k, k: k, color: false, globalOnly: false,
      nom: s.nom, lambda: s.lambda || 550, cocPx: s.cocPx || 2, task: s.task, backlight: !!s.backlight, speed: 0, exposure: 0 };
    var ev = evalSensor(sensor, inp), flags = [], notes = [];
    var W = ev.portrait ? d.H : d.W, H = ev.portrait ? d.W : d.H, nW = ev.portrait ? s.sh : s.sw, nH = ev.portrait ? s.sw : s.sh;
    var R = { meas: meas, sensor: sensor, dims: d, ev: ev, inp: inp, reqPix: reqPix, pixObj: ev.pixObj, k: k, subdiv: subdiv };
    R.ratio = reqPix / ev.pixObj;
    R.status = R.ratio >= 1 ? 'ok' : (R.ratio >= 0.8 ? 'limite' : 'insuffisant');
    R.capab = meas ? ev.pixObj / subdiv : ev.pixObj * k;               // précision ou plus petit défaut atteints, µm
    R.need = { nH: Math.ceil(s.fovH * 1000 / reqPix), nV: Math.ceil(s.fovV * 1000 / reqPix) };
    R.need.mpx = R.need.nH * R.need.nV / 1e6;
    R.have = { nH: nW, nV: nH };
    R.fovMax = { H: nW * reqPix / 1000, V: nH * reqPix / 1000 };         // plus grand champ tenable avec ce capteur
    R.m = ev.m;
    var lt = lensType(ev, inp);
    // distorsion : peut imposer le télécentrique en mesure précise
    var fNeed = focalFor(s.wd, ev.m), fovMaxDim = Math.max(s.fovH, s.fovV);
    var dist = fNeed < 16 ? DIST_SHORT : DIST_LONG;
    R.distErr = dist * fovMaxDim / 2 * 1000;                              // µm en bord de champ
    R.distPct = dist * 100;
    if (meas && R.distErr > s.prec && lt.kind !== 'telecentrique') {
      if (fovMaxDim <= TELE_MAX_FOV) {
        lt = { kind: 'telecentrique', label: KIND_LABEL.telecentrique, alt: ['standard'], perr: lt.perr, perrPx: lt.perrPx, reasons: lt.reasons.concat([{ t: 'info', m: tr('Distorsion d\'un objectif standard estimée à {p} % : {e} µm en bord de champ, au-dessus de la précision visée ({prec} µm). Un télécentrique (distorsion typique sous 0,1 %) évite ce défaut. Un standard exige une calibration soignée.', { p: fmt(R.distPct, 1), e: fmt(R.distErr, 0), prec: fmt(s.prec, 0) }) }]) };
      } else {
        flags.push({ t: 'warn', m: tr('Distorsion estimée de {e} µm en bord de champ, au-dessus de la précision visée. Champ trop grand pour un télécentrique : calibration par mire et correction de distorsion obligatoires.', { e: fmt(R.distErr, 0) }) });
      }
    } else if (meas && lt.kind !== 'telecentrique') {
      notes.push(tr('Distorsion estimée de {p} % ({e} µm en bord de champ) : compatible avec la précision visée après calibration.', { p: fmt(R.distPct, 1), e: fmt(R.distErr, 0) }));
    }
    R.lt = lt;
    var spec = lensSpec(ev, inp, lt); R.spec = spec;
    if (meas && subdiv > 5) flags.push({ t: 'warn', m: tr('Interpolation à 1/{s} de pixel : demande des bords très nets (contre-jour, télécentrique), un bon éclairage et peu de bruit. Au-delà de 1/5, la précision annoncée est optimiste.', { s: subdiv }) });
    // capteur
    if (R.status !== 'ok') {
      var lack = [];
      if (nW < R.need.nH) lack.push(tr('{n} px sur la largeur', { n: R.need.nH }));
      if (nH < R.need.nV) lack.push(tr('{n} px sur la hauteur', { n: R.need.nV }));
      var cv = { nh: R.need.nH, nv: R.need.nV, mpx: fmt(R.need.mpx, 1), lack: lack.length ? tr('il manque {l}. ', { l: lack.join(tr(' et ')) }) : '', fh: fmt(R.fovMax.H, 0), fv: fmt(R.fovMax.V, 0), c: fmt(R.capab, 0) };
      flags.push({ t: R.status === 'limite' ? 'warn' : 'bad', m: R.status === 'limite'
        ? (meas ? tr('Capteur à la limite pour ce champ : il faudrait {nh} × {nv} px ({mpx} Mpx), {lack}Options : réduire le champ à {fh} × {fv} mm, accepter {c} µm de précision, ou choisir un capteur plus grand.', cv)
          : tr('Capteur à la limite pour ce champ : il faudrait {nh} × {nv} px ({mpx} Mpx), {lack}Options : réduire le champ à {fh} × {fv} mm, accepter {c} µm de défaut minimal, ou choisir un capteur plus grand.', cv))
        : (meas ? tr('Capteur insuffisant pour ce champ : il faudrait {nh} × {nv} px ({mpx} Mpx), {lack}Options : réduire le champ à {fh} × {fv} mm, accepter {c} µm de précision, ou choisir un capteur plus grand.', cv)
          : tr('Capteur insuffisant pour ce champ : il faudrait {nh} × {nv} px ({mpx} Mpx), {lack}Options : réduire le champ à {fh} × {fv} mm, accepter {c} µm de défaut minimal, ou choisir un capteur plus grand.', cv)) });
    }
    if (s.p <= 3.5) notes.push(tr('Pixel de {p} µm : prévoir un objectif conçu pour ce pas (classe 5 Mpx et plus), sinon la résolution de l\'objectif limite l\'image.', { p: fmt(s.p, 2) }));
    // options de focale
    var opts = [], kind = lt.kind;
    if (kind !== 'telecentrique') {
      var sorted = FOCAL_STD.slice().sort(function (a, b) { return Math.abs(Math.log(a / fNeed)) - Math.abs(Math.log(b / fNeed)); }).slice(0, 3).sort(function (a, b) { return a - b; });
      sorted.forEach(function (f) {
        var o = { f: f };
        if (s.wd <= f * 1.02) { o.invalid = true; opts.push(o); return; }
        var mWD = magAt(f, s.wd);
        o.fovHatWD = W / mWD; o.fovVatWD = H / mWD; o.mAtWD = mWD;
        o.covers = o.fovHatWD >= s.fovH * 0.999 && o.fovVatWD >= s.fovV * 0.999;
        o.margin = o.fovHatWD / s.fovH - 1;
        o.pixAtWD = s.p / mWD; o.okAtWD = o.pixAtWD <= reqPix * 1.0001;
        o.wdExact = f * (1 + ev.m) / ev.m; o.wdDelta = o.wdExact - s.wd; o.wdRel = Math.abs(o.wdDelta) / s.wd;
        o.mfd = minFocusMm(f);
        var mMod = f / (o.mfd - f);
        o.tube = ev.m > mMod ? f * (ev.m - mMod) : 0;                    // allonge à ajouter, mm
        o.tubeTotal = f * ev.m;                                           // allonge totale depuis l'infini
        o.nearOK = o.wdExact >= o.mfd;
        opts.push(o);
      });
    }
    R.options = opts.filter(function (o) { return !o.invalid; });
    var rec = null;
    R.options.forEach(function (o) { if (!rec || o.wdRel < rec.wdRel - 0.02 || (Math.abs(o.wdRel - rec.wdRel) <= 0.02 && o.tube < rec.tube)) rec = o; });
    R.rec = rec;
    // accessoires
    var acc = [], tubeAcc = false;
    if (kind === 'telecentrique') {
      acc.push({ t: 'info', n: tr('Aucun accessoire d\'optique'), m: tr('Un télécentrique a un grossissement fixe : choisir la référence la plus proche de {m}× (champ objet = capteur ÷ grossissement). La distance de travail est imposée par l\'objectif, à comparer aux {wd} mm demandés. Éclairage : contre-jour collimaté ou éclairage coaxial.', { m: fmt(ev.m, 3), wd: fmt(s.wd, 0) }) });
    } else {
      if (fNeed > FOCAL_MAX_STD) {
        acc.push({ t: 'warn', n: tr('Doubleur de focale'), m: tr('Il faut ≈ {f} mm, au-delà des focales fixes usuelles ({max} mm). Un doubleur ×2 sur un objectif de ≈ {h} mm donne la focale voulue, au prix de 2 diaphragmes (f/{n} demande un objectif ouvrant à f/{n2}) et d\'une perte de résolution. Alternative : un objectif macro ou télécentrique, ou rapprocher la caméra.', { f: fmt(fNeed, 0), max: FOCAL_MAX_STD, h: fmt(fNeed / 2, 0), n: fmt(s.nom, 1), n2: fmt(s.nom / 2, 1) }) });
      }
      if (fNeed < 6) acc.push({ t: 'warn', n: tr('Focale très courte'), m: tr('Environ {f} mm : distorsion forte et vignetage. Augmenter la distance de travail ou découper le champ avec plusieurs caméras.', { f: fmt(fNeed, 1) }) });
      if (ev.m > MACRO_M) {
        var fr = rec ? rec.f : 50, mt = fr * ev.m;
        acc.push({ t: 'info', n: tr('Bague allonge ou macro'), m: tr('Grossissement de {m}×. Deux voies : un objectif macro, ou un objectif standard de {f} mm avec une allonge totale de ≈ {t} mm (formule f × m, à valider sur la fiche de l\'objectif). Les allonges réduisent la profondeur de champ et la lumière reçue.', { m: fmt(ev.m, 3), f: fr, t: fmt(mt, 1) }) }); tubeAcc = true;
      } else if (rec && s.wd < rec.mfd) {
        acc.push({ t: 'warn', n: tr('Lentille additionnelle ou allonge'), m: tr('Distance de travail de {wd} mm sous la mise au point minimale d\'un {f} mm (≈ {mfd} mm, valeur type). Une allonge de ≈ {t} mm ou une lentille additionnelle d\'environ {dpt} dioptries corrige cela.', { wd: fmt(s.wd, 0), f: rec.f, mfd: rec.mfd, t: fmt(rec.tube, 1), dpt: fmt(1000 / s.wd, 1) }) }); tubeAcc = true;
      } else if (rec && rec.tube > 0.5) {
        acc.push({ t: 'info', n: tr('Allonge'), m: tr('Une allonge d\'environ {t} mm au-delà du tirage de l\'objectif est utile pour cette distance.', { t: fmt(rec.tube, 1) }) }); tubeAcc = true;
      }
      if (!acc.length) acc.push({ t: 'good', n: tr('Aucun accessoire nécessaire'), m: tr('Un objectif à focale fixe suffit, sans doubleur ni allonge.') });
    }
    R.acc = acc; R.flags = flags; R.notes = notes;
    // objectif retenu en une phrase
    R.headline = kind === 'telecentrique'
      ? tr('Télécentrique, grossissement ≈ {m}×', { m: fmt(ev.m, 3) })
      : (rec ? (kind === 'macro' ? tr('Macro ou standard avec allonge, focale {f} mm', { f: rec.f }) : tr('Standard, focale {f} mm', { f: rec.f })) : tr('Focale ≈ {f} mm', { f: fmt(fNeed, 1) }));
    R.fNeed = fNeed;
    R.mount = mountAdvice(R, s.mount, tubeAcc);
    return R;
  }

  /* ---------- Environnement, contraintes mécaniques et boîtier (calculateur complet, option) ----------
     Règles de travail et ordres de grandeur typiques : à confirmer sur les fiches techniques et avec le fabricant du boîtier.
     Code IP (CEI 60529) : 1er chiffre poussière (5 protégé, 6 étanche), 2e chiffre eau (5 jets, 6 jets puissants,
     7 immersion temporaire 1 m / 30 min, 8 immersion prolongée selon le fabricant) ; IP69K (ISO 20653) : jets à 80 °C, 80 à 100 bar. */
  var ENV_EXPO = {
    sec: { label: 'Intérieur propre et sec', ip: 'IP40', rank: 0, light: 'IP50 à IP54', cam: 'std' },
    poussiere: { label: 'Atelier poussiéreux', ip: 'IP65', rank: 1, light: 'IP65', cam: 'ip' },
    projections: { label: 'Projections d\'eau ou d\'huile', ip: 'IP65', rank: 2, light: 'IP65', cam: 'ip' },
    lavage: { label: 'Lavage haute pression (agroalimentaire, pharmaceutique)', ip: 'IP69K', rank: 4, light: 'IP69K', cam: 'inox' },
    exterieur: { label: 'Extérieur (pluie, UV)', ip: 'IP66 / IP67', rank: 3, light: 'IP67', cam: 'ip' },
    immersion: { label: 'Immersion temporaire', ip: 'IP67 / IP68', rank: 5, light: 'IP68', cam: 'immersion' }
  };
  var ENV_VIB = { aucune: 'Aucune', moderees: 'Modérées (machine, convoyeur)', fortes: 'Fortes (robot, presse, véhicule)' };
  var ENV_SHOCK = { aucun: 'Aucun', ponctuels: 'Ponctuels (manutention)', repetes: 'Répétés (robot, impact)' };
  // Valeurs typiques de conception (mm)
  var HOUSING = { gap: 4, filter: 5, pol: 5, rearStraight: 55, rearAngled: 25, side: 8, plate: 10, wall: 5, front: 10, margin: 4 };
  // Corps de caméra typique selon la diagonale du capteur
  function cameraBody(s, D) {
    if (s.swir) return { w: 55, h: 55, l: 65, label: tr('caméra SWIR refroidie (module Peltier), compacte') };
    if (D <= 17.7) return { w: 29, h: 29, l: 42, label: tr('boîtier compact monture C') };
    if (D <= 28.5) return { w: 40, h: 40, l: 45, label: tr('boîtier moyen format (jusqu\'à APS-C)') };
    return { w: 60, h: 60, l: 60, label: tr('boîtier grand format (plein format, type 2.5)') };
  }
  // Longueur d'un objectif à focale fixe en fonction de la focale (table de travail, interpolée)
  var LENS_LEN = [[8, 30], [16, 35], [25, 40], [35, 45], [50, 55], [75, 70], [100, 90]];
  function lensLength(f) {
    if (!(f > 0)) return 40;
    if (f <= LENS_LEN[0][0]) return LENS_LEN[0][1];
    for (var i = 1; i < LENS_LEN.length; i++) {
      var a = LENS_LEN[i - 1], b = LENS_LEN[i];
      if (f <= b[0]) return a[1] + (b[1] - a[1]) * (f - a[0]) / (b[0] - a[0]);
    }
    return 90 + (f - 100) * 0.8;
  }
  function lensDiameter(circle) { return circle <= 11.1 ? 30 : circle <= 17.7 ? 35 : circle <= 22.1 ? 40 : circle <= 28.5 ? 45 : 60; }
  function lensEnvelope(ev, inp, lt, sp) {
    var circle = sp && sp.circleMin ? sp.circleMin : ev.dims.D, dBody = lensDiameter(circle), m = sp ? sp.m : ev.m;
    if (lt.kind === 'telecentrique') {
      var diag = Math.sqrt(inp.fovH * inp.fovH + inp.fovV * inp.fovV);
      var d = Math.max(dBody, diag * 1.1 + 10);
      return { d: d, l: Math.max(100, 2.5 * d), how: tr('télécentrique : lentille frontale ≥ diagonale du champ ({g} mm) plus une marge, longueur ≈ 2,5 × ce diamètre (au moins 100 mm), estimation prudente', { g: fmt(diag, 0) }) };
    }
    var f = sp && sp.fAbove ? sp.fAbove : (sp && sp.f ? sp.f : 25), l = lensLength(f);
    if (lt.kind === 'macro') {
      var ext = f * m;
      return { d: dBody, l: l + ext, f: f, how: tr('macro : objectif de {f} mm (≈ {l} mm) plus ≈ {e} mm d\'allonge de mise au point (f × m)', { f: f, l: fmt(l, 0), e: fmt(ext, 0) }) };
    }
    return { d: dBody, l: l, f: f, how: tr('focale fixe de {f} mm en monture C ou équivalente : longueur ≈ {l} mm, diamètre ≈ {d} mm selon le cercle d\'image', { f: f, l: fmt(l, 0), d: fmt(dBody, 0) }) };
  }

  function environmentAdvice(env, ev, inp, lt, sp, L) {
    if (!env || !env.on) return null;
    var X = ENV_EXPO[env.expo] || ENV_EXPO.sec, key = ENV_EXPO[env.expo] ? env.expo : 'sec';
    var tMin = isFinite(env.tMin) ? env.tMin : 10, tMax = isFinite(env.tMax) ? env.tMax : 35;
    var vib = ENV_VIB[env.vib] ? env.vib : 'aucune', shock = ENV_SHOCK[env.shock] ? env.shock : 'aucun';
    var food = !!env.food, humid = !!env.humid, atex = !!env.atex;
    var lam = L && L.lam ? L.lam : (inp.lambda || 550), s = ev.sensor;
    var mech = vib !== 'aucune' || shock !== 'aucun', hard = vib === 'fortes' || shock === 'repetes';
    var R = { expo: key, expoLabel: tr(X.label), tMin: tMin, tMax: tMax, vib: vib, shock: shock, food: food, humid: humid, atex: atex, flags: [], notes: [] };
    function flag(t, m) { R.flags.push({ t: t, m: m }); }

    // 1. Indice de protection
    var ip = X.ip;
    if (food && X.rank < 4) R.notes.push(tr('Contact alimentaire : si la zone est nettoyée au jet, choisir « Lavage haute pression » (IP69K).'));
    R.ip = { code: ip, rank: X.rank };
    R.ip.text = {
      sec: tr('Intérieur propre et sec : IP40 suffit (protection contre les corps de plus de 1 mm). Une caméra industrielle standard (IP30 typique) convient sans boîtier.'),
      poussiere: tr('Poussière : IP5X (protégé) à IP6X (étanche à la poussière). Viser IP65 au minimum, IP6X si la poussière est fine ou conductrice.'),
      projections: tr('Projections d\'eau ou d\'huile : IP65 au minimum (étanche à la poussière, protégé contre les jets d\'eau). Huiles de coupe : vérifier la compatibilité des joints.'),
      lavage: tr('Lavage haute pression : IP69K (jets d\'eau à 80 °C, 80 à 100 bar). Inox AISI 316L, joints de qualité alimentaire, formes arrondies, aucun recoin où l\'eau stagne.'),
      exterieur: tr('Extérieur : IP66 / IP67, matériaux résistants aux UV et pare-soleil.'),
      immersion: tr('Immersion temporaire : IP67 (1 m pendant 30 min) au minimum, IP68 si l\'immersion est plus profonde ou plus longue (conditions fixées par le fabricant).')
    }[key];
    R.ip.explain = tr('Code IP : le 1er chiffre donne la protection contre la poussière (5 protégé, 6 étanche), le 2e contre l\'eau (5 jets, 6 jets puissants, 7 immersion 1 m pendant 30 min, 8 immersion prolongée). IP69K : jets à 80 °C, 80 à 100 bar.');

    // 2. Caméra
    var camStdTemp = tMin >= 0 && tMax <= 45;
    var C = { std: X.cam === 'std' && camStdTemp };
    if (X.cam === 'inox') { C.head = tr('Caméra standard en boîtier inox IP69K'); C.text = tr('Au lavage haute pression, toujours un boîtier inox : même une caméra IP67 ne tient pas les jets IP69K.'); }
    else if (X.cam === 'immersion') { C.head = tr('Boîtier étanche IP68'); C.text = tr('Caméra standard dans un boîtier étanche IP68 (profondeur et durée à préciser). Une caméra IP67 ne tient que 1 m pendant 30 min.'); }
    else if (X.cam === 'ip') { C.head = tr('Caméra IP65 / IP67 ou en boîtier'); C.text = tr('Deux voies : une caméra IP65 / IP67 (certaines existent avec un tube de protection d\'objectif), ou une caméra standard dans un boîtier de protection.'); }
    else if (C.std) { C.head = tr('Caméra standard'); C.text = tr('Une caméra industrielle standard (IP30 typique) convient. Boîtier facultatif, pour la protection mécanique.'); }
    else { C.head = tr('Caméra standard en boîtier'); C.text = tr('Température hors de la plage typique de la caméra : boîtier avec gestion thermique.'); }
    C.v = X.cam === 'inox' ? tr('Boîtier IP69K') : X.cam === 'immersion' ? tr('Boîtier IP68') : X.cam === 'ip' ? 'IP65 / IP67' : C.std ? 'IP30' : tr('En boîtier');
    C.typ = tr('Caméra industrielle standard : IP30 et 0 à 50 °C de température de boîtier typiques, à vérifier sur la fiche.');
    R.camera = C;

    // 3. Objectif
    var O = { rugged: mech, items: [] };
    if (mech) {
      O.head = tr('Objectif durci (anti-vibration)');
      O.items.push(tr('Objectif durci : lentilles collées ou fixées, mise au point et diaphragme bloqués par vis, sans bague libre. Un objectif standard peut perdre sa mise au point sous vibrations.'));
      if (s.p <= 3.45) O.items.push(tr('Pixel de {p} µm : un léger décentrement des lentilles se voit sur l\'image, l\'objectif durci est d\'autant plus important.', { p: fmt(s.p, 2) }));
      O.items.push(tr('Demander au fournisseur les essais selon CEI 60068-2-6 (vibrations) et CEI 60068-2-27 (chocs). Ordre de grandeur typique annoncé pour les gammes durcies : quelques g à une dizaine de g en vibration, plusieurs dizaines de g en choc, à comparer aux mesures sur votre machine.'));
    } else {
      O.head = tr('Objectif standard');
      O.items.push(tr('Sans vibrations ni chocs : objectif standard, bagues bloquées par leurs vis après réglage.'));
    }
    if (X.rank >= 1 && X.cam === 'ip') O.items.push(tr('Avec une caméra IP65 / IP67 : tube de protection d\'objectif avec hublot, à la même classe IP que la caméra.'));
    var LE = lensEnvelope(ev, inp, lt, sp);
    if (mech && (LE.l > 60 || lt.kind === 'telecentrique')) O.items.push(tr('Objectif long ou lourd (≈ {l} mm) : le soutenir par un collier, pas seulement par la monture.', { l: fmt(LE.l, 0) }));
    O.v = mech ? tr('Durci') : tr('Standard');
    R.lens = O;

    // 4. Éclairage
    var G = { ip: X.light, items: [] };
    G.head = tr('Éclairage {ip}', { ip: X.light });
    G.v = X.light;
    if (key === 'sec') G.items.push(tr('Éclairages standard (IP50 à IP54 typiques).'));
    else if (key === 'lavage') G.items.push(tr('Versions lavables IP69K : corps inox, face avant en PMMA ou en verre, sans vis apparente.'));
    else G.items.push(tr('Barres et rampes {ip} : face avant en PMMA, polycarbonate ou verre selon l\'environnement.', { ip: X.light }));
    if (X.rank >= 1) G.items.push(tr('Connecteurs M12 IP67 ou presse-étoupes de même classe ; câbles adaptés (PUR, ou résistants aux huiles et aux détergents).'));
    if (food || shock !== 'aucun') G.items.push(tr('Face avant en PMMA ou polycarbonate plutôt qu\'en verre (risque d\'éclats).'));
    if (key === 'exterieur') {
      G.items.push(tr('Lumière du jour : éclairage dominant en mode flash (surintensité), exposition courte, filtre passe-bande sur la longueur d\'onde de l\'éclairage, pare-soleil.'));
      if (inp.ambient !== 'forte') flag('warn', tr('Poste en extérieur avec une lumière ambiante réglée sur « Maîtrisée » : passer « Lumière ambiante » à « Forte » dans les options avancées.'));
    }
    if (key === 'immersion') flag('warn', tr('Immersion : la plupart des éclairages industriels s\'arrêtent à IP67. Prendre un éclairage IP68 submersible, ou le placer dans le boîtier derrière le hublot.'));
    R.light = G;

    // 5. Thermique
    var T = { items: [], cool: 'aucun', heat: false, anticond: false, purge: false, power: false, air: false, water: false };
    if (tMax > 100) { T.cool = 'eau'; T.water = true; flag('bad', tr('{t} °C : très haute température. Boîtier à double paroi refroidi par eau, écran thermique, à étudier avec le fabricant.', { t: fmt(tMax, 0) })); }
    else if (tMax > 60) { T.cool = 'vortex'; T.air = true; T.items.push(tr('Au-dessus de 60 °C : refroidissement actif par tube vortex (air comprimé) ou chemise à circulation d\'eau.')); }
    else if (tMax > 45) { T.cool = 'air'; T.power = true; T.items.push(tr('{t} °C : refroidissement nécessaire. Ventilation forcée si l\'air soufflé reste sous la limite de la caméra, sinon module Peltier ou tube vortex.', { t: fmt(tMax, 0) })); }
    if (tMax > 45) T.items.push(tr('La caméra chauffe : l\'intérieur du boîtier dépasse l\'ambiante de quelques degrés (souvent 5 à 15 °C, valeur typique).'));
    if (tMin < 0) { T.heat = true; T.power = true; T.anticond = true; T.items.push(tr('Sous 0 °C : résistance de chauffage avec thermostat dans le boîtier. Risque de condensation au réchauffage.')); }
    if (humid) { T.anticond = true; T.power = true; T.items.push(tr('Humidité et condensation : hublot chauffant ou purge d\'air sec, et membrane de mise à l\'air ou dessiccant.')); }
    if (key === 'poussiere' || key === 'projections') { T.purge = true; T.air = true; T.items.push(tr('Purge d\'air ou lame d\'air devant le hublot pour le garder propre.')); }
    if (key === 'exterieur') T.items.push(tr('Soleil direct : le pare-soleil limite l\'échauffement du boîtier, qui peut dépasser nettement l\'ambiante.'));
    if (tMin > tMax) flag('warn', tr('Température minimale supérieure à la maximale : vérifier la saisie.'));
    if (!T.items.length) T.items.push(tr('Aucune gestion thermique particulière : {a} à {b} °C reste dans la plage typique d\'une caméra.', { a: fmt(tMin, 0), b: fmt(tMax, 0) }));
    T.head = T.cool === 'eau' ? tr('Refroidissement par eau') : T.cool === 'vortex' ? tr('Tube vortex ou eau') : T.cool === 'air' ? tr('Refroidissement') : T.heat ? tr('Chauffage') : T.anticond ? tr('Anti-condensation') : tr('Passive');
    R.thermal = T;

    // 6. Boîtier : enveloppe intérieure estimée
    var cam = cameraBody(s, ev.dims.D), H = HOUSING;
    var filt = L && L.filter && L.filter.need === tr('recommandé') ? H.filter : 0, pol = L && L.pol && L.pol.use ? H.pol : 0;
    var len = H.rearStraight + cam.l + LE.l + filt + pol + H.gap;
    var wid = Math.max(cam.w, LE.d) + 2 * H.side, hei = Math.max(cam.h, LE.d) + 2 * H.side + H.plate;
    var B = { cam: cam, lens: LE, filter: filt, pol: pol, gap: H.gap, rear: H.rearStraight, side: H.side, plate: H.plate };
    B.L = Math.ceil(len / 5) * 5; B.W = Math.ceil(wid / 5) * 5; B.H = Math.ceil(hei / 5) * 5;
    B.ext = { L: B.L + 2 * H.wall + H.front, W: B.W + 2 * H.wall, H: B.H + 2 * H.wall };
    B.angledGain = H.rearStraight - H.rearAngled;
    // hublot
    var tw = (food || shock !== 'aucun' || key === 'lavage' || key === 'immersion') ? 6 : 4;
    var half = L && L.telecentric ? 0 : (L && isFinite(L.thetaDeg) ? L.thetaDeg : Math.atan(Math.sqrt(inp.fovH * inp.fovH + inp.fovV * inp.fovV) / 2 / inp.wd) * 180 / Math.PI);
    var dist = filt + pol + H.gap + tw;
    B.win = { ap: Math.ceil(LE.d + 2 * dist * Math.tan(half * Math.PI / 180) + H.margin), thick: tw, half: half };
    var mats = [];
    if (lam < 380) mats.push(tr('silice fondue (quartz) : le verre courant absorbe les UV sous 380 nm'));
    else if (lam > 1000) mats.push(tr('borosilicate ou silice fondue, transmission à vérifier sur la bande SWIR (le verre flotté courant absorbe en partie vers 1 µm)'));
    if (food || key === 'lavage') mats.push(tr('polycarbonate ou PMMA, sans risque d\'éclats de verre'));
    else if (shock !== 'aucun') mats.push(tr('polycarbonate, ou verre trempé ou feuilleté (chocs)'));
    else if (key === 'poussiere') mats.push(tr('saphir ou verre trempé (abrasion)'));
    if (!mats.length) mats.push(lam >= 700 ? tr('verre flotté ou borosilicate avec traitement antireflet proche infrarouge') : tr('verre flotté ou borosilicate avec traitement antireflet visible'));
    B.win.mat = mats.join(' ; ');
    if (lam < 380 && (food || key === 'lavage')) flag('warn', tr('UV et hygiène alimentaire : la silice fondue est un verre. PMMA transmettant les UV, ou silice fondue avec film anti-éclats, à valider.'));
    B.win.note = tr('Éviter que les reflets de l\'éclairage sur le hublot entrent dans l\'objectif : éclairage hors du boîtier, hublot légèrement incliné ou cache entre éclairage et hublot.');
    // matière, fixation, passages de câbles
    B.material = (food || key === 'lavage') ? tr('Inox AISI 316L, joints de qualité alimentaire, conception hygiénique (EHEDG)')
      : key === 'immersion' ? tr('Inox 316L (eau salée) ou aluminium anodisé, joints toriques')
      : key === 'exterieur' ? tr('Aluminium anodisé ou inox, matériaux résistants aux UV, pare-soleil')
      : tr('Aluminium anodisé');
    B.mount = mech ? tr('Fixation rigide sur la structure, vis freinées (frein-filet) ; plots antivibratoires seulement si la fréquence de la machine le permet.')
      : tr('Équerre ou rotule réglable, bloquée après réglage.');
    var glands = 2 + (T.power ? 1 : 0), ext = [];
    if (T.air) ext.push(tr('raccord d\'air comprimé'));
    if (T.water) ext.push(tr('2 raccords d\'eau'));
    B.glands = { n: glands, extra: ext };
    B.glandsText = tr('{n} passages : données (ou PoE), E/S et déclenchement', { n: glands }) + (T.power ? tr(', alimentation chauffage ou refroidissement') : '') + (ext.length ? ' ; ' + ext.join(', ') : '') + '. '
      + (key === 'lavage' ? tr('Presse-étoupes inox hygiéniques IP69K.') : X.rank >= 1 ? tr('Presse-étoupes ou connecteurs M12 traversants, IP67 au minimum.') : tr('Presse-étoupes standard.'));
    B.thermal = T.items.join(' ');
    // contrôle de l'encombrement
    var sL = env.spL, sW = env.spW, sH = env.spH;
    if (sL > 0 && sW > 0 && sH > 0) {
      var e = B.ext, fitsWH = function (k) { return (e.W * k <= sW && e.H * k <= sH) || (e.W * k <= sH && e.H * k <= sW); };
      var fits = e.L <= sL && fitsWH(1), roomy = e.L * 1.1 <= sL && fitsWH(1.1);
      B.fit = { status: fits ? (roomy ? 'ok' : 'juste') : 'trop', space: { L: sL, W: sW, H: sH } };
      if (!fits) {
        var gain = e.L - B.angledGain <= sL && fitsWH(1);
        flag('bad', tr('Boîtier estimé à {a} × {b} × {c} mm (extérieur) : il ne tient pas dans {x} × {y} × {z} mm.', { a: e.L, b: e.W, c: e.H, x: fmt(sL, 0), y: fmt(sW, 0), z: fmt(sH, 0) }));
        B.fit.text = (gain ? tr('Des connecteurs coudés (≈ {g} mm gagnés à l\'arrière) suffisent à le faire tenir. ', { g: B.angledGain }) : '')
          + tr('Options : connecteurs coudés, focale plus courte à distance de travail plus courte, caméra à tête déportée, ou renvoi d\'angle par miroir.');
      } else if (!roomy) {
        B.fit.text = tr('Tient de justesse (moins de 10 % de marge) : prévoir des connecteurs coudés et confirmer les cotes réelles.');
      } else B.fit.text = tr('Tient dans l\'espace disponible, avec plus de 10 % de marge.');
    } else B.fit = null;
    R.housing = B;

    // 7. Drapeaux d'ensemble
    if (atex) flag('bad', tr('Atmosphère explosive (ATEX) : boîtier certifié ATEX obligatoire (zone et catégorie à définir), hors du périmètre de cette estimation.'));
    if (hard) flag('warn', tr('Vibrations fortes ou chocs répétés : objectif durci, fixation rigide et câbles avec maintien (serre-câbles, boucle de détente) ; vérifier aussi la tenue de la caméra sur sa fiche.'));
    if (X.cam === 'std' && !camStdTemp) flag('warn', tr('{a} à {b} °C : hors de la plage typique d\'une caméra standard (0 à 50 °C de boîtier). Boîtier avec gestion thermique.', { a: fmt(tMin, 0), b: fmt(tMax, 0) }));
    if (lt.kind === 'telecentrique') R.notes.push(tr('Télécentrique : l\'objectif est long et sa lentille frontale dépasse le champ ; le hublot doit couvrir tout le champ.'));
    R.notes.push(tr('Dimensions estimées à partir de valeurs typiques (corps de caméra, objectif) : à remplacer par les cotes des fiches techniques et à confirmer avec le fabricant du boîtier.'));

    // Cahier des charges du boîtier (texte)
    var cond = [R.expoLabel, tr('{a} à {b} °C', { a: fmt(tMin, 0), b: fmt(tMax, 0) })];
    if (humid) cond.push(tr('humidité et condensation'));
    if (vib !== 'aucune') cond.push(tr('vibrations : {v}', { v: tr(ENV_VIB[vib]) }));
    if (shock !== 'aucun') cond.push(tr('chocs : {v}', { v: tr(ENV_SHOCK[shock]) }));
    if (food) cond.push(tr('contact alimentaire'));
    if (atex) cond.push(tr('ATEX'));
    var lines = [
      tr('Cahier des charges du boîtier (estimation)'),
      tr('Environnement : {c}', { c: cond.join(', ') }),
      tr('Indice de protection : {ip}', { ip: ip }),
      tr('Matière : {m}', { m: B.material }),
      tr('Dimensions intérieures minimales : {l} × {w} × {h} mm (longueur × largeur × hauteur)', { l: B.L, w: B.W, h: B.H }),
      tr('Dont : caméra ≈ {cw} × {ch} × {cl} mm ({cn}), objectif ≈ ⌀ {ld} × {ll} mm, filtres {f} mm, jeu au hublot {g} mm, connecteurs droits {r} mm', { cw: cam.w, ch: cam.h, cl: cam.l, cn: cam.label, ld: fmt(LE.d, 0), ll: fmt(LE.l, 0), f: filt + pol, g: H.gap, r: H.rearStraight }),
      tr('Encombrement extérieur estimé : {l} × {w} × {h} mm', { l: B.ext.L, w: B.ext.W, h: B.ext.H }),
      tr('Hublot : ouverture utile ≥ {a} mm, épaisseur ≈ {t} mm, {m}', { a: B.win.ap, t: tw, m: B.win.mat }),
      tr('Gestion thermique : {t}', { t: B.thermal }),
      tr('Passages de câbles : {g}', { g: B.glandsText }),
      tr('Fixation : {m}', { m: B.mount }),
      tr('Caméra : {c}', { c: C.head }),
      tr('Objectif : {o}', { o: O.head }),
      tr('Éclairage : {l}', { l: G.head })
    ];
    if (B.fit) lines.push(tr('Encombrement disponible : {x} × {y} × {z} mm, {r}', { x: fmt(sL, 0), y: fmt(sW, 0), z: fmt(sH, 0), r: B.fit.status === 'ok' ? tr('compatible') : B.fit.status === 'juste' ? tr('compatible de justesse') : tr('insuffisant') }));
    if (atex) lines.push(tr('ATEX : boîtier certifié obligatoire, hors estimation'));
    lines.push(tr('Valeurs estimées, à confirmer sur les fiches techniques et avec le fabricant du boîtier.'));
    R.spec = lines.join('\n');
    R.summary = { exposition: key, ip: ip, t_min_c: tMin, t_max_c: tMax, humidite: humid, vibrations: vib, chocs: shock, alimentaire: food, atex: atex,
      objectif_durci: mech, refroidissement: T.cool, chauffage: T.heat, boitier_int_mm: [B.L, B.W, B.H], boitier_ext_mm: [B.ext.L, B.ext.W, B.ext.H],
      hublot_mm: B.win.ap, encombrement_mm: B.fit ? [sL, sW, sH] : null, encombrement_ok: B.fit ? B.fit.status !== 'trop' : null };
    return R;
  }

  var api = {
    SRC: SRC, PRICE_POINTS: PRICE_POINTS, estimatePrice: estimatePrice, SENSORS: SENSORS, MATERIALS: MATERIALS, COLOR_RULE: COLOR_RULE, DEMO_CATALOG: DEMO_CATALOG, CSV_TEMPLATE: CSV_TEMPLATE,
    KIND_LABEL: KIND_LABEL, MACRO_M: MACRO_M, TELE_MAX_FOV: TELE_MAX_FOV,
    dims: dims, nyquist: nyquist, cutoff: cutoff, mtfDiff: mtfDiff, xForMtf: xForMtf,
    focalFor: focalFor, magAt: magAt, dof: dof, blueShift: blueShift,
    resolveLambda: resolveLambda, materialById: materialById, materialBands: materialBands,
    evalSensor: evalSensor, requiredPixels: requiredPixels, rankSensors: rankSensors,
    lensType: lensType, lensSpec: lensSpec, apertureWindow: apertureWindow,
    parseCatalog: parseCatalog, evalEntry: evalEntry, matchCatalog: matchCatalog,
    lightAdvice: lightAdvice, adviseOptic: adviseOptic, MOUNTS: MOUNTS, IMX_EXTRA: IMX_EXTRA, findSensor: findSensor, mountById: mountById, minFocusMm: minFocusMm, fmt: fmt,
    ENV_EXPO: ENV_EXPO, ENV_VIB: ENV_VIB, ENV_SHOCK: ENV_SHOCK, environmentAdvice: environmentAdvice
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OptiCalc = api;
})(typeof self !== 'undefined' ? self : this);
