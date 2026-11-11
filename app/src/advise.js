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
    return R;
  }
