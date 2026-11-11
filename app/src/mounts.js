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
      if (diag > lim) M.flags.push({ t: 'bad', m: 'Capteur trop grand pour cette monture : diagonale de ' + fmt(diag, 1) + ' mm contre ' + fmt(lim, 1) + ' mm environ. Vignetage assuré dans les coins.' });
      else if (m.diagExt && diag > m.diagStd) M.flags.push({ t: 'warn', m: 'Diagonale de ' + fmt(diag, 1) + ' mm : au-delà du format courant de cette monture (' + fmt(m.diagStd, 1) + ' mm). Choisir un objectif grand format dont le cercle d\'image dépasse ' + fmt(diag, 1) + ' mm.' });
      else M.flags.push({ t: 'good', m: 'Le capteur (' + fmt(diag, 1) + ' mm de diagonale) entre dans le format de cette monture.' });
      if (diag < lim * 0.35) M.flags.push({ t: 'info', m: 'Monture surdimensionnée pour ce capteur : encombrement et coût inutiles. ' + M.recText });
    } else M.flags.push({ t: 'info', m: 'Cercle d\'image maximal non renseigné pour cette monture : le demander au fabricant de l\'objectif.' });
    if (m.fr && R.lt.kind !== 'telecentrique') {
      if (R.fNeed < m.fr[0] * 0.8 || R.fNeed > m.fr[1] * 1.2) M.flags.push({ t: 'warn', m: 'Focale de ≈ ' + fmt(R.fNeed, 1) + ' mm peu courante dans cette monture (plage usuelle ' + m.fr[0] + ' à ' + m.fr[1] + ' mm, valeur de travail). Vérifier l\'offre ou changer de monture.' });
    }
    if (m.id === 'c' && R.rec && R.rec.f < 8) M.flags.push({ t: 'info', m: 'Courtes focales en monture C : objectifs plus encombrants qu\'en S-mount, mais plus stables mécaniquement.' });
    if (R.rec && (R.rec.tube > 0.3 || R.lt.kind === 'macro' || R.acc.some(function (a) { return /allonge|additionnelle/i.test(a.n); }))) M.flags.push({ t: 'info', m: 'Allonges : ' + m.ext });
    M.flags.push({ t: 'info', m: (m.flange != null ? 'Tirage de ' + fmt(m.flange, m.flange % 1 ? 3 : 1) + ' mm : l\'objectif et la caméra doivent avoir le même tirage. ' : 'Tirage non normalisé : à confirmer avec le fabricant. ') + m.note });
    return M;
  }
