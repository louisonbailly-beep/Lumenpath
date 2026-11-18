/* Vision Path : récit 3D de la page d'accueil.
   Au défilement : l'objectif se visse sur la caméra, le filtre sur l'objectif, les câbles se branchent,
   puis la caméra rejoint un poste de vision (potence, convoyeur, pièce, deux barres LED, champ de vue).
   Three.js r149 (build UMD, sans module complémentaire). Tout est modélisé dans le code :
   aucune maquette ni texture externe (les graduations sont dessinées dans un canvas).
   Unité : 1 = 10 mm. Axe optique de la caméra : +Z dans son repère propre. */
(function(){
  'use strict';
  var story = document.getElementById('assemblage');
  if(!story) return;
  var stage = story.querySelector('.stage'), canvas = story.querySelector('canvas');
  var home = story.closest('[data-view]');
  var T = window.THREE;

  function glOK(){
    try{
      var c = document.createElement('canvas');
      var g = c.getContext('webgl2') || c.getContext('webgl');
      if(g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext();
      return !!g;
    }catch(e){ return false; }
  }
  if(!T || !canvas || !stage || !T.WebGLRenderer || !glOK()){ story.classList.add('is-static'); return; }
  story.classList.add('is-3d');

  var steps = [].slice.call(story.querySelectorAll('.step'));
  var panels = steps.map(function(s){ return s.querySelector('.step-in'); });
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var NSTEP = steps.length - 1;

  /* ---------- Outils ---------- */
  function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ss(a, b, x){ x = clamp01((x - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); }
  function eo(a, b, x){ x = clamp01((x - a) / (b - a)); return 1 - Math.pow(1 - x, 3); }
  function mix(a, b, t){ return a + (b - a) * t; }

  /* ---------- État ---------- */
  var renderer, scene, cam, R = {};
  var inited = false, raf = 0, homeShown = false, onScreen = true, tabShown = !document.hidden;
  var sCur = 0, sTgt = 0, lastT = 0, dirty = true, mobile = false, Q = 1;
  var centers = [], vh = innerHeight, W = 0, H = 0;
  var panelState = [], ready = false;

  /* ======================================================================
     Construction de la scène
     ====================================================================== */
  function V2(r, y){ return new T.Vector2(r, y); }
  /* profil de révolution : P = point lissé, C = arête vive (point doublé : normales nettes, voir LatheGeometry) */
  function Prof(){ this.p = []; }
  Prof.prototype.P = function(r, y){ this.p.push(V2(r, y)); return this; };
  Prof.prototype.C = function(r, y){ this.p.push(V2(r, y), V2(r, y)); return this; };
  function lathe(prof, seg){ return new T.LatheGeometry(prof.p || prof, Math.max(24, Math.round(seg * Q))); }

  /* bague moletée (stries axiales) le long de Y */
  function knurl(R0, depth, h, N, y0){
    var per = Q < 1 ? 4 : 6, g = new T.CylinderGeometry(R0, R0, h, N * per, 1, true);
    var p = g.attributes.position;
    for(var i = 0; i < p.count; i++){
      var x = p.getX(i), z = p.getZ(i), th = Math.atan2(x, z);
      var s = Math.abs(Math.sin(N * th / 2));
      var k = 1 - ss(0.12, 0.62, s);
      var r = R0 - depth * k;
      p.setX(i, Math.sin(th) * r); p.setZ(i, Math.cos(th) * r);
    }
    g.computeVertexNormals();
    g.translate(0, y0 + h / 2, 0);
    return g;
  }
  function ring(r0, r1, y, up){
    var g = new T.RingGeometry(r0, r1, Math.round(128 * Q) || 64, 1);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate(0, y, 0); return g;
  }
  function rrectShape(w, h, r){
    var s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function extrude(shape, depth, bevel){
    return new T.ExtrudeGeometry(shape, { depth: depth, curveSegments: Q < 1 ? 6 : 10,
      bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: bevel ? 3 : 0 });
  }
  function mesh(g, m, parent, cast){
    var o = new T.Mesh(g, m); if(cast !== false) o.castShadow = true; if(parent) parent.add(o); return o;
  }
  function box(w, h, d, m, parent, x, y, z){ var o = mesh(new T.BoxGeometry(w, h, d), m, parent); o.position.set(x || 0, y || 0, z || 0); return o; }
  function cyl(r0, r1, h, m, parent, seg){ return mesh(new T.CylinderGeometry(r0, r1, h, Math.max(12, Math.round((seg || 48) * Q))), m, parent); }

  /* graduation gravée : traits et chiffres blancs, dessinés dans un canvas */
  function scaleTexture(labels, from, to, long){
    var c = document.createElement('canvas'); c.width = 2048; c.height = 128;
    var x = c.getContext('2d'); x.clearRect(0, 0, 2048, 128);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '600 50px -apple-system, "Helvetica Neue", Arial, sans-serif';
    for(var i = 0; i < labels.length; i++){
      var u = from + (to - from) * i / (labels.length - 1), px = u * 2048;
      x.fillRect(px - 2, 4, 4, 30);
      x.fillText(labels[i], px, 82);
      if(i < labels.length - 1){ var m = px + (to - from) * 2048 / (labels.length - 1) / 2; x.fillRect(m - 1.5, 4, 3, 16); }
    }
    if(long != null){ var lp = long * 2048; x.fillRect(lp - 3, 0, 6, 128); }
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  function makeMaterials(){
    var M = {};
    M.anod = new T.MeshPhysicalMaterial({ color: 0x17181b, metalness: 0.55, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.28 });
    M.knurl = new T.MeshStandardMaterial({ color: 0x141518, metalness: 0.5, roughness: 0.46 });
    M.silver = new T.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.24 });
    M.steel = new T.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.32 });
    M.body = new T.MeshPhysicalMaterial({ color: 0x4d5763, metalness: 0.62, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    M.bodyDark = new T.MeshStandardMaterial({ color: 0x23272d, metalness: 0.5, roughness: 0.45 });
    M.void = new T.MeshStandardMaterial({ color: 0x050506, metalness: 0, roughness: 0.9 });
    M.voidIn = new T.MeshStandardMaterial({ color: 0x060607, metalness: 0, roughness: 0.85, side: T.BackSide });
    M.plastic = new T.MeshStandardMaterial({ color: 0x24272c, metalness: 0, roughness: 0.55 });
    M.cable = new T.MeshStandardMaterial({ color: 0x1d2024, metalness: 0, roughness: 0.48 });
    M.cableIO = new T.MeshStandardMaterial({ color: 0x2b3038, metalness: 0, roughness: 0.52 });
    M.hole = new T.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    M.holeRim = new T.MeshStandardMaterial({ color: 0x8c949e, metalness: 0.9, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    M.glass = new T.MeshPhysicalMaterial({ color: 0x0b0d14, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [260, 430], transparent: true, opacity: 0.9, envMapIntensity: 1.15 });
    M.glassIn = new T.MeshPhysicalMaterial({ color: 0x0d1020, metalness: 0, roughness: 0.05, iridescence: 1, iridescenceIOR: 1.3,
      iridescenceThicknessRange: [300, 500], transparent: true, opacity: 0.4, envMapIntensity: 0.8 });
    M.filter = new T.MeshPhysicalMaterial({ color: 0x8e0a1f, metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [380, 520], transparent: true, opacity: 0.82, envMapIntensity: 1.3 });
    M.sensor = new T.MeshPhysicalMaterial({ color: 0x1a1430, metalness: 0.3, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.5,
      iridescenceThicknessRange: [200, 600], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    M.led = new T.MeshStandardMaterial({ color: 0x0c2a14, emissive: 0x2bd96b, emissiveIntensity: 0, roughness: 0.3 });
    M.alu = new T.MeshStandardMaterial({ color: 0xc8cdd3, metalness: 0.85, roughness: 0.36 });
    M.aluDark = new T.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.6, roughness: 0.42 });
    M.belt = new T.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0, roughness: 0.82, envMapIntensity: 0.45 });
    M.rubber = new T.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0, roughness: 0.7 });
    M.part = new T.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.2 });
    M.diff = new T.MeshStandardMaterial({ color: 0xdfe5ec, emissive: 0xeef5ff, emissiveIntensity: 0, roughness: 0.35, metalness: 0 });
    M.fovLine = new T.LineBasicMaterial({ color: 0x0a72e0, transparent: true, opacity: 0 });
    M.fovFill = new T.MeshBasicMaterial({ color: 0x0a72e0, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    return M;
  }

  /* ---------- Objectif C (le long de Y, bride arrière en y = 0) ---------- */
  function buildLens(M){
    var g = new T.Group();
    // filetage C (1"-32), argenté
    var th = new Prof().C(1.02, -0.44).C(1.19, -0.44).P(1.215, -0.42);
    for(var y = -0.40; y < -0.04; y += 0.0794){ th.P(1.25, y + 0.022).P(1.25, y + 0.034).P(1.212, y + 0.0794); }
    th.C(1.212, -0.006).C(1.02, -0.006);
    mesh(lathe(th, 96), M.silver, g);
    // fût anodisé noir
    var b = new Prof().C(0.99, 0).C(1.43, 0).C(1.47, 0.04).C(1.47, 0.17).C(1.41, 0.21).C(1.41, 0.27).C(1.5, 0.33)
      .C(1.5, 1.44).C(1.57, 1.47).C(1.57, 1.87).C(1.5, 1.9)
      .C(1.5, 2.66).C(1.66, 2.66).C(1.66, 3.02).C(1.62, 3.06).C(1.56, 3.06).C(1.56, 3.12).C(1.62, 3.16)
      .C(1.62, 4.2).C(1.57, 4.28).C(1.445, 4.28);
    for(var k = 4.25; k > 4.06; k -= 0.05){ b.P(1.418, k).P(1.445, k - 0.025); }
    b.C(1.445, 4.02).C(1.3, 4.02).C(1.3, 3.82).C(1.12, 3.78).C(1.12, 3.7).C(0.99, 3.7).C(0.99, 0.0);
    mesh(lathe(b, 128), M.anod, g);
    // bagues moletées : diaphragme et mise au point
    mesh(knurl(1.63, 0.045, 0.8, 64, 0.62), M.knurl, g);
    mesh(ring(1.5, 1.63, 0.62, false), M.knurl, g); mesh(ring(1.5, 1.63, 1.42, true), M.knurl, g);
    mesh(knurl(1.7, 0.05, 0.74, 72, 1.92), M.knurl, g);
    mesh(ring(1.5, 1.7, 1.92, false), M.knurl, g); mesh(ring(1.62, 1.7, 2.66, true), M.knurl, g);
    // graduations : ouverture (bande lisse) et distance (avant de la bague de mise au point)
    var tf = scaleTexture(['1.4', '2', '2.8', '4', '5.6', '8', '11', '16'], 0.17, 0.5, 0.36);
    var tm = new T.MeshStandardMaterial({ map: tf, transparent: true, alphaTest: 0.35, roughness: 0.5, metalness: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    var band = mesh(new T.CylinderGeometry(1.572, 1.572, 0.36, 160, 1, true), tm, g, false); band.position.y = 1.67;
    var td = scaleTexture(['0.25', '0.3', '0.5', '1', '3', '∞'], 0.2, 0.48, null);
    var tdm = tm.clone(); tdm.map = td;
    var band2 = mesh(new T.CylinderGeometry(1.662, 1.662, 0.3, 160, 1, true), tdm, g, false); band2.position.y = 2.84;
    // vis de blocage moletées
    [[1.63, 1.02, 2.35], [1.66, 2.84, 2.0]].forEach(function(a){
      var s = new T.Group(); s.position.y = a[1]; s.rotation.y = a[2]; g.add(s);
      var base = cyl(0.11, 0.11, 0.08, M.silver, s, 24); base.rotation.z = Math.PI / 2; base.position.x = a[0] + 0.03;
      var head = mesh(knurl(0.135, 0.015, 0.16, 14, -0.08), M.silver, s); head.rotation.z = -Math.PI / 2; head.position.x = a[0] + 0.15;
      var cap = mesh(new T.CircleGeometry(0.135, 24), M.silver, s); cap.rotation.y = Math.PI / 2; cap.position.x = a[0] + 0.23;
    });
    // optique : lentille frontale traitée, lentille interne, diaphragme
    var Rc = 2.6, tm1 = Math.asin(1.13 / Rc), hc = Rc * (1 - Math.cos(tm1));
    var front = mesh(new T.SphereGeometry(Rc, Math.round(72 * Q), Math.round(18 * Q) + 4, 0, Math.PI * 2, 0, tm1), M.glass, g, false);
    front.position.y = 3.7 - Rc + hc + 0.02; front.renderOrder = 3;
    var Ri = 1.7, ti = Math.asin(0.95 / Ri), hi = Ri * (1 - Math.cos(ti));
    var inner = mesh(new T.SphereGeometry(Ri, Math.round(48 * Q), 10, 0, Math.PI * 2, 0, ti), M.glassIn, g, false);
    inner.position.y = 3.15 - Ri + hi; inner.renderOrder = 2;
    mesh(ring(0.32, 0.99, 2.9, true), M.void, g, false);
    mesh(new T.CircleGeometry(0.99, 48).rotateX(-Math.PI / 2).translate(0, 1.6, 0), M.void, g, false);
    return g;
  }

  /* ---------- Filtre passe-bande vissé à l'avant de l'objectif (le long de Y) ---------- */
  function buildFilter(M){
    var g = new T.Group();
    var p = new Prof().C(1.3, -0.18).C(1.4, -0.18);
    for(var y = -0.17; y < -0.02; y += 0.05){ p.P(1.432, y + 0.012).P(1.432, y + 0.02).P(1.4, y + 0.05); }
    p.C(1.405, 0).C(1.53, 0).C(1.575, 0.045).C(1.575, 0.3).C(1.53, 0.345).C(1.37, 0.345).C(1.32, 0.3).C(1.32, -0.18);
    mesh(lathe(p, 128), M.anod, g);
    mesh(knurl(1.6, 0.022, 0.2, 120, 0.075), M.knurl, g);
    mesh(ring(1.575, 1.6, 0.075, false), M.knurl, g); mesh(ring(1.575, 1.6, 0.275, true), M.knurl, g);
    var glass = cyl(1.33, 1.33, 0.05, M.filter, g, 96); glass.position.y = 0.16; glass.renderOrder = 4; glass.castShadow = false;
    return g;
  }

  /* ---------- Caméra industrielle compacte (29 × 29 × 42 mm), sans marque ---------- */
  function buildCamera(M){
    var g = new T.Group();
    var bv = 0.045, sq = 2.9 - 2 * bv;
    // corps principal (z de -4.2 à -0.6) et plaque avant percée (z de -0.6 à 0) : la jonction forme un fin chanfrein
    var main = mesh(extrude(rrectShape(sq, sq, 0.14), 3.6 - 2 * bv, bv), M.body, g); main.position.z = -4.2 + bv;
    var fs = rrectShape(sq, sq, 0.14); var hole = new T.Path(); hole.absarc(0, 0, 1.38, 0, Math.PI * 2, true); fs.holes.push(hole);
    var fr = mesh(extrude(fs, 0.6 - 2 * bv, bv), M.body, g); fr.position.z = -0.6 + bv;
    // intérieur noir, capteur 2/3"
    var sleeve = mesh(new T.CylinderGeometry(1.32, 1.32, 0.62, 64, 1, true), M.voidIn, g, false); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = -0.3;
    var back = mesh(new T.CircleGeometry(1.34, 64), M.void, g, false); back.position.z = -0.58;
    var sen = mesh(new T.PlaneGeometry(0.845, 0.707), M.sensor, g, false); sen.position.z = -0.575;
    var pkg = mesh(new T.PlaneGeometry(1.25, 1.05), M.bodyDark, g, false); pkg.position.z = -0.578;
    // monture C avant : bague en saillie avec filetage femelle
    var m = new Prof().C(1.28, -0.02).C(1.6, -0.02).C(1.6, 0.2).C(1.56, 0.25).C(1.33, 0.25).C(1.3, 0.22);
    for(var y = 0.2; y > 0.02; y -= 0.0794){ m.P(1.27, y - 0.02).P(1.3, y - 0.05); }
    m.C(1.28, 0.0);
    var mount = mesh(lathe(m, 128), M.bodyDark, g); mount.rotation.x = Math.PI / 2;
    // trous de fixation M3 : dessus, dessous, côtés
    var hg = new T.CircleGeometry(0.115, 20), rg = new T.RingGeometry(0.115, 0.165, 24);
    [-0.95, -3.25].forEach(function(z){
      [[0, 1.4501, 0, -Math.PI / 2], [0, -1.4501, 0, Math.PI / 2], [1.4501, 0, 1, 0], [-1.4501, 0, -1, 0]].forEach(function(f){
        (function(){
          var h1 = mesh(hg, M.hole, g, false), h2 = mesh(rg, M.holeRim, g, false);
          [h1, h2].forEach(function(h){
            if(f[2] === 0){ h.rotation.x = f[3]; h.position.set(0, f[1], z); }
            else { h.rotation.y = f[2] * Math.PI / 2; h.position.set(f[0], 0, z); }
          });
        })();
      });
    });
    // panneau arrière : USB3 Micro-B à vis, Hirose 6 points, LED d'état
    var bz = -4.2;
    var plate = box(2.3, 0.62, 0.04, M.steel, g, 0, 0.42, bz - 0.02);
    var port = box(1.12, 0.3, 0.012, M.void, g, 0, 0.42, bz - 0.041); port.castShadow = false;
    var tongue = box(0.8, 0.07, 0.012, M.steel, g, 0, 0.44, bz - 0.05); tongue.castShadow = false;
    [-0.9, 0.9].forEach(function(x){ var s = mesh(new T.CircleGeometry(0.075, 16), M.hole, g, false); s.position.set(x, 0.42, bz - 0.041); s.rotation.y = Math.PI; });
    var boss = cyl(0.36, 0.36, 0.12, M.steel, g, 40); boss.rotation.x = Math.PI / 2; boss.position.set(-0.7, -0.62, bz - 0.06);
    var bossIn = mesh(new T.CircleGeometry(0.26, 32), M.void, g, false); bossIn.position.set(-0.7, -0.62, bz - 0.121); bossIn.rotation.y = Math.PI;
    for(var i = 0; i < 6; i++){
      var a = i / 6 * Math.PI * 2, pin = cyl(0.025, 0.025, 0.05, M.silver, g, 8);
      pin.rotation.x = Math.PI / 2; pin.position.set(-0.7 + Math.cos(a) * 0.15, -0.62 + Math.sin(a) * 0.15, bz - 0.13);
    }
    var led = box(0.16, 0.16, 0.03, M.led, g, 0.62, -0.62, bz - 0.01); led.castShadow = false;
    var led2 = box(0.16, 0.16, 0.03, M.bodyDark, g, 0.95, -0.62, bz - 0.01); led2.castShadow = false;
    return g;
  }

  /* ---------- Câbles : USB3 à vis et E/S Hirose (arrivent par l'arrière, axe -Z) ---------- */
  function buildCables(M){
    var data = new T.Group(), io = new T.Group(), bz = -4.24;
    var hs = rrectShape(2.12, 0.62, 0.16);
    var head = mesh(extrude(hs, 0.82, 0.05), M.plastic, data); head.position.set(0, 0.42, bz - 0.87);
    var nose = box(1.1, 0.28, 0.3, M.steel, data, 0, 0.42, bz + 0.12); nose.castShadow = false;
    var screws = [];
    [-0.9, 0.9].forEach(function(x){
      var s = new T.Group(); s.position.set(x, 0.42, bz - 0.92); data.add(s);
      var k = mesh(knurl(0.17, 0.018, 0.34, 18, -0.17), M.silver, s); k.rotation.x = Math.PI / 2; k.position.z = -0.12;
      var c = mesh(new T.CircleGeometry(0.17, 24), M.silver, s); c.rotation.y = Math.PI; c.position.z = -0.29;
      var shaft = cyl(0.06, 0.06, 1.3, M.silver, s, 12); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.6;
      screws.push(s);
    });
    var sr = cyl(0.32, 0.25, 0.6, M.plastic, data, 32); sr.rotation.x = Math.PI / 2; sr.position.set(0, 0.42, bz - 1.2);
    var dPts = [[0, 0.42, -5.6], [0, 0.4, -6.6], [0.08, 0.05, -8.4], [0.3, -1.0, -10.8], [0.62, -2.5, -14.2], [1.0, -4.1, -19], [1.5, -6.2, -27], [2.0, -8.5, -36]];
    var dCurve = new T.CatmullRomCurve3(dPts.map(function(p){ return new T.Vector3(p[0], p[1], p[2]); }), false, 'centripetal');
    mesh(new T.TubeGeometry(dCurve, Math.round(160 * Q), 0.22, Math.round(16 * Q) + 4, false), M.cable, data);
    // E/S : connecteur rond à écrou moleté
    var ix = -0.7, iy = -0.62;
    var nut = mesh(knurl(0.43, 0.02, 0.42, 28, -0.21), M.steel, io); nut.rotation.x = Math.PI / 2; nut.position.set(ix, iy, bz - 0.29);
    var nutCap = mesh(new T.RingGeometry(0.27, 0.43, 40), M.steel, io); nutCap.position.set(ix, iy, bz - 0.08);
    var ib = cyl(0.33, 0.33, 0.8, M.plastic, io, 36); ib.rotation.x = Math.PI / 2; ib.position.set(ix, iy, bz - 0.95);
    var isr = cyl(0.3, 0.17, 0.5, M.plastic, io, 28); isr.rotation.x = Math.PI / 2; isr.position.set(ix, iy, bz - 1.6);
    var iPts = [[ix, iy, -5.75], [ix - 0.04, iy - 0.08, -6.8], [-0.86, -1.35, -8.7], [-1.0, -2.5, -11.2], [-1.15, -3.9, -14.6], [-1.35, -5.6, -19.4], [-1.7, -7.8, -27.5], [-2.1, -10.4, -36]];
    var iCurve = new T.CatmullRomCurve3(iPts.map(function(p){ return new T.Vector3(p[0], p[1], p[2]); }), false, 'centripetal');
    mesh(new T.TubeGeometry(iCurve, Math.round(160 * Q), 0.14, Math.round(12 * Q) + 4, false), M.cableIO, io);
    return { data: data, io: io, screws: screws, nut: nut };
  }

  /* ---------- Profilé aluminium à rainure en T ---------- */
  function tslot(a){
    var h = a / 2, c = a * 0.05, so = a * 0.15, L = a * 0.09, u = a * 0.3, D = a * 0.32;
    var side = [[-h + c, -h], [-so, -h], [-so, -h + L], [-u, -h + L], [-u, -h + D], [u, -h + D], [u, -h + L], [so, -h + L], [so, -h], [h - c, -h]];
    var s = new T.Shape(), first = true;
    for(var k = 0; k < 4; k++){
      var ca = Math.cos(k * Math.PI / 2), sa = Math.sin(k * Math.PI / 2);
      side.forEach(function(p){
        var x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca;
        if(first){ s.moveTo(x, y); first = false; } else s.lineTo(x, y);
      });
    }
    var hp = new T.Path(); hp.absarc(0, 0, a * 0.1, 0, Math.PI * 2, true); s.holes.push(hp);
    return s;
  }

  /* ---------- Poste de vision (repère monde ; caméra finale à l'origine, visée vers le bas) ---------- */
  var FRONT = 4.87, WD = 8, PART_H = 0.8, YB = -(FRONT + WD + PART_H);
  function buildStation(M){
    var st = { conv: new T.Group(), lights: new T.Group(), post: new T.Group(), fov: new T.Group(), spots: [], diffs: [] };
    var cv = st.conv;
    // convoyeur à bande
    var belt = box(24, 0.12, 6, M.belt, cv, 0, YB - 0.06, 0); belt.receiveShadow = true;
    var ret = box(24, 0.08, 5.6, M.belt, cv, 0, YB - 1.05, 0); ret.receiveShadow = true;
    [-12, 12].forEach(function(x){ var r = cyl(0.56, 0.56, 6, M.rubber, cv, 40); r.rotation.x = Math.PI / 2; r.position.set(x, YB - 0.56, 0); });
    var railShape = rrectShape(1.4, 0.5, 0.05);
    [-3.3, 3.3].forEach(function(z){
      var rail = mesh(extrude(railShape, 25.4, 0.02), M.alu, cv); rail.rotation.y = Math.PI / 2; rail.rotation.z = Math.PI / 2;
      rail.position.set(-12.7, YB - 0.45, z); rail.receiveShadow = true;
      var gr = box(25.4, 0.12, 0.02, M.aluDark, cv, 0, YB - 0.5, z + (z > 0 ? 0.265 : -0.265)); gr.castShadow = false;
      [-12, 12].forEach(function(x){ var ax = cyl(0.16, 0.16, 0.1, M.steel, cv, 20); ax.rotation.x = Math.PI / 2; ax.position.set(x, YB - 0.56, z + (z > 0 ? 0.3 : -0.3)); });
    });
    var leg = tslot(1.0);
    [[-10, -2.6], [10, -2.6], [-10, 2.6], [10, 2.6]].forEach(function(p){
      var l = mesh(extrude(leg, 26, 0), M.alu, cv); l.rotation.x = Math.PI / 2; l.position.set(p[0], YB - 1.15, p[1]); l.receiveShadow = true;
    });
    // pièce usinée : bride en aluminium
    var pp = new Prof().C(0.62, 0).C(2.0, 0).C(2.0, 0.3).C(1.96, 0.34).C(1.62, 0.34).C(1.62, 0.74).C(1.56, 0.8).C(0.8, 0.8).C(0.62, 0.66).C(0.62, 0);
    var part = mesh(lathe(pp, 128), M.part, cv); part.position.y = YB; part.receiveShadow = true;
    // ombre de contact douce sous la pièce (dégradé radial dessiné dans un canvas)
    var cc = document.createElement('canvas'); cc.width = cc.height = 128;
    var cx = cc.getContext('2d'), gr = cx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    var ct = new T.CanvasTexture(cc);
    var contact = new T.Mesh(new T.PlaneGeometry(5.6, 5.6).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    contact.position.y = YB + 0.002; cv.add(contact);
    for(var i = 0; i < 6; i++){
      var a = i / 6 * Math.PI * 2 + Math.PI / 6;
      var h = mesh(new T.CircleGeometry(0.11, 20).rotateX(-Math.PI / 2), M.hole, cv, false); h.position.set(Math.cos(a) * 1.81, YB + 0.341, Math.sin(a) * 1.81);
    }
    // barres LED : boîtier extrudé, diffuseur, supports d'extrémité sur tiges
    var hsh = rrectShape(1.3, 0.85, 0.12);
    [1, -1].forEach(function(sd){
      var L = new T.Group(); st.lights.add(L);
      var pz = sd * 3.9, py = YB + 3.6;
      var arm = new T.Group(); arm.position.set(0, py, pz);
      arm.rotation.x = sd * Math.atan2(Math.abs(pz), py - (YB + PART_H));
      L.add(arm);
      var hb = mesh(extrude(hsh, 8.9, 0.04), M.aluDark, arm); hb.rotation.y = Math.PI / 2; hb.position.x = -4.45 + 0.04;
      var df = box(8.7, 0.03, 0.98, M.diff, arm, 0, -0.455, 0); df.castShadow = false; st.diffs.push(df);
      [-4.5, 4.5].forEach(function(x){ box(0.08, 0.92, 1.36, M.alu, arm, x + (x > 0 ? 0.03 : -0.03), 0, 0); });
      var gland = cyl(0.12, 0.14, 0.35, M.plastic, arm, 16); gland.rotation.z = Math.PI / 2; gland.position.set(4.72, 0.15, 0);
      [-4.85, 4.85].forEach(function(x){
        var br = box(0.1, 1.0, 0.9, M.alu, L, x, py, pz);
        var knob = cyl(0.2, 0.2, 0.22, M.steel, L, 24); knob.rotation.z = Math.PI / 2; knob.position.set(x + (x > 0 ? 0.15 : -0.15), py, pz);
        var rod = cyl(0.13, 0.13, py - (YB - 0.3) - 0.45, M.steel, L, 20); rod.position.set(x, (py - 0.45 + YB - 0.3) / 2, pz);
        var ft = box(0.5, 0.5, 0.6, M.aluDark, L, x, YB - 0.45, sd * 3.85);
      });
      var sp = new T.SpotLight(0xf3f8ff, 0, 22, 0.75, 1, 1.2);
      sp.position.set(0, py - 0.4, pz * 0.92); sp.target.position.set(0, YB + PART_H, 0);
      L.add(sp); L.add(sp.target); st.spots.push(sp);
    });
    // potence : montant, bras, noix de serrage, plaque de fixation sur la face inférieure de la caméra
    var ps = tslot(2.0);
    var post = mesh(extrude(ps, 38, 0), M.alu, st.post); post.rotation.x = -Math.PI / 2; post.position.set(0, -32, -8);
    box(2.0, 0.12, 2.0, M.plastic, st.post, 0, 6.06, -8);
    var as = tslot(1.6);
    var armG = mesh(extrude(as, 5.0, 0), M.alu, st.post); armG.position.set(0, 2.1, -6.9);
    var nutB = box(2.5, 2.1, 2.5, M.aluDark, st.post, 0, 2.1, -8);
    [-0.55, 0.55].forEach(function(y){ var s = cyl(0.17, 0.17, 0.1, M.steel, st.post, 20); s.rotation.z = Math.PI / 2; s.position.set(1.3, 2.1 + y, -8); });
    box(1.9, 1.9, 0.38, M.aluDark, st.post, 0, 2.1, -1.88);
    box(2.6, 3.7, 0.22, M.alu, st.post, 0, 2.1, -1.56);
    [[-0.95, 0.55], [0.95, 0.55], [-0.95, 3.65], [0.95, 3.65]].forEach(function(p){
      var s = cyl(0.13, 0.13, 0.08, M.steel, st.post, 20); s.rotation.x = Math.PI / 2; s.position.set(p[0], p[1] - 0.1, -1.71);
    });
    // champ de vue : pyramide du haut de l'objectif aux coins du champ sur la bande
    var hw = 3.4, hd = 2.8, dy = YB + 0.012 + FRONT;
    var v = [], c4 = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    c4.forEach(function(c, i){ var n = c4[(i + 1) % 4]; v.push(0, 0, 0, c[0], dy, c[1], c[0], dy, c[1], n[0], dy, n[1]); });
    var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    st.fov.add(new T.LineSegments(lg, M.fovLine));
    var fill = new T.Mesh(new T.PlaneGeometry(hw * 2, hd * 2).rotateX(-Math.PI / 2), M.fovFill); fill.position.y = dy; st.fov.add(fill);
    st.fov.position.y = -FRONT;
    return st;
  }

  /* ---------- Environnement studio (boîtes à lumière), précalculé par PMREM ---------- */
  function buildEnv(){
    var env = new T.Scene();
    function lum(v, tint){ var c = new T.Color(); c.setRGB(v * (tint ? tint[0] : 1), v * (tint ? tint[1] : 1), v * (tint ? tint[2] : 1)); return c; }
    env.add(new T.Mesh(new T.BoxGeometry(40, 26, 40), new T.MeshBasicMaterial({ color: lum(0.42, [0.96, 0.98, 1.02]), side: T.BackSide })));
    function panel(w, h, x, y, z, rx, ry, v, tint){
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: lum(v, tint), side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); env.add(m);
    }
    panel(40, 40, 0, -12.9, 0, -Math.PI / 2, 0, 0.16);                 // sol plus sombre
    panel(20, 12, 0, 12.8, 2, Math.PI / 2, 0, 6.0);                     // grand plafonnier
    panel(5, 18, -19.8, 1, -4, 0, Math.PI / 2, 4.2);                    // bande gauche
    panel(12, 14, 19.8, 0, 3, 0, -Math.PI / 2, 3.2, [0.95, 0.98, 1.05]); // grande boîte droite
    panel(3, 16, 6, 2, -19.8, 0, 0, 3.0);                               // contre-jour
    panel(14, 7, -2, 1, 19.8, 0, Math.PI, 1.6, [0.9, 0.96, 1.08]);      // face, légèrement bleutée
    return env;
  }

  function init(){
    if(inited) return;
    inited = true;
    mobile = Math.min(innerWidth, screen.width || innerWidth) < 760 || matchMedia('(pointer: coarse)').matches;
    Q = mobile ? 0.6 : 1;
    try{
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    }catch(e){ fail(); return; }
    if(T.ColorManagement) T.ColorManagement.legacyMode = false;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));

    scene = new T.Scene();
    var pm = new T.PMREMGenerator(renderer);
    var envScene = buildEnv();
    scene.environment = pm.fromScene(envScene, 0.035).texture;
    envScene.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    pm.dispose();

    cam = new T.PerspectiveCamera(30, 1, 0.1, 400);

    var key = new T.DirectionalLight(0xffffff, 1.1);
    key.position.set(9, 16, 12); key.castShadow = true;
    key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    key.target.position.set(0, -10, 0);
    scene.add(key, key.target);
    var rim = new T.DirectionalLight(0xdfe9ff, 0.5); rim.position.set(-10, 6, -14); scene.add(rim);
    R.key = key; R.rim = rim;

    var M = R.M = makeMaterials();
    // caméra + objectif + filtre + câbles : un seul ensemble, pivot sur la face avant du boîtier
    var rig = new T.Group(); scene.add(rig); R.rig = rig;
    R.body = new T.Group(); rig.add(R.body); R.body.add(buildCamera(M));
    // objectif : porteur (position sur l'axe) > présentation (lacet en ouverture) > vissage (rotation propre)
    R.lensHolder = new T.Group(); rig.add(R.lensHolder);
    R.lensShow = new T.Group(); R.lensShow.position.z = 2.15; R.lensHolder.add(R.lensShow);
    R.lensSpin = new T.Group(); R.lensSpin.position.z = -2.15; R.lensShow.add(R.lensSpin);
    var la = buildLens(M); la.rotation.x = Math.PI / 2; R.lensSpin.add(la);
    R.filterHolder = new T.Group(); rig.add(R.filterHolder);
    var fa = buildFilter(M); fa.rotation.x = Math.PI / 2; R.filterHolder.add(fa);
    var cb = buildCables(M); R.cables = cb; rig.add(cb.data, cb.io);
    rig.traverse(function(o){ if(o.isMesh) o.receiveShadow = false; });

    var st = R.st = buildStation(M);
    scene.add(st.conv, st.lights, st.post, st.fov);

    if(/[?&]debug3d\b/.test(location.search)) window.__vp3d = { R: R, renderer: renderer, scene: scene, cam: cam, state: function(){ return { raf: raf, inited: inited, homeShown: homeShown, onScreen: onScreen, tabShown: tabShown, ready: ready, s: sCur }; }, go: function(v){ sCur = sTgt = v; updatePanels(); update(v, performance.now() / 1000); renderer.render(scene, cam); ready = true; stage.classList.add('ready'); } };
    applyTheme();
    onResize();
    measure();
    sCur = sTgt = targetS();
    if(mqReduce.matches) sCur = Math.round(sCur);
  }
  /* ton du champ de vue : bleu d'accent du thème (clair #0066CC, sombre #2997FF) */
  function applyTheme(){
    if(!inited || !R.M) return;
    var dark = false;
    try{ dark = getComputedStyle(document.documentElement).colorScheme.indexOf('dark') >= 0; }catch(e){}
    var c = dark ? 0x2997ff : 0x0a6fdc;
    R.M.fovLine.color.setHex(c); R.M.fovFill.color.setHex(c);
    dirty = true;
  }
  function fail(){
    story.classList.remove('is-3d'); story.classList.add('is-static');
    stop();
  }

  /* ======================================================================
     Chorégraphie : tout dépend d'un seul indice s (0 = ouverture … 5 = poste complet)
     ====================================================================== */
  var LENS_SEAT = 0.25, FILTER_SEAT = 0.25 + 4.28;
  var VIEWS = [
    // s, cible [x,y,z], distance, azimut, élévation
    { s: 0, t: [0, 0, 11.2], r: 17, az: 0.62, el: 0.2 },
    { s: 1, t: [0, 0, 11.0], r: 11.5, az: 1.32, el: 0.1 },
    { s: 2, t: [0, 0, 0.2], r: 21, az: 0.98, el: 0.24 },
    { s: 3, t: [0, 0, 1.8], r: 16, az: 0.46, el: 0.17 },
    { s: 4, t: [0, -0.3, -3.2], r: 19, az: 2.45, el: 0.3 },
    { s: 4.5, t: [0, -1.5, -0.5], r: 30, az: 1.75, el: 0.28 },
    { s: 5, t: [0, -5.6, -1], r: 60, az: 0.8, el: 0.34 }
  ];
  var vT = new T.Vector3(), vP = new T.Vector3();
  function view(s){
    var i = 0; while(i < VIEWS.length - 2 && s > VIEWS[i + 1].s) i++;
    var a = VIEWS[i], b = VIEWS[i + 1], k = ss(a.s, b.s, s);
    var r = mix(a.r, b.r, k), az = mix(a.az, b.az, k), el = mix(a.el, b.el, k);
    vT.set(mix(a.t[0], b.t[0], k), mix(a.t[1], b.t[1], k), mix(a.t[2], b.t[2], k));
    var asp = W / Math.max(1, H);
    if(asp < 1.25) r *= Math.min(2.3, Math.pow(1.25 / asp, 0.78)) * (mobile ? 1 : 1.05);
    vP.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(r).add(vT);
  }

  function update(s, t){
    var spinW = mqReduce.matches ? 0 : 1 - ss(0, 0.85, s);
    // objectif : approche le long de l'axe, puis 1,5 tour de vissage jusqu'à l'appui sur la monture
    var approach = ss(1.2, 1.72, s), screw = ss(1.72, 1.96, s);
    var thread = 0.42;
    R.lensHolder.position.z = mix(mix(9.0, LENS_SEAT + thread, approach), LENS_SEAT, screw);
    R.lensSpin.rotation.z = 4 * Math.PI * (1 - screw) + spinW * Math.sin(t * 0.32) * 0.5;
    R.lensShow.rotation.y = spinW * Math.sin(t * 0.21) * 0.32;
    R.lensShow.rotation.x = spinW * Math.sin(t * 0.17 + 1) * 0.08;
    // boîtier : monte depuis le bas
    var rise = eo(0.95, 1.6, s);
    R.body.position.y = mix(-15, 0, rise);
    R.body.visible = rise > 0.001;
    // filtre : arrive de face, 1,5 tour
    var fa = ss(2.25, 2.74, s), fs = ss(2.74, 2.96, s);
    R.filterHolder.visible = s > 2.2;
    // descend de haut en avant, s'aligne sur l'axe, puis se visse
    var fy = 1 - eo(0, 1, fa);
    R.filterHolder.position.set(0, 9.5 * fy * fy, mix(mix(9.5, FILTER_SEAT + 0.2, fa), FILTER_SEAT, fs));
    R.filterHolder.rotation.x = -0.9 * fy * fy;
    R.filterHolder.rotation.z = 3 * Math.PI * (1 - fs);
    // câbles : glissent depuis l'arrière, enfoncement final, vis moletées serrées
    var ca = ss(3.25, 3.78, s), cs = ss(3.78, 3.9, s), cio = ss(3.33, 3.84, s), cios = ss(3.84, 3.95, s);
    var cv = s > 3.2;
    R.cables.data.visible = R.cables.io.visible = cv;
    R.cables.data.position.z = mix(mix(-16, -0.5, ca), 0, cs);
    R.cables.io.position.z = mix(mix(-16, -0.5, cio), 0, cios);
    var turn = ss(3.88, 4.0, s);
    R.cables.screws.forEach(function(sw){ sw.rotation.z = -turn * Math.PI * 6; });
    R.cables.nut.rotation.y = turn * Math.PI * 2;
    R.M.led.emissiveIntensity = 2.2 * ss(3.95, 4.02, s);
    // poste : la caméra pivote pour viser vers le bas, le poste se monte autour
    var tilt = ss(4.04, 4.52, s);
    R.rig.rotation.x = tilt * Math.PI / 2;
    var stOn = s > 4.08;
    var st = R.st;
    st.conv.visible = st.lights.visible = st.post.visible = stOn;
    st.conv.position.y = mix(-34, 0, eo(4.12, 4.62, s));
    st.lights.position.y = mix(-34, 0, eo(4.28, 4.76, s));
    st.post.position.z = mix(-26, 0, eo(4.5, 4.86, s));
    var on = ss(4.8, 4.93, s);
    st.diffs.forEach(function(d){ d.material.emissiveIntensity = on * 2.4; });
    st.spots.forEach(function(sp){ sp.intensity = on * 1.5; });
    R.key.intensity = stOn ? mix(2.8, 2.3, on) : 1.1;
    var fv = ss(4.86, 4.99, s);
    st.fov.visible = fv > 0.001;
    st.fov.scale.setScalar(Math.max(0.001, fv));
    R.M.fovLine.opacity = 0.9 * fv; R.M.fovFill.opacity = 0.08 * fv;
    renderer.shadowMap.needsUpdate = stOn;

    view(s);
    cam.position.copy(vP); cam.lookAt(vT);
  }

  /* ======================================================================
     Défilement, mise en page, boucle de rendu
     ====================================================================== */
  function measure(){
    vh = innerHeight;
    var y = window.pageYOffset;
    centers = steps.map(function(el){ var r = el.getBoundingClientRect(); return r.top + y + r.height / 2 - vh / 2; });
  }
  function targetS(){
    var y = window.pageYOffset, c = centers;
    if(!c.length || y <= c[0]) return 0;
    for(var i = 0; i < c.length - 1; i++){
      if(y <= c[i + 1]) return i + (y - c[i]) / Math.max(1, c[i + 1] - c[i]);
    }
    return NSTEP;
  }
  function updatePanels(){
    var y = window.pageYOffset, red = mqReduce.matches;
    for(var i = 0; i < panels.length; i++){
      var p = panels[i]; if(!p) continue;
      var d = (y - centers[i]) / vh;
      if(i === 0 && d < 0) d = 0;
      if(i === panels.length - 1 && d > 0) d = 0;
      var o = red ? 1 : 1 - ss(0.16, 0.42, Math.abs(d));
      var ty = red ? 0 : Math.round(-d * 48);
      var key = o.toFixed(3) + '|' + ty;
      if(panelState[i] === key) continue;
      panelState[i] = key;
      p.style.opacity = o.toFixed(3);
      p.style.transform = ty ? 'translate3d(0,' + ty + 'px,0)' : '';
      p.style.visibility = o < 0.01 ? 'hidden' : '';
    }
  }
  function onResize(){
    if(!renderer) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    if(!w || !h) return;
    // mobile : la barre d'adresse change la hauteur ; on ignore les petites variations pour éviter les sauts
    if(mobile && w === W && Math.abs(h - H) < 140) { measure(); return; }
    W = w; H = h;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    var wide = w >= 900;
    if(wide) cam.setViewOffset(w, h, -Math.round(w * 0.19), 0, w, h);
    else cam.setViewOffset(w, h, 0, Math.round(h * (h < 720 ? 0.2 : 0.16)), w, h);
    cam.updateProjectionMatrix();
    measure();
    dirty = true;
  }

  function frame(now){
    raf = requestAnimationFrame(frame);
    var t = now / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
    sTgt = targetS();
    var red = mqReduce.matches;
    var prev = sCur;
    if(red) sCur = Math.round(sTgt);
    else { sCur += (sTgt - sCur) * (1 - Math.exp(-dt * 5.5)); if(Math.abs(sTgt - sCur) < 1e-4) sCur = sTgt; }
    updatePanels();
    var animating = !red && sCur < 0.9;      // rotation lente de l'objectif en ouverture
    if(!dirty && !animating && Math.abs(prev - sCur) < 1e-6) return;
    dirty = false;
    update(sCur, t);
    renderer.render(scene, cam);
    if(!ready){ ready = true; stage.classList.add('ready'); }
  }
  function start(){
    if(raf || !inited) return;
    lastT = 0; dirty = true;
    raf = requestAnimationFrame(frame);
  }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }
  function sync(){
    homeShown = home ? !home.hidden : true;
    if(homeShown && !inited){
      try{ init(); }catch(e){ if(window.console) console.error(e); fail(); return; }
    }
    if(homeShown){ measure(); onResize(); }
    if(homeShown && onScreen && tabShown && inited && story.classList.contains('is-3d')) start(); else stop();
  }

  if(home && window.MutationObserver) new MutationObserver(sync).observe(home, { attributes: true, attributeFilter: ['hidden'] });
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){ onScreen = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: '100px 0px' }).observe(story);
  }
  document.addEventListener('visibilitychange', function(){ tabShown = !document.hidden; sync(); });
  window.addEventListener('resize', function(){ if(inited && homeShown){ onResize(); measure(); dirty = true; } });
  window.addEventListener('load', function(){ if(inited) { measure(); dirty = true; } });
  if(window.ResizeObserver) new ResizeObserver(function(){ if(inited && homeShown){ measure(); dirty = true; } }).observe(story);
  if(window.matchMedia){ var mqDark = matchMedia('(prefers-color-scheme: dark)'); if(mqDark.addEventListener) mqDark.addEventListener('change', applyTheme); }
  if(window.MutationObserver) new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if(mqReduce.addEventListener) mqReduce.addEventListener('change', function(){ panelState = []; dirty = true; });
  if(window.I18N && window.I18N.onChange) window.I18N.onChange(function(){ setTimeout(function(){ if(inited) measure(); }, 50); });
  sync();
})();
