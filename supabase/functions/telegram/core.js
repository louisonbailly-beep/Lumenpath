/* Moteur de calcul optique v2 : champ de vue, résolution, capteur, spécification d'objectif neutre,
   import de catalogue, matière, longueur d'onde et filtre.
   Longueurs en mm, sauf pixels et défauts en µm, longueurs d'onde en nm. */
(function (root) {
  'use strict';

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
        { lam: c.dark, role: 'Assombrit le motif', why: 'Une couleur complémentaire rend le motif plus sombre sur un fond clair' + (c.darkAlt ? ' (aussi ' + c.darkAlt + ')' : '') + '. Valeurs de LED usuelles.' },
        { lam: c.bright, role: 'Éclaircit le motif', why: 'Une couleur proche de celle du motif le rend plus clair. Valeur de LED usuelle.' }
      ];
    }
    return mat.bands;
  }
  function resolveLambda(inp) {
    var mat = materialById(inp.material);
    var fw = inp.lamFwhm > 0 ? inp.lamFwhm : 25;
    var r = { mat: mat, fwhm: fw };
    if (inp.lamCons === 'source' && inp.lamC > 0) { r.lam = inp.lamC; r.from = 'source imposée'; r.mode = 'source'; }
    else if (inp.lamCons === 'band' && inp.lamMax > inp.lamMin && inp.lamMin > 0) {
      r.lam = (inp.lamMin + inp.lamMax) / 2; r.fwhm = inp.lamMax - inp.lamMin; r.from = 'plage imposée'; r.mode = 'band';
    } else {
      var b = materialBands(mat, inp.tcolor);
      r.lam = mat.colorRule ? b[0].lam : mat.lam;
      r.from = mat.id === 'general' ? 'défaut (lumière visible)' : 'matière';
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
    if (inp.globalOnly && s.sh !== 'global') why = 'obturateur roulant';
    var lam = inp.lambda || 550;
    if (!why && lam > 1100 && !s.swir) why = 'hors plage spectrale';
    if (!why && lam > 1700) why = 'hors plage spectrale';
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
      reasons.push({ t: 'info', m: 'Mesure avec ' + fmt(inp.depth, 1) + ' mm de variation de hauteur : un objectif standard fait varier l\'échelle de ' + fmt(perr, 2) + ' mm sur le champ, soit ' + fmt(perrPx, 1) + ' pixels. Un télécentrique supprime cette erreur de perspective.' });
    }
    if (meas && inp.backlight) {
      tele = true;
      reasons.push({ t: 'info', m: 'Mesure en contre-jour : un télécentrique donne des bords nets, sans effet de perspective (à associer à un contre-jour collimaté).' });
    }
    var kind, alt = [];
    if (tele && fovMax > TELE_MAX_FOV) {
      reasons.push({ t: 'warn', m: 'Champ de ' + fmt(fovMax, 0) + ' mm : un télécentrique doit avoir une lentille frontale plus grande que le champ, peu courant au-delà de ' + TELE_MAX_FOV + ' mm (seuil de travail du prototype). Objectif standard avec calibration, ou découpage du champ.' });
      kind = m > MACRO_M ? 'macro' : 'standard';
    } else if (tele) {
      kind = 'telecentrique';
      reasons.push({ t: 'info', m: 'Grossissement fixe et distance de travail imposée par l\'objectif ; à choisir près de ' + fmt(m, 3) + '× et de ' + fmt(inp.wd, 0) + ' mm.' });
      alt.push(m > MACRO_M ? 'macro' : 'standard');
    } else if (m > MACRO_M) {
      kind = 'macro';
      reasons.push({ t: 'info', m: 'Grossissement de ' + fmt(m, 3) + '×, au-dessus de ' + MACRO_M + '× : objectif macro, ou standard avec bague allonge (résolution et ouverture à vérifier). Seuil de travail du prototype.' });
      alt.push('standard');
      if (meas) alt.push('telecentrique');
    } else {
      kind = 'standard';
      reasons.push({ t: 'info', m: 'Grossissement de ' + fmt(m, 3) + '×, jusqu\'à ' + MACRO_M + '× : objectif standard à focale fixe.' });
      if (meas && inp.depth > 0) reasons.push({ t: 'info', m: 'Variation de hauteur faible (' + fmt(perrPx, 1) + ' px d\'erreur de perspective) : un standard calibré suffit.' });
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
    if (lines.length < 2) { res.errors.push('Fichier vide ou sans ligne de données.'); return res; }
    var head = lines[0], best = ';', cnt = -1;
    [';', '\t', ','].forEach(function (d) { var c = head.split(d).length; if (c > cnt) { cnt = c; best = d; } });
    res.delimiter = best;
    var commaDec = best !== ',';
    var cols = splitLine(head, best).map(strip), idx = {};
    Object.keys(ALIAS).forEach(function (k) { idx[k] = -1; ALIAS[k].forEach(function (a) { var i = cols.indexOf(a); if (i >= 0 && idx[k] < 0) idx[k] = i; }); });
    if (idx.type < 0) res.errors.push('Colonne « type » absente (standard, macro ou telecentrique).');
    if (idx.f < 0 && idx.mag < 0) res.errors.push('Colonne « focale_mm » ou « grossissement » absente.');
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
        if (!(e.mag > 0)) { res.errors.push('Ligne ' + line + ' : un télécentrique demande un grossissement.'); continue; }
        if (!isFinite(e.f)) e.f = null;
      } else {
        if (!(e.f > 0)) { res.errors.push('Ligne ' + line + ' : focale manquante.'); continue; }
        e.mag = null;
      }
      if (!e.ref) e.ref = 'Ligne ' + line;
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
    if (e.circle != null && e.circle < d.D) out.flags.push({ t: 'bad', m: 'Cercle d\'image (' + fmt(e.circle, 1) + ' mm) plus petit que la diagonale du capteur (' + fmt(d.D, 1) + ' mm) : vignetage.' });
    else if (e.circle != null && e.circle < d.D * 1.03) out.flags.push({ t: 'warn', m: 'Cercle d\'image à peine suffisant : vérifier l\'éclairement dans les coins.' });
    if (e.circle == null) out.flags.push({ t: 'warn', m: 'Cercle d\'image non renseigné : compatibilité avec le capteur non vérifiée.' });
    if (e.res == null) out.flags.push({ t: 'warn', m: 'Résolution non renseignée : verdict impossible.' });
    if (e.type !== 'telecentrique') {
      if (e.wdmin != null && wd < e.wdmin) out.flags.push({ t: 'warn', m: 'Distance de travail sous la mise au point minimale (' + fmt(e.wdmin, 0) + ' mm) : bague allonge ou macro.' });
      if (e.wdmax != null && wd > e.wdmax) out.flags.push({ t: 'warn', m: 'Distance de travail au-delà de la plage (' + fmt(e.wdmax, 0) + ' mm).' });
    } else if (Math.abs(wd - inp.wd) > 0.1 * inp.wd) out.flags.push({ t: 'warn', m: 'Distance de travail imposée de ' + fmt(wd, 0) + ' mm, contre ' + fmt(inp.wd, 0) + ' mm demandés.' });
    if (e.fmin != null && inp.nom < e.fmin) out.flags.push({ t: 'warn', m: 'Ouverture f/' + inp.nom + ' plus ouverte que le minimum de l\'objectif (f/' + e.fmin + ').' });
    if (e.fmax != null && inp.nom > e.fmax) out.flags.push({ t: 'warn', m: 'Ouverture f/' + inp.nom + ' plus fermée que le maximum de l\'objectif (f/' + e.fmax + ').' });
    if (out.mtfNyq < 0.2) out.flags.push({ t: 'warn', m: 'Diffraction : contraste théorique au Nyquist ' + Math.round(out.mtfNyq * 100) + ' % (<20 %). Ouvrir le diaphragme.' });
    if (inp.depth > 0 && out.dof && out.dof.total < inp.depth) out.flags.push({ t: 'warn', m: 'Profondeur de champ (' + fmt(out.dof.total, 1) + ' mm) inférieure à la variation de hauteur (' + inp.depth + ' mm).' });
    if (inp.speed > 0) {
      out.blur = inp.speed * inp.exposure * 1e-6 / ((s.p / m) / 1000);
      if (out.blur > 0.5) out.flags.push({ t: 'warn', m: 'Flou de bougé ' + out.blur.toFixed(2) + ' px (>0,5 px) : réduire l\'exposition ou stroboscoper.' });
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
    if (lam > 1700) A.flags.push({ t: 'bad', m: 'Au-delà de 1700 nm : hors de la plage SWIR traitée par ce prototype.' });
    else if (lam > 1100) A.flags.push({ t: 'warn', m: 'Au-delà de 1100 nm : capteur SWIR requis (la gamme SenSWIR couvre 400 à 1700 nm). Objectif et éclairage prévus pour cette bande.' });
    else if (lam > 1000) A.flags.push({ t: 'warn', m: 'Entre 1000 et 1100 nm : limite du silicium (sensibilité vers 1 µm), rendement faible.' });
    else if (lam >= 700) A.flags.push({ t: 'info', m: 'Proche infrarouge : prévoir un objectif traité pour cette bande (décalage de mise au point). Capteur monochrome, car les capteurs couleur portent un filtre IR-cut.' });
    if (lam < 370) A.flags.push({ t: 'bad', m: 'Sous 370 nm : les capteurs CMOS standard ne répondent plus. Capteur UV dédié et optique en quartz nécessaires (un capteur Pregius S de la gamme UV couvre environ 200 à 1000 nm).' });
    else if (lam < 400) A.flags.push({ t: 'warn', m: 'Entre 370 et 400 nm : sensibilité réduite, et les objectifs standard et leurs vitres absorbent une grande part des UV. Optique compatible UV à vérifier.' });
    if (inp.color && lam >= 700) A.flags.push({ t: 'warn', m: 'Capteur couleur coché : son filtre IR-cut bloque cette bande. Choisir un capteur monochrome.' });
    if (s.swir === true && lam <= 1000) A.flags.push({ t: 'info', m: 'Capteur SWIR sélectionné alors que la bande reste visible : un capteur silicium convient et coûte moins.' });

    // recoupement avec la matière, quand une contrainte est imposée
    if (lr.mode !== 'material' && mat.id !== 'general') {
      var inBand = A.bands.some(function (b) { return b.lam != null ? Math.abs(lam - b.lam) <= 40 : (lam >= b.lo && lam <= b.hi); });
      if (!inBand) A.flags.push({ t: 'warn', m: 'Votre longueur d\'onde (' + fmt(lam, 0) + ' nm) est hors des bandes conseillées pour cette matière : vérifier le contraste par un essai.' });
    }

    // filtre
    var F = { need: 'optionnel' }, kind = mat.filterKind || 'bandpass';
    if (lr.mode === 'band') kind = 'bandpass';
    if (lam < 400 && kind === 'bandpass' && mat.id !== 'pcb' && lr.mode === 'source') kind = 'fluo';
    if (kind === 'fluo') {
      var x0 = lam + fw / 2;
      F.kind = 'longpass'; F.name = 'Passe-haut';
      F.cut = x0 + sh(x0);
      F.text = 'Placé sur la caméra, il bloque la lumière UV d\'excitation et laisse passer la fluorescence visible. Coupure à ' + fmt(F.cut, 0) + ' nm minimum : borne haute de la source (' + fmt(x0, 0) + ' nm) plus le décalage vers le bleu en bord de champ (' + fmt(sh(x0), 1) + ' nm).';
      F.need = 'recommandé';
      A.notes.push('Si l\'UV sert en réflexion et non en fluorescence, un passe-bande centré sur la source remplace le passe-haut.');
    } else if (kind === 'swirlp') {
      var c0 = mat.swirCut;
      F.kind = 'longpass'; F.name = 'Passe-haut';
      F.cut = c0 + sh(c0);
      F.text = 'Il ne laisse passer que l\'infrarouge où le silicium est transparent. Coupure à ' + fmt(F.cut, 0) + ' nm minimum (1100 nm plus le décalage de bord de champ).';
      F.need = 'recommandé';
    } else {
      F.kind = 'bandpass'; F.name = 'Passe-bande';
      F.c0 = lam + A.shift / 2;
      F.bmin = fw + A.shift;
      F.text = 'Centré à ' + fmt(F.c0, 0) + ' nm, largeur à mi-hauteur de ' + fmt(F.bmin, 0) + ' nm au minimum : largeur de la source (' + fmt(fw, 0) + ' nm) plus le décalage vers le bleu en bord de champ (' + fmt(A.shift, 1) + ' nm). Arrondir à la largeur de catalogue supérieure, puis ajouter la tolérance de la fiche du filtre.';
      if (lr.mode !== 'material' || mat.hot || lam < 400 || lam > 1000) F.need = 'recommandé';
      if (mat.hot) A.notes.push('Ajouter un filtre thermique et un passe-bande : seule la lumière réfléchie de la source doit atteindre la caméra, pas le rayonnement de la pièce chaude.');
    }
    if (inp.ambient === 'forte') {
      F.need = 'recommandé';
      A.notes.push('Lumière ambiante forte : filtre au plus près de la largeur minimale, éclairage dominant et exposition courte. Une densité optique de 4 dépasse le besoin de la plupart des applications.');
    } else if (F.need === 'optionnel') {
      A.notes.push('Ambiance maîtrisée : le filtre est optionnel. Il devient utile dès que la lumière du jour ou un éclairage d\'atelier entre dans le champ.');
    }
    if (A.telecentric) A.notes.push('Objectif télécentrique côté objet : les rayons arrivent presque parallèles à l\'axe, le décalage angulaire du filtre est négligeable.');
    else if (A.thetaDeg > 15) A.flags.push({ t: 'warn', m: 'Angle de champ de ' + fmt(A.thetaDeg, 0) + '° : la formule de décalage est donnée pour 15° au plus (Andover). Élargir la bande, ou prendre un verre coloré, insensible à l\'angle mais à bandes plus larges.' });
    if (F.kind === 'bandpass' && F.bmin && lr.mode === 'band' && A.shift > 0.2 * fw) A.flags.push({ t: 'warn', m: 'Le décalage de ' + fmt(A.shift, 1) + ' nm dépasse 20 % de votre plage de ' + fmt(fw, 0) + ' nm : en bord de champ, une partie de la plage sera coupée.' });
    A.filter = F;
    A.filterNstar = nstar;

    // polarisation
    var pol = { use: !!(mat.pol || inp.glare) };
    if (pol.use) {
      pol.text = (mat.polWhy || 'Reflets spéculaires : polariseur sur l\'éclairage et analyseur croisé à 90° sur l\'objectif.') + ' Compter environ 50 % de lumière perdue en théorie, 60 à 65 % en pratique : compenser par l\'éclairage ou l\'exposition.';
      A.src.push('edmundP');
    }
    A.pol = pol;
    if (lr.mode === 'material' && mat.colorRule) A.notes.push('Les longueurs d\'onde sont des valeurs de LED usuelles. Avec une caméra monochrome, vérifier par un essai sur la pièce réelle.');
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
    if (s.swir) return { quote: true, why: 'Caméra SWIR : prix non publics, demander un devis.' };
    var mpx = s.w * s.h / 1e6, pts = PRICE_POINTS.filter(function (p) { return p.sh === s.sh; }).map(function (p) { return { m: p.w * p.h / 1e6, usd: p.usd }; }).sort(function (a, b) { return a.m - b.m; });
    var mid = null, basis = '';
    pts.forEach(function (p) { if (mid == null && Math.abs(p.m / mpx - 1) <= 0.03) { mid = p.usd; basis = 'caméra de même résolution relevée'; } });
    if (mid == null) {
      for (var i = 0; i < pts.length - 1; i++) {
        if (mpx > pts[i].m && mpx < pts[i + 1].m) { mid = pts[i].usd + (pts[i + 1].usd - pts[i].usd) * (mpx - pts[i].m) / (pts[i + 1].m - pts[i].m); basis = 'interpolé entre deux caméras relevées'; }
      }
    }
    if (mid == null) return { quote: true, why: 'Hors des prix relevés (' + (s.sh === 'rolling' ? 'obturateur roulant au-delà de 8 Mpx' : 'résolution hors plage') + ') : demander un devis.' };
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
  function mountAdvice(R, mountId) {
    var diag = R.dims.D, M = { flags: [], rec: [] };
    var rule = diag <= 9 ? ['s', 'cs', 'c'] : diag <= 16 ? ['c', 'cs'] : diag <= 22 ? ['c'] : diag <= 28.5 ? ['tfl', 'm42', 'f'] : diag <= 44 ? ['f', 'm42', 't2', 'm58', 'm72'] : ['m58', 'm72'];
    M.rec = rule.map(mountById);
    M.recText = diag <= 9 ? 'Capteur de ' + fmt(diag, 1) + ' mm de diagonale : S-mount (M12), CS ou C.' :
      diag <= 16 ? 'Capteur de ' + fmt(diag, 1) + ' mm de diagonale : monture C ou CS.' :
      diag <= 22 ? 'Capteur de ' + fmt(diag, 1) + ' mm de diagonale : monture C avec un objectif grand format (cercle d\'image d\'au moins ' + fmt(diag, 1) + ' mm).' :
      diag <= 28.5 ? 'Capteur de ' + fmt(diag, 1) + ' mm de diagonale : TFL, M42 ou F.' :
      diag <= 44 ? 'Capteur de ' + fmt(diag, 1) + ' mm de diagonale : F, M42, T2, M58 ou M72.' :
      'Capteur de ' + fmt(diag, 1) + ' mm de diagonale, très grand : M58 ou M72, avec un objectif conçu pour ce format.';
    var m = mountId && mountId !== 'none' ? mountById(mountId) : null;
    M.chosen = m;
    if (!m) return M;
    var lim = m.diagExt || m.diagStd;
    if (lim != null) {
      if (diag > lim * 1.02) M.flags.push({ t: 'bad', m: 'Capteur trop grand pour cette monture : diagonale de ' + fmt(diag, 1) + ' mm contre ' + fmt(lim, 1) + ' mm environ. Vignetage assuré dans les coins.' });
      else if (m.diagExt && diag > m.diagStd) M.flags.push({ t: 'warn', m: 'Diagonale de ' + fmt(diag, 1) + ' mm : au-delà du format courant de cette monture (' + fmt(m.diagStd, 1) + ' mm). Choisir un objectif grand format dont le cercle d\'image dépasse ' + fmt(diag, 1) + ' mm.' });
      else M.flags.push({ t: 'good', m: 'Le capteur (' + fmt(diag, 1) + ' mm de diagonale) entre dans le format de cette monture.' });
      if (diag < lim * 0.35) M.flags.push({ t: 'info', m: 'Monture surdimensionnée pour ce capteur : encombrement et coût inutiles. ' + M.recText });
    } else M.flags.push({ t: 'info', m: 'Cercle d\'image maximal non renseigné pour cette monture : le demander au fabricant de l\'objectif.' });
    if (m.fr && R.lt.kind !== 'telecentrique') {
      if (R.fNeed < m.fr[0] * 0.8 || R.fNeed > m.fr[1] * 1.2) M.flags.push({ t: 'warn', m: 'Focale de ≈ ' + fmt(R.fNeed, 1) + ' mm peu courante dans cette monture (plage usuelle ' + m.fr[0] + ' à ' + m.fr[1] + ' mm, valeur de travail). Vérifier l\'offre ou changer de monture.' });
    }
    if (m.id === 'c' && R.rec && R.rec.f < 8) M.flags.push({ t: 'info', m: 'Courtes focales en monture C : objectifs plus encombrants qu\'en S-mount, mais plus stables mécaniquement.' });
    if (R.rec && (R.rec.tube > 0.3 || R.lt.kind === 'macro' || R.acc.some(function (a) { return /allonge|additionnelle/i.test(a.n); }))) M.flags.push({ t: 'info', m: 'Allonges : ' + m.ext });
    M.flags.push({ t: 'info', m: (m.flange != null ? 'Tirage de ' + String(parseFloat(m.flange.toFixed(3))).replace('.', ',') + ' mm : l\'objectif et la caméra doivent avoir le même tirage. ' : 'Tirage non normalisé : à confirmer avec le fabricant. ') + m.note });
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
        lt = { kind: 'telecentrique', label: KIND_LABEL.telecentrique, alt: ['standard'], perr: lt.perr, perrPx: lt.perrPx, reasons: lt.reasons.concat([{ t: 'info', m: 'Distorsion d\'un objectif standard estimée à ' + fmt(R.distPct, 1) + ' % : ' + fmt(R.distErr, 0) + ' µm en bord de champ, au-dessus de la précision visée (' + fmt(s.prec, 0) + ' µm). Un télécentrique (distorsion typique sous 0,1 %) évite ce défaut. Un standard exige une calibration soignée.' }]) };
      } else {
        flags.push({ t: 'warn', m: 'Distorsion estimée de ' + fmt(R.distErr, 0) + ' µm en bord de champ, au-dessus de la précision visée. Champ trop grand pour un télécentrique : calibration par mire et correction de distorsion obligatoires.' });
      }
    } else if (meas && lt.kind !== 'telecentrique') {
      notes.push('Distorsion estimée de ' + fmt(R.distPct, 1) + ' % (' + fmt(R.distErr, 0) + ' µm en bord de champ) : compatible avec la précision visée après calibration.');
    }
    R.lt = lt;
    var spec = lensSpec(ev, inp, lt); R.spec = spec;
    if (meas && subdiv > 5) flags.push({ t: 'warn', m: 'Interpolation à 1/' + subdiv + ' de pixel : demande des bords très nets (contre-jour, télécentrique), un bon éclairage et peu de bruit. Au-delà de 1/5, la précision annoncée est optimiste.' });
    // capteur
    if (R.status !== 'ok') {
      var lack = [];
      if (nW < R.need.nH) lack.push(R.need.nH + ' px sur la largeur');
      if (nH < R.need.nV) lack.push(R.need.nV + ' px sur la hauteur');
      flags.push({ t: R.status === 'limite' ? 'warn' : 'bad', m: 'Capteur ' + (R.status === 'limite' ? 'à la limite' : 'insuffisant') + ' pour ce champ : il faudrait ' + R.need.nH + ' × ' + R.need.nV + ' px (' + fmt(R.need.mpx, 1) + ' Mpx), ' + (lack.length ? 'il manque ' + lack.join(' et ') + '. ' : '') + 'Options : réduire le champ à ' + fmt(R.fovMax.H, 0) + ' × ' + fmt(R.fovMax.V, 0) + ' mm, accepter ' + fmt(R.capab, 0) + ' µm de ' + (meas ? 'précision' : 'défaut minimal') + ', ou choisir un capteur plus grand.' });
    }
    if (s.p <= 3.5) notes.push('Pixel de ' + fmt(s.p, 2) + ' µm : prévoir un objectif conçu pour ce pas (classe 5 Mpx et plus), sinon la résolution de l\'objectif limite l\'image.');
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
    var acc = [];
    if (kind === 'telecentrique') {
      acc.push({ t: 'info', n: 'Aucun accessoire d\'optique', m: 'Un télécentrique a un grossissement fixe : choisir la référence la plus proche de ' + fmt(ev.m, 3) + '× (champ objet = capteur ÷ grossissement). La distance de travail est imposée par l\'objectif, à comparer aux ' + fmt(s.wd, 0) + ' mm demandés. Éclairage : contre-jour collimaté ou éclairage coaxial.' });
    } else {
      if (fNeed > FOCAL_MAX_STD) {
        acc.push({ t: 'warn', n: 'Doubleur de focale', m: 'Il faut ≈ ' + fmt(fNeed, 0) + ' mm, au-delà des focales fixes usuelles (' + FOCAL_MAX_STD + ' mm). Un doubleur ×2 sur un objectif de ≈ ' + fmt(fNeed / 2, 0) + ' mm donne la focale voulue, au prix de 2 diaphragmes (f/' + fmt(s.nom, 1) + ' demande un objectif ouvrant à f/' + fmt(s.nom / 2, 1) + ') et d\'une perte de résolution. Alternative : un objectif macro ou télécentrique, ou rapprocher la caméra.' });
      }
      if (fNeed < 6) acc.push({ t: 'warn', n: 'Focale très courte', m: 'Environ ' + fmt(fNeed, 1) + ' mm : distorsion forte et vignetage. Augmenter la distance de travail ou découper le champ avec plusieurs caméras.' });
      if (ev.m > MACRO_M) {
        var fr = rec ? rec.f : 50, mt = fr * ev.m;
        acc.push({ t: 'info', n: 'Bague allonge ou macro', m: 'Grossissement de ' + fmt(ev.m, 3) + '×. Deux voies : un objectif macro, ou un objectif standard de ' + fr + ' mm avec une allonge totale de ≈ ' + fmt(mt, 1) + ' mm (formule f × m, à valider sur la fiche de l\'objectif). Les allonges réduisent la profondeur de champ et la lumière reçue.' });
      } else if (rec && s.wd < rec.mfd) {
        acc.push({ t: 'warn', n: 'Lentille additionnelle ou allonge', m: 'Distance de travail de ' + fmt(s.wd, 0) + ' mm sous la mise au point minimale d\'un ' + rec.f + ' mm (≈ ' + rec.mfd + ' mm, valeur type). Une allonge de ≈ ' + fmt(rec.tube, 1) + ' mm ou une lentille additionnelle d\'environ ' + fmt(1000 / s.wd, 1) + ' dioptries corrige cela.' });
      } else if (rec && rec.tube > 0.5) {
        acc.push({ t: 'info', n: 'Allonge', m: 'Une allonge d\'environ ' + fmt(rec.tube, 1) + ' mm au-delà du tirage de l\'objectif est utile pour cette distance.' });
      }
      if (!acc.length) acc.push({ t: 'good', n: 'Aucun accessoire nécessaire', m: 'Un objectif à focale fixe suffit, sans doubleur ni allonge.' });
    }
    R.acc = acc; R.flags = flags; R.notes = notes;
    // objectif retenu en une phrase
    R.headline = kind === 'telecentrique'
      ? 'Télécentrique, grossissement ≈ ' + fmt(ev.m, 3) + '×'
      : (rec ? (kind === 'macro' ? 'Macro ou standard avec allonge, ' : 'Standard, ') + 'focale ' + rec.f + ' mm' : 'Focale ≈ ' + fmt(fNeed, 1) + ' mm');
    R.fNeed = fNeed;
    R.mount = mountAdvice(R, s.mount);
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
    lightAdvice: lightAdvice, adviseOptic: adviseOptic, MOUNTS: MOUNTS, IMX_EXTRA: IMX_EXTRA, findSensor: findSensor, mountById: mountById, minFocusMm: minFocusMm, fmt: fmt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OptiCalc = api;
})(typeof self !== 'undefined' ? self : this);
