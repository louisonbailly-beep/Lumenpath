const C = require('./core.js');
let fail = 0;
function eq(name, got, want, tol) {
  const ok = Math.abs(got - want) <= (tol || 1e-6);
  if (!ok) fail++;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + ': ' + got + ' (attendu ' + want + ')');
}
// Cas publiés
eq('Nyquist 3,45 µm (Edmund : 144,9 lp/mm)', C.nyquist(3.45), 144.9, 0.05);
eq('Nyquist 2 µm = 250 lp/mm', C.nyquist(2), 250, 1e-9);
eq('Diffraction λ=550 nm f/8 : coupure 227 lp/mm', C.cutoff(550, 8), 227.27, 0.01);
eq('MTF diffraction x=0 -> 1', C.mtfDiff(0), 1);
eq('MTF diffraction x=1 -> 0', C.mtfDiff(1), 0);
eq('MTF diffraction x=0,5 -> 0,391', C.mtfDiff(0.5), 0.3910, 0.001);
// Géométrie capteurs (diagonale vs format optique annoncé)
const imx250 = C.SENSORS.find(s => s.id.startsWith('IMX250'));
const d250 = C.dims(imx250);
eq('IMX250 diagonale ≈ 11,0 mm (2/3")', d250.D, 11.0, 0.1);
const imx304 = C.SENSORS.find(s => s.id.startsWith('IMX253'));
eq('IMX304 diagonale ≈ 17,6 mm (Atik)', C.dims(imx304).D, 17.6, 0.1);
const imx571 = C.SENSORS.find(s => s.id === 'IMX571');
eq('IMX571 diagonale ≈ 28,3 mm (APS-C)', C.dims(imx571).D, 28.3, 0.2);
const imx927 = C.SENSORS.find(s => s.id.startsWith('IMX927'));
eq('IMX927 diagonale ≈ 39,7 mm (Sony)', C.dims(imx927).D, 39.7, 0.2);
const imx455 = C.SENSORS.find(s => s.id === 'IMX455');
eq('IMX455 diagonale ≈ 43,3 mm (Atik)', C.dims(imx455).D, 43.3, 0.1);
// Chaîne lentille mince
const m = 0.1;
const f = C.focalFor(275, m);
eq('f pour WD 275, m 0,1 -> 25 mm', f, 25, 0.001 + 0.0 + 0.0);
eq('m inverse', C.magAt(25, 275), 0.1 * (250 / 250) * 1.0 === 0.1 ? 0.1 : 0.1, 1e-9);
// Profondeur de champ exacte vs approx 2 N c (1+m)/m²
const dofx = C.dof(25, 8, 0.007, 275);
const approx = 2 * 8 * 0.007 * 1.1 / 0.01;
eq('DOF exacte vs approx (12,3 mm)', dofx.total, approx, 0.1);
// Scénario complet
const inp = { fovH: 100, fovV: 80, defect: 200, k: 3, color: false, globalOnly: true, wd: 300, nom: 5.6, lambda: 550, cocPx: 2, depth: 5, speed: 0, exposure: 100 };
const req = C.requiredPixels(inp);
eq('Pixels requis H = 100 mm * 3 / 0,2 mm = 1500', req.nH, 1500);
eq('Pixels requis V = 1200', req.nV, 1200);
const rank = C.rankSensors(inp);
console.log('Premier capteur :', rank[0].sensor.id, 'm=', rank[0].m.toFixed(4), 'ppd=', rank[0].ppd.toFixed(2), rank[0].status);
const ev0 = rank[0];
const lt = C.lensType(ev0, inp);
console.log('Type :', lt.kind, lt.reasons.map(x => x.m.slice(0, 40)));
if (lt.kind !== 'standard') fail++;
const sp = C.lensSpec(ev0, inp, lt);
eq('Focale spec = WD m/(1+m)', sp.f, C.focalFor(300, ev0.m), 1e-9);
eq('Résolution requise <= Nyquist', sp.nuK <= sp.nuN ? 1 : 0, 1);
const win = sp.win; console.log('Fenêtre f/# :', win);
// catalogue
const ml = C.matchCatalog(ev0, inp, C.DEMO_CATALOG, ['standard']);
console.log('Objectifs démo :', ml.length, ml[0] && (ml[0].e.f + ' mm ' + ml[0].verdict));
if (!ml.length) fail++;
// type télécentrique : mesure avec variation de hauteur
const inpM = Object.assign({}, inp, { fovH: 50, fovV: 40, wd: 250, depth: 2, defect: 50, k: 4, task: 'mesure' });
const evM = C.rankSensors(inpM)[0];
eq('Mesure + hauteur -> télécentrique', C.lensType(evM, inpM).kind === 'telecentrique' ? 1 : 0, 1);
const inpMac = Object.assign({}, inp, { fovH: 8, fovV: 6, wd: 80, depth: 0, defect: 10, k: 3 });
eq('Fort grandissement -> macro', C.lensType(C.rankSensors(inpMac)[0], inpMac).kind === 'macro' ? 1 : 0, 1);
// CSV
const csv = C.parseCatalog(C.CSV_TEMPLATE);
eq('CSV modèle : 3 lignes', csv.entries.length, 3);
eq('CSV virgule décimale', csv.entries[0].pixmax, 3.45);
eq('CSV res depuis pixel max = Nyquist', csv.entries[0].res, C.nyquist(3.45), 1e-6);
eq('CSV télécentrique grossissement', csv.entries[2].mag, 0.25);
const bad = C.parseCatalog('a;b\n1;2');
eq('CSV sans colonne type -> erreur', bad.errors.length > 0 ? 1 : 0, 1);
// Matière / longueur d'onde / filtre
eq('Décalage 0° = 0', C.blueShift(850, 0, 2), 0, 1e-12);
eq('Décalage 850 nm à 10° ≈ 3,2 nm (n*=2)', C.blueShift(850, 10 * Math.PI / 180, 2), 3.2, 0.1);
const lrS = C.resolveLambda({ material: 'general', lamCons: 'source', lamC: 850, lamFwhm: 30 });
eq('Contrainte source -> 850 nm', lrS.lam, 850);
const lrB = C.resolveLambda({ material: 'general', lamCons: 'band', lamMin: 620, lamMax: 680 });
eq('Plage 620–680 -> centre 650, largeur 60', lrB.lam + lrB.fwhm / 100, 650.6, 1e-9);
const lrSi = C.resolveLambda({ material: 'silicon', lamCons: 'auto' });
eq('Silicium -> 1300 nm', lrSi.lam, 1300);
const inpL = Object.assign({}, inp, { material: 'silicon', lamCons: 'auto', ambient: 'maitrisee' });
const lrL = C.resolveLambda(inpL); inpL.lambda = lrL.lam;
const evL = C.rankSensors(inpL);
eq('λ=1300 : capteurs silicium exclus', evL.filter(x => !x.excluded).every(x => x.sensor.swir) ? 1 : 0, 1);
const adv = C.lightAdvice(inpL, evL.filter(x => !x.excluded)[0], 'standard', lrL);
eq('Silicium : passe-haut', adv.filter ? (adv.filter.kind === 'longpass' ? 1 : 0) : 0, 1);
const lrF = C.resolveLambda({ material: 'fluo', lamCons: 'source', lamC: 365, lamFwhm: 15 });
const advF = C.lightAdvice(Object.assign({}, inp, { lambda: 365, nstar: 2 }), ev0, 'standard', lrF);
eq('UV 365 : passe-haut > 372 nm', advF.filter.cut > 372 ? 1 : 0, 1);
const advT = C.lightAdvice(Object.assign({}, inp, { lambda: 850, nstar: 2 }), ev0, 'telecentrique', C.resolveLambda({ material: 'general', lamCons: 'source', lamC: 850, lamFwhm: 30 }));
eq('Télécentrique : décalage nul', advT.shift, 0, 1e-9);
const advC = C.lightAdvice(Object.assign({}, inp, { lambda: 625, nstar: 2, tcolor: 'rouge' }), ev0, 'standard', C.resolveLambda({ material: 'metal', lamCons: 'auto' }));
eq('Métal : polarisation conseillée', advC.pol.use ? 1 : 0, 1);
// Capteur couleur : exigence doublée
const reqC = C.requiredPixels(Object.assign({}, inp, { color: true }));
eq('Capteur couleur : pixels requis ×2', reqC.nH, 3000);
const pr = id => C.estimatePrice(C.SENSORS.find(x => x.id.startsWith(id)));
eq('Prix IMX250 (5 Mpx global) = 670', pr('IMX250').usd, 670);
eq('Prix IMX541 (20 Mpx) = 1950', pr('IMX531').usd, 1950);
eq('Prix IMX585 (roulant 8 Mpx) = 340', pr('IMX585').usd, 340);
eq('SWIR sur devis', pr('IMX990').quote ? 1 : 0, 1);
eq('IMX455 hors plage -> devis', pr('IMX455').quote ? 1 : 0, 1);
const p252 = pr('IMX252').usd; eq('IMX252 (3,1 Mpx) entre 359 et 670', p252 > 359 && p252 < 670 ? 1 : 0, 1);
const B = { sw: 2448, sh: 2048, p: 3.45, wd: 300, fovH: 100, fovV: 80, depth: 5, task: 'detection', defect: 200, k: 3, nom: 5.6, lambda: 550, cocPx: 2, backlight: false };
const a1 = C.adviseOptic(B);
eq('Conseil : pixel objet maxi = 200/3', a1.reqPix, 66.667, 0.01);
eq('Conseil : m = 8.446/100', a1.m, 8.4456 / 100, 1e-4);
eq('Conseil : focale ≈ 23,4 mm -> 25 mm conseillé', a1.rec.f, 25);
eq('Conseil : capteur suffisant', a1.status === 'ok' ? 1 : 0, 1);
const a2 = C.adviseOptic(Object.assign({}, B, { task: 'mesure', prec: 10, subdiv: 3, fovH: 50, fovV: 40, wd: 250, depth: 2, backlight: true }));
eq('Mesure 10 µm, 1/3 px : pixel objet maxi 30 µm', a2.reqPix, 30);
eq('Mesure : télécentrique', a2.lt.kind === 'telecentrique' ? 1 : 0, 1);
const a3 = C.adviseOptic(Object.assign({}, B, { fovH: 600, fovV: 500, wd: 1200, defect: 500 }));
eq('Gros champ : capteur insuffisant', a3.status === 'insuffisant' ? 1 : 0, 1);
eq('Gros champ : pixels requis 3600 en largeur', a3.need.nH, 3600);
const a4 = C.adviseOptic(Object.assign({}, B, { fovH: 10, fovV: 8, wd: 120, defect: 20, depth: 0.5 }));
eq('Petit champ : macro', a4.lt.kind === 'macro' ? 1 : 0, 1);
const a5 = C.adviseOptic(Object.assign({}, B, { fovH: 20, fovV: 16, wd: 900, defect: 100 }));
console.log('Longue focale :', a5.headline, a5.acc.map(x => x.n));
eq('Longue focale : doubleur proposé', a5.fNeed > 100 && a5.acc.some(x => /Doubleur/.test(x.n)) ? 1 : 0, 1);
eq('IMX 530 trouvé', C.findSensor('IMX 530').w, 5320);
eq('IMX250LLR trouvé', C.findSensor('imx250llr').h, 2048);
eq('IMX296 (hors liste principale) trouvé', C.findSensor('IMX296').w, 1456);
eq('IMX999 introuvable', C.findSensor('IMX999') === null ? 1 : 0, 1);
const mS = C.adviseOptic(Object.assign({}, B, { mount: 'tfl' })).mount;
eq('TFL : capteur 11 mm accepté', mS.flags.some(f => f.t === 'good') ? 1 : 0, 1);
const big = C.adviseOptic(Object.assign({}, B, { sw: 6244, sh: 4168, p: 3.76, mount: 'c' })).mount;
eq('Capteur APS-C en C : refusé', big.flags.some(f => f.t === 'bad') ? 1 : 0, 1);
eq('Conseil capteur APS-C : TFL en tête', C.adviseOptic(Object.assign({}, B, { sw: 6244, sh: 4168, p: 3.76 })).mount.rec[0].id === 'tfl' ? 1 : 0, 1);
eq('Monture S : 11 mm toléré', C.adviseOptic(Object.assign({}, B, { mount: 's' })).mount.flags.some(f => f.t === 'bad') ? 1 : 0, 0);
console.log(fail ? ('ECHECS : ' + fail) : 'TOUS LES TESTS PASSENT');
process.exit(fail ? 1 : 0);
