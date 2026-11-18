/* Calculateur complet : capteur, objectif, lumière. Interface seule : tout le calcul est dans OptiCalc (app/src/core.js). */
(function(){
  var C = OptiCalc, $ = function(id){return document.getElementById(id)};
  var I = window.I18N, t = function(s, v){ return I.t(s, v); }, lc = function(s){ return I.lc(s); };
  var sel = null, picked = false, imported = [], last = null, animNext = true;
  function n(x, d){ if(x==null||!isFinite(x)) return '∞'; return x.toLocaleString(I.locale,{minimumFractionDigits:d==null?0:d, maximumFractionDigits:d==null?0:d}); }
  function num(id){ return parseFloat($(id).value); }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  var FIELDS = ['fovH','fovV','wd','depth','defect','k','color','globalOnly','speed','exposure','nom','coc','task','backlight','material','tcolor','lamCons','lamC','lamFwhm','lamMin','lamMax','ambient','showPrice','cur','rate','glare','useDemo','showBrand','envOn','envExpo','envTmin','envTmax','envHumid','envVib','envShock','envFood','envAtex','envSpL','envSpW','envSpH'];
  var ENV_DEF={envOn:false,envExpo:'sec',envTmin:'10',envTmax:'35',envHumid:false,envVib:'aucune',envShock:'aucun',envFood:false,envAtex:false,envSpL:'',envSpW:'',envSpH:''};
  function readInputs(){
    return { fovH:num('fovH'), fovV:num('fovV'), wd:num('wd'), depth:num('depth')||0, defect:num('defect'), k:num('k'),
      color:$('color').checked, globalOnly:$('globalOnly').checked, speed:num('speed')||0, exposure:num('exposure')||0,
      nom:num('nom'), cocPx:num('coc'), task:$('task').value, backlight:$('backlight').checked,
      material:$('material').value, tcolor:$('tcolor').value, lamCons:$('lamCons').value,
      lamC:num('lamC'), lamFwhm:num('lamFwhm'), lamMin:num('lamMin'), lamMax:num('lamMax'),
      ambient:$('ambient').value, showPrice:$('showPrice').checked, rate:num('rate')>0?num('rate'):1, glare:$('glare').checked, nstar:2 };
  }
  function readEnv(){
    return { on:$('envOn').checked, expo:$('envExpo').value, tMin:num('envTmin'), tMax:num('envTmax'), humid:$('envHumid').checked,
      vib:$('envVib').value, shock:$('envShock').value, food:$('envFood').checked, atex:$('envAtex').checked,
      spL:num('envSpL'), spW:num('envSpW'), spH:num('envSpH') };
  }
  function snapshot(){ var o={}; FIELDS.forEach(function(k){ var el=$(k); if(el) o[k]=el.type==='checkbox'?el.checked:el.value; }); o._sensor=picked?sel:null; return o; }
  function apply(o){
    Object.keys(o).forEach(function(k){ var el=$(k); if(!el) return; if(el.type==='checkbox') el.checked=!!o[k]; else el.value=o[k]; });
    syncTask();
  }
  var PRESETS = {
    aspect:{fovH:100,fovV:80,wd:300,depth:5,defect:200,k:3,speed:0,exposure:200,nom:5.6,task:'detection',backlight:false,material:'general',lamCons:'auto',ambient:'maitrisee',glare:false},
    cote:{fovH:50,fovV:40,wd:250,depth:2,defect:50,k:4,speed:0,exposure:300,nom:5.6,task:'mesure',backlight:true,material:'metal',lamCons:'auto',ambient:'maitrisee',glare:false},
    code:{fovH:30,fovV:24,wd:150,depth:3,defect:100,k:3,speed:300,exposure:50,nom:4,task:'detection',backlight:false,material:'color',tcolor:'rouge',lamCons:'auto',ambient:'forte',glare:false},
    colle:{fovH:60,fovV:45,wd:200,depth:3,defect:300,k:3,speed:0,exposure:500,nom:4,task:'detection',backlight:false,material:'fluo',lamCons:'source',lamC:365,lamFwhm:15,ambient:'forte',glare:false}
  };
  function buildMaterials(){
    var g='', h='', v=$('material').value;
    C.MATERIALS.forEach(function(m){ if(m.grp!==g){ if(g) h+='</optgroup>'; h+='<optgroup label="'+esc(t(m.grp))+'">'; g=m.grp; } h+='<option value="'+m.id+'">'+esc(t(m.label))+'</option>'; });
    $('material').innerHTML=h+'</optgroup>';
    if(v) $('material').value=v;
  }
  buildMaterials();
  function syncVis(){
    var m=C.materialById($('material').value), c=$('lamCons').value;
    $('tcolorW').classList.toggle('hidden', !m.colorRule);
    $('lamSrcW').classList.toggle('hidden', c!=='source');
    $('lamBandW').classList.toggle('hidden', c!=='band');
    $('envBox').classList.toggle('hidden', !$('envOn').checked);
  }
  function syncTask(){ var v=$('task').value; [].forEach.call(document.querySelectorAll('[data-task]'),function(b){ b.classList.toggle('on', b.dataset.task===v); b.setAttribute('aria-pressed', b.dataset.task===v); }); }

  var KCLS={plein:'ok',suffisant:'ok',limite:'limite',insuffisant:'insuffisant',inconnu:'off'};
  var KTXT0={plein:'Résolution au moins égale au Nyquist',suffisant:'Résolution suffisante',limite:'Résolution limite',insuffisant:'Résolution insuffisante',inconnu:'Résolution inconnue'};
  var STXT0={ok:'suffisant',limite:'limite',insuffisant:'insuffisant'};
  function KTXT(k){ return t(KTXT0[k]); }
  function STXT(k){ return t(STXT0[k]); }

  function money(usd, rate){ var cur=$('cur').value, v=usd*(cur==='EUR'?rate:1); return n(Math.round(v/10)*10,0)+' '+(cur==='EUR'?'€':'$'); }
  function priceCell(s, inp){
    var p=C.estimatePrice(s);
    if(p.quote) return '<span class="muted" title="'+esc(p.why)+'">'+t('sur devis')+'</span>';
    return '<span title="'+t('{basis} · fourchette {lo} – {hi}',{basis:esc(p.basis),lo:esc(money(p.lo,inp.rate)),hi:esc(money(p.hi,inp.rate))})+'">≈ '+money(p.usd,inp.rate)+'</span>';
  }
  function chartSvg(L){
    var W=720,H=250,l=52,r=16,t=14,b=52, pw=W-l-r, ph=H-t-b, xmax=L.cutoff;
    function X(v){return l+pw*Math.min(v,xmax)/xmax} function Y(v){return t+ph*(1-v)}
    var pts=[],i; for(i=0;i<=120;i++){var f=xmax*i/120; pts.push(X(f).toFixed(1)+','+Y(C.mtfDiff(f/xmax)).toFixed(1));}
    var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+I.t('Contraste de diffraction en fonction de la fréquence spatiale')+'">';
    [0,0.2,0.5,1].forEach(function(v){ s+='<line class="'+(v===0?'axis':'grid')+'" x1="'+l+'" x2="'+(W-r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(l-8)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+Math.round(v*100)+' %</text>'; });
    for(i=0;i<=4;i++){ var fv=xmax*i/4; s+='<line class="axis" x1="'+X(fv)+'" x2="'+X(fv)+'" y1="'+(t+ph)+'" y2="'+(t+ph+4)+'"/><text x="'+X(fv)+'" y="'+(t+ph+18)+'" text-anchor="middle">'+n(fv,0)+'</text>'; }
    s+='<text x="'+(l+pw/2)+'" y="'+(H-6)+'" text-anchor="middle">'+I.t('fréquence spatiale côté image, lp/mm')+'</text>';
    s+='<polygon class="area" points="'+l+','+Y(0)+' '+pts.join(' ')+' '+X(xmax)+','+Y(0)+'"/><polyline class="curve" pathLength="1" points="'+pts.join(' ')+'"/>';
    var nq=L.nuN, rq=L.nuReq, nqLeft=nq>xmax*0.6;
    s+='<line class="nyq" x1="'+X(nq)+'" x2="'+X(nq)+'" y1="'+t+'" y2="'+(t+ph)+'"/>';
    s+='<text x="'+(X(nq)+(nqLeft?-6:6))+'" y="'+(t+12)+'" text-anchor="'+(nqLeft?'end':'start')+'" style="fill:var(--ink)">'+I.t('Nyquist {v}',{v:n(nq,0)})+'</text>';
    if(rq<=xmax){ s+='<line class="req" x1="'+X(rq)+'" x2="'+X(rq)+'" y1="'+t+'" y2="'+(t+ph)+'"/><text x="'+(X(rq)+(rq>xmax*0.6?-6:6))+'" y="'+(t+28)+'" text-anchor="'+(rq>xmax*0.6?'end':'start')+'" style="fill:var(--warn)">'+I.t('requis {v}',{v:n(rq,0)})+'</text>'; }
    else { s+='<text x="'+(W-r)+'" y="'+(t+28)+'" text-anchor="end" style="fill:var(--bad)">'+I.t('requis {v} lp/mm, au-delà de la diffraction',{v:n(rq,0)})+'</text>'; }
    return s+'</svg>';
  }
  /* Jauge en arc : frac de 0 à 1, valeur et légende au centre */
  function gauge(frac, value, sub, st, label){
    var N=23, cx=110, cy=112, r1=72, r2=98, on=Math.round(Math.max(0,Math.min(1,frac))*N), s='';
    for(var i=0;i<N;i++){ var a=Math.PI*(1-i/(N-1)), c=Math.cos(a), si=Math.sin(a);
      s+='<line class="'+(i<on?'g-on':'g-off')+'" style="--i:'+i+'" x1="'+(cx+r1*c).toFixed(1)+'" y1="'+(cy-r1*si).toFixed(1)+'" x2="'+(cx+r2*c).toFixed(1)+'" y2="'+(cy-r2*si).toFixed(1)+'" stroke-width="8" stroke-linecap="round"/>'; }
    return '<svg class="gauge '+st+'" viewBox="0 0 220 124" role="img" aria-label="'+esc(label)+'">'+s+'<text class="g-v" x="110" y="100" text-anchor="middle">'+esc(value)+'</text><text class="g-s" x="110" y="118" text-anchor="middle">'+esc(sub)+'</text></svg>';
  }
  window.LumenGauge = gauge;
  function row(a,b,c){ return '<div><span><b>'+a+'</b><br><code>'+b+'</code></span><span class="res">'+c+'</span></div>'; }
  function flagsHtml(fl, empty){ return '<ul class="flags">'+(fl.length?fl.map(function(f){return '<li class="'+f.t+'">'+esc(f.m)+'</li>'}).join(''):(empty?'<li class="good">'+empty+'</li>':''))+'</ul>'; }
  function catalog(){ var c=[]; if($('useDemo').checked) c=c.concat(C.DEMO_CATALOG); return c.concat(imported); }

  function lensCard(r, showBrand, ev){
    var e=r.e, isT=e.type==='telecentrique', head=isT?('×'+n(e.mag,3)):(n(e.f,e.f%1?1:0)+' mm');
    var h='<div class="lens"><div class="h"><span class="f">'+head+'</span><span class="pill neutral">'+esc(t(C.KIND_LABEL[e.type]))+'</span></div>';
    h+='<div><span class="pill '+KCLS[r.verdict]+'">'+KTXT(r.verdict)+'</span></div>';
    h+='<dl class="kv"><dt>'+t('Résolution objectif')+'</dt><dd>'+(e.res!=null?n(e.res,0)+' lp/mm':t('non renseignée'))+'</dd>'
      +'<dt>'+t('Pixel effectif')+'</dt><dd>'+(r.pxEff!=null?n(r.pxEff,2)+' µm':'-')+'</dd>'
      +'<dt>'+t('Mpx résolus')+'</dt><dd>'+(r.mpxResolved!=null?t('{a} sur {b}',{a:n(r.mpxResolved,1),b:n(ev.dims.mpx,1)}):'-')+'</dd>'
      +'<dt>'+t('Champ obtenu')+'</dt><dd>'+n(r.fovH,1)+' × '+n(r.fovV,1)+' mm</dd>'
      +'<dt>'+t('Distance de travail')+'</dt><dd>'+n(r.wd,0)+' mm'+(r.adjWd?' ('+(r.adjDelta>=0?'+':'')+n(r.adjDelta,0)+')':'')+'</dd>'
      +'<dt>'+t('Grandissement')+'</dt><dd>'+n(r.m,4)+'×</dd>'
      +(r.ppdEff!=null&&r.verdict!=='inconnu'?'<dt>'+t('Pixels par défaut')+'</dt><dd>'+n(r.ppdEff,1)+'</dd>':'')
      +(e.circle!=null?'<dt>'+t('Cercle d\'image')+'</dt><dd>'+n(e.circle,1)+' mm</dd>':'')
      +(r.dof?'<dt>'+t('Profondeur de champ')+'</dt><dd>'+n(r.dof.total,1)+' mm</dd>':'')
      +'<dt>'+t('Contraste diffraction')+'</dt><dd>'+t('{p} % au Nyquist',{p:n(r.mtfNyq*100,0)})+'</dd></dl>';
    h+=flagsHtml(r.flags);
    var refs=r.refs.filter(function(x){return !x.demo});
    if(refs.length){
      var list=refs.slice(0,8).map(function(x){ return esc((x.brand?x.brand+' · ':'')+x.ref); });
      var rv={n:n(refs.length),list:list.join(', ')+(refs.length>8?'…':'')};
      h+='<div class="refs">'+(refs.length>1
        ?(showBrand?t('{n} références de même spécification : {list}',rv):t('{n} références de même spécification. Cochez « Afficher fabricant et référence » pour les voir.',rv))
        :(showBrand?t('{n} référence de même spécification : {list}',rv):t('{n} référence de même spécification. Cochez « Afficher fabricant et référence » pour les voir.',rv)))+'</div>';
    } else h+='<div class="refs">'+t('Exemple générique sans marque.')+'</div>';
    return h+'</div>';
  }

  function render(){
    syncVis();
    var inp = readInputs(), out = $('out');
    if(!(inp.fovH>0&&inp.fovV>0&&inp.wd>0&&inp.defect>0)){ last=null; out.innerHTML='<div class="card empty">'+t('Renseignez le champ de vue, la distance de travail et le plus petit défaut.')+'</div>'; return; }
    var lr = C.resolveLambda(inp); inp.lambda = lr.lam;
    var req = C.requiredPixels(inp), ranked = C.rankSensors(inp);
    var ev = ranked.filter(function(x){return x.sensor.id===sel})[0];
    if(!ev || !picked){ ev = ranked.filter(function(x){return !x.excluded && x.status==='ok'})[0] || ranked.filter(function(x){return !x.excluded})[0] || ranked[0]; sel = ev.sensor.id; }
    var lt = C.lensType(ev, inp), sp = C.lensSpec(ev, inp, lt), L = C.lightAdvice(inp, ev, lt.kind, lr);
    var E = C.environmentAdvice(readEnv(), ev, inp, lt, sp, L);
    var pixTarget = inp.defect/inp.k, st = ev.excluded ? 'insuffisant' : ev.status;
    var shortId = ev.sensor.id.split(' / ')[0];
    var ltLabel = t(lt.label);
    var fTxt = sp.kind==='telecentrique' ? t('Objectif télécentrique, grandissement ≈ {m}×',{m:n(sp.m,3)}) : t('Objectif {type} de {f} mm environ',{type:esc(lc(ltLabel)),f:n(sp.f,1)});
    var apTxt = sp.win.nMin!=null && sp.win.nMin<=sp.win.nMax ? t(', ouvert entre f/{a} et f/{b}',{a:n(Math.max(sp.win.nMin,1.4),1),b:n(sp.win.nMax,1)}) : t(', ne pas fermer au-delà de f/{b}',{b:n(sp.win.nMax,1)});
    var title = st==='ok' ? t('Le capteur {id} convient',{id:esc(shortId)}) : st==='limite' ? t('Le capteur {id} est à la limite',{id:esc(shortId)}) : (ev.excluded ? t('Aucun capteur ne convient tel quel') : t('Le capteur {id} est insuffisant',{id:esc(shortId)}));

    // texte de spécification
    var spec = [
      t('Inspection : {task}, champ {h} × {v} mm à {wd} mm, variation de hauteur {d} mm',{task:inp.task==='mesure'?t('mesure'):t('détection'),h:n(inp.fovH),v:n(inp.fovV),wd:n(inp.wd),d:n(inp.depth)}),
      t('Plus petit défaut : {d} µm sur {k} pixels ({p} µm par pixel côté objet)',{d:n(inp.defect),k:n(req.kEff),p:n(pixTarget,1)}),
      t('Capteur : {id}, {w} × {h} px, pixel {p} µm, {fmt}',{id:ev.sensor.id,w:ev.sensor.w,h:ev.sensor.h,p:n(ev.sensor.p,2),fmt:t(ev.sensor.fmt)}),
      t('Type d\'objectif : {t}',{t:ltLabel}),
      (sp.kind==='telecentrique'?t('Grandissement : ≈ {m}×',{m:n(sp.m,3)}):t('Focale : ≈ {f} mm (séries voisines {a} et {b} mm)',{f:n(sp.f,1),a:sp.fBelow||'-',b:sp.fAbove||'-'})),
      t('Résolution objectif : ≥ {v} lp/mm côté image',{v:n(sp.nuK,0)}),
      t('Cercle d\'image : ≥ {c} mm (≈ {i}")',{c:n(sp.circleMin,1),i:n(sp.inch,2)}),
      t('Ouverture : f/{n} (f/{e} effectif), diffraction : f/{m} au plus',{n:n(inp.nom,1),e:n(sp.nEff,1),m:n(sp.win.nMax,1)}),
      t('Lumière : {l} nm ({from}), filtre {f}',{l:n(L.lam),from:t(L.from),f:L.filter.name})+(L.pol.use?t(', polarisation conseillée'):'')
    ].join('\n');
    last = { inputs: snapshot(), spec: spec, summary: { capteur: ev.sensor.id, statut: st, type: lt.label, focale: sp.f||null, grandissement: sp.m, resolution_lpmm: sp.nuK, cercle_mm: sp.circleMin, lambda_nm: L.lam }, title: title.replace(/&[^;]+;/g,'') };
    if(E){ last.spec += '\n\n'+E.spec; last.summary.environnement = E.summary; }

    var ratio = ev.ppd/ev.kEff;
    var h = '<section class="card verdict '+st+'"><div class="l">'+gauge(ratio/2, n(ev.ppd,1)+' px', t('sur le défaut · {k} requis',{k:n(ev.kEff)}), st, t('{p} pixels sur le défaut pour {k} requis',{p:n(ev.ppd,1),k:n(ev.kEff)}))
      + '<div><span class="eyebrow">'+(st==='ok'?t('Capteur suffisant'):st==='limite'?t('À la limite'):t('Insuffisant'))+'</span><h1 style="margin-top:6px">'+title+'</h1><p>'+fTxt+apTxt+t(', résolution d\'au moins {v} lp/mm.',{v:n(sp.nuK,0)})+'</p></div></div>'
      + '<div class="btns"><button type="button" class="btn" data-act="copy-calc">'+t('Copier la spécification')+'</button><button type="button" class="btn pri" data-act="save-calc">'+t('Enregistrer le projet')+'</button></div></section>';
    h += '<nav class="anchors" aria-label="'+t('Sections')+'"><a class="chip" href="#c-resume">'+t('Résumé')+'</a><a class="chip" href="#c-capteurs">'+t('Capteurs')+'</a><a class="chip" href="#c-objectif">'+t('Objectif')+'</a><a class="chip" href="#c-lumiere">'+t('Lumière')+'</a>'+(E?'<a class="chip" href="#c-env">'+t('Environnement')+'</a>':'')+'<a class="chip" href="#c-contraste">'+t('Contraste')+'</a></nav>';

    h += '<section id="c-resume" class="card grid">'
      + '<div class="cell"><span class="cap">'+t('Pixels requis')+'</span><span class="v">'+n(req.nH)+' × '+n(req.nV)+'</span><span class="n">'+t('{mpx} Mpx au minimum, {k} px par défaut',{mpx:n(req.mpx,1),k:n(req.kEff)})+'</span></div>'
      + '<div class="cell"><span class="cap">'+t('Pixel objet visé')+'</span><span class="v">'+n(pixTarget,1)+' µm</span><span class="n">'+t('{d} µm ÷ {k} pixels',{d:n(inp.defect),k:n(inp.k)})+'</span></div>'
      + '<div class="cell"><span class="cap">'+t('Capteur retenu')+'</span><span class="v">'+esc(shortId)+'</span><span class="n">'+n(ev.sensor.w)+' × '+n(ev.sensor.h)+' · '+n(ev.sensor.p,2)+' µm · '+esc(t(ev.sensor.fmt))+'</span>'+(inp.showPrice?'<span class="n">'+t('Caméra : {p}',{p:priceCell(ev.sensor,inp)})+'</span>':'')+'</div>'
      + '<div class="cell"><span class="cap">'+t('Type d\'objectif')+'</span><span class="v">'+esc(lc(ltLabel))+'</span><span class="n">'+(sp.f?t('focale ≈ {f} mm · ',{f:n(sp.f,1)}):'')+'λ '+n(lr.lam)+' nm</span></div>'
      + '</section>';

    h += '<section id="c-capteurs" class="card" style="overflow:hidden"><div class="ch"><b>'+t('Capteurs possibles')+'</b><span>'+t('Du plus petit suffisant au plus grand. Cliquez une ligne pour calculer l\'objectif.')+'</span></div><div class="scroll"><table class="t cards"><thead><tr><th>'+t('Capteur')+'</th><th class="n">'+t('Résolution')+'</th><th class="n">'+t('Pixel')+'</th><th>'+t('Obturateur')+'</th><th class="n">'+t('Px / défaut')+'</th><th class="n">'+t('Grandissement')+'</th><th>'+t('Verdict')+'</th>'+(inp.showPrice?'<th class="n">'+t('Caméra')+'</th>':'')+'</tr></thead><tbody>';
    ranked.forEach(function(e){
      var s=e.sensor, cls=(s.id===sel?'sel':'')+(e.excluded?' off':''), pct=Math.max(0,Math.min(100,e.ppd/e.kEff*50));
      var verdict = e.excluded ? '<span class="pill off">'+t('exclu : {why}',{why:esc(e.why)})+'</span>' : '<span class="pill '+e.status+'">'+STXT(e.status)+'</span>';
      h+='<tr tabindex="0" data-id="'+esc(s.id)+'" class="'+cls+'"><td><span style="font-weight:500">'+esc(s.id)+'</span> <span class="muted" style="font-size:13px">'+esc(t(s.fmt))+' · '+esc(t(s.fam))+(s.swir?' · 400–1700 nm':'')+'</span></td>'
        +'<td class="n num"><span class="lbl">'+t('Résolution')+' </span>'+n(s.w)+' × '+n(s.h)+'</td><td class="n num"><span class="lbl">'+t('Pixel')+' </span>'+n(s.p,2)+' µm</td><td><span class="lbl">'+t('Obturateur')+' </span>'+(s.sh==='global'?t('global'):t('roulant'))+'</td>'
        +'<td class="n num"><span class="lbl">'+t('Px/défaut')+' </span>'+n(e.ppd,1)+'<span class="bar" aria-hidden="true"><i style="width:'+pct+'%"></i></span></td><td class="n num"><span class="lbl">'+t('Grandissement')+' </span>'+n(e.m,4)+'×'+(e.portrait?' ↻':'')+'</td><td>'+verdict+'</td>'+(inp.showPrice?'<td class="n num"><span class="lbl">'+t('Caméra')+' </span>'+priceCell(s,inp)+'</td>':'')+'</tr>';
    });
    h+='</tbody></table></div><div class="pad" style="padding-top:4px">'+(inp.showPrice?'<p class="note">'+t('Prix indicatif hors taxes d\'une caméra monochrome USB3 de même résolution (Basler ace 2, revendeur américain), fourchette ±25 %. Interface, couleur, volume et droits de douane changent le prix : à confirmer par devis.')+'</p>':'')+'<p class="note">'+t('↻ : capteur tourné de 90° pour mieux couvrir le champ. La barre atteint la moitié à la valeur exigée.')+'</p></div></section>';

    var showBrand=$('showBrand').checked;
    h += '<section id="c-objectif" class="card" style="overflow:hidden"><div class="ch"><b>'+t('Objectif à spécifier')+'</b><span>'+t('Neutre, valable pour toute marque')+'</span></div><div class="spec">';
    h += '<div><span class="cap">'+t('Type conseillé')+'</span><span class="big">'+esc(ltLabel)+'</span>'+flagsHtml(lt.reasons)
      +(lt.alt.length?'<p class="note">'+t('Alternative : {list}.',{list:lt.alt.map(function(k){return esc(t(C.KIND_LABEL[k]))}).join(', ')})+'</p>':'')+'</div>';
    h += '<div><span class="cap">'+(sp.kind==='telecentrique'?t('Grandissement'):t('Focale'))+'</span><span class="big">'+(sp.kind==='telecentrique'?'≈ '+n(sp.m,3)+'×':'≈ '+n(sp.f,1)+' mm')+'</span>'
      +'<dl class="kv"><dt>'+t('Grandissement')+'</dt><dd>'+n(sp.m,4)+'×</dd>'
      +(sp.kind!=='telecentrique'?'<dt>'+t('Séries voisines')+'</dt><dd>'+(sp.fBelow?sp.fBelow+' mm':'-')+' · '+(sp.fAbove?sp.fAbove+' mm':'-')+'</dd>':'<dt>'+t('Distance de travail')+'</dt><dd>'+t('≈ {wd} mm, imposée',{wd:n(inp.wd,0)})+'</dd>')
      +'<dt>'+t('Cercle d\'image')+'</dt><dd>≥ '+n(sp.circleMin,1)+' mm (≈ '+n(sp.inch,2)+'")</dd></dl></div>';
    h += '<div><span class="cap">'+t('Résolution')+'</span><span class="big">≥ '+n(sp.nuK,0)+' lp/mm</span>'
      +'<dl class="kv"><dt>'+t('Pour {k} px/défaut',{k:n(sp.kEff)})+'</dt><dd>'+n(sp.nuK,0)+' lp/mm</dd>'
      +'<dt>'+t('Pixel effectif max.')+'</dt><dd>'+n(sp.pitchEq,2)+' µm</dd>'
      +'<dt>'+t('Nyquist du capteur')+'</dt><dd>'+n(sp.nuN,0)+' lp/mm</dd>'
      +'<dt>'+t('Défaut seul (2 px)')+'</dt><dd>'+n(sp.nuReq,0)+' lp/mm</dd>'
      +'<dt>'+t('Côté objet')+'</dt><dd>'+n(sp.objLpmm,1)+' lp/mm</dd></dl></div>';
    h += '<div><span class="cap">'+t('Ouverture')+'</span><span class="big">f/'+n(inp.nom,1)+'</span>'
      +'<dl class="kv"><dt>'+t('Effective')+'</dt><dd>f/'+n(sp.nEff,1)+'</dd><dt>'+t('Coupure à {l} nm',{l:n(inp.lambda)})+'</dt><dd>'+n(sp.cutoff,0)+' lp/mm</dd><dt>'+t('Contraste au Nyquist')+'</dt><dd>'+n(sp.mtfNyq*100,0)+' %</dd>'
      +(sp.dof?'<dt>'+t('Profondeur de champ')+'</dt><dd>'+n(sp.dof.total,1)+' mm</dd>':'')+'</dl>'
      +(sp.win.nMin!=null?(sp.win.nMin>sp.win.nMax?flagsHtml([{t:'bad',m:t('Il faudrait au moins f/{a} pour tenir {d} mm, mais la diffraction impose f/{b} au plus. Réduire la variation de hauteur, accepter 2 pixels de flou ou choisir un télécentrique.',{a:n(sp.win.nMin,1),d:n(inp.depth),b:n(sp.win.nMax,1)})}]):flagsHtml([{t:'good',m:t('Plage d\'ouverture : f/{a} à f/{b}.',{a:n(Math.max(sp.win.nMin,1.4),1),b:n(sp.win.nMax,1)})}])):flagsHtml([{t:'good',m:t('Ne pas dépasser f/{b} (diffraction).',{b:n(sp.win.nMax,1)})}]))
      +'</div></div></section>';

    var cat=catalog(), prim=C.matchCatalog(ev, inp, cat, [lt.kind]), alts=lt.alt.length?C.matchCatalog(ev, inp, cat, lt.alt):[], nImp=imported.length;
    h += '<section class="card"><div class="ch"><b>'+t('Objectifs du catalogue : {type}',{type:esc(lc(ltLabel))})+'</b><span>'+(nImp?t('{n} références importées. ',{n:n(nImp)}):'')+t('Une carte par spécification, aucune marque mise en avant.')+'</span></div>';
    if(!prim.length) h+='<div class="empty">'+t('Aucun objectif du catalogue ne correspond ({type}, cercle d\'image ≥ {d} mm).',{type:esc(lc(ltLabel)),d:n(ev.dims.D,1)})+(nImp?'':t(' Importez votre gamme en CSV dans les options avancées.'))+'</div>';
    else h+='<div class="lenses">'+prim.slice(0,6).map(function(r){return lensCard(r,showBrand,ev)}).join('')+'</div>'+(prim.length>6?'<p class="note pad" style="padding-top:0">'+t('{n} autres spécifications non affichées.',{n:prim.length-6})+'</p>':'');
    if(alts.length) h+='<details class="pad" style="border-top:1px solid var(--line)"><summary>'+t('Alternatives : {list} ({n})',{list:lt.alt.map(function(k){return esc(t(C.KIND_LABEL[k]))}).join(', '),n:alts.length})+'</summary><div class="lenses" style="padding:12px 0 0">'+alts.slice(0,6).map(function(r){return lensCard(r,showBrand,ev)}).join('')+'</div></details>';
    h+='</section>';

    var f=L.filter;
    h += '<section id="c-lumiere" class="card" style="overflow:hidden"><div class="ch"><b>'+t('Longueur d\'onde et filtre')+'</b><span>'+esc(t(L.mat.label))+' · '+n(L.lam)+' nm ('+esc(t(L.from))+')</span></div><div class="spec">';
    h += '<div><span class="cap">'+t('À observer')+'</span><dl class="kv">'+L.bands.map(function(b){ return '<dt>'+(b.lam!=null?n(b.lam)+' nm':n(b.lo)+'–'+n(b.hi)+' nm')+'</dt><dd style="text-align:left;font-family:var(--font)">'+esc(t(b.role))+'</dd>'; }).join('')+'</dl>'
      +'<ul class="flags" style="margin-top:8px">'+L.bands.map(function(b){return '<li class="info">'+esc(t(b.why))+'</li>'}).join('')+'</ul></div>';
    h += '<div><span class="cap">'+t('Filtre · {need}',{need:esc(f.need)})+'</span><span class="big">'+esc(f.name)+'</span>'
      +'<dl class="kv">'+(f.kind==='longpass'?'<dt>'+t('Coupure')+'</dt><dd>≥ '+n(f.cut,0)+' nm</dd>':'<dt>'+t('Centre')+'</dt><dd>'+n(f.c0,0)+' nm</dd><dt>'+t('Largeur mi-hauteur')+'</dt><dd>≥ '+n(f.bmin,0)+' nm</dd>')
      +'<dt>'+t('Décalage en bord')+'</dt><dd>'+(L.telecentric?'≈ 0':'−'+n(L.shift,1))+' nm</dd><dt>'+t('Angle de champ')+'</dt><dd>'+(L.telecentric?'≈ 0':n(L.thetaDeg,1))+'°</dd></dl>'
      +'<p class="note">'+esc(f.text)+'</p></div>';
    h += '<div><span class="cap">'+t('Polarisation')+'</span><span class="big">'+(L.pol.use?t('Conseillée'):t('Inutile'))+'</span>'+(L.pol.use?'<p class="note">'+esc(L.pol.text)+'</p>':'<p class="note">'+t('Aucun reflet ni matière transparente signalés. Cochez « Reflets gênants » si la surface brille.')+'</p>')+'</div>';
    h += '</div><div class="pad" style="padding-top:0">'+flagsHtml(L.flags.concat(L.notes.map(function(m){return {t:'info',m:m}})));
    h += '<ul class="srcs">'+L.src.concat(inp.showPrice?['mvstore']:[]).map(function(k){var s=C.SRC[k]; return s?'<li><a href="'+s.u+'" target="_blank" rel="noopener noreferrer">'+esc(t(s.t))+'</a></li>':''}).join('')+'</ul>';
    h += '<p class="note">'+t('Le décalage vers le bleu suit λ = λ₀ √(1 − (sin θ ÷ n*)²) avec n* ≈ 2 supposé, une valeur indicative : la fiche du filtre donne la valeur exacte.')+'</p></div></section>';

    if(E) h += envSection(E, inp);

    h+='<section id="c-contraste" class="card"><div class="ch"><b>'+t('Contraste limité par la diffraction')+'</b><span>'+t('f/{a}, f/{b} effectif, {l} nm',{a:n(inp.nom,1),b:n(sp.nEff,1),l:n(inp.lambda)})+'</span></div><div class="pad">'+chartSvg(sp)
      +'<div class="legend"><span class="l1">'+t('contraste théorique sans aberration')+'</span><span class="l2">'+t('Nyquist du capteur')+'</span><span class="l3">'+t('fréquence requise pour le défaut')+'</span></div>'
      +'<p class="note">'+t('Un objectif réel reste sous cette courbe : c\'est le plafond de la physique. Contraste théorique de {p} % au Nyquist.',{p:n(sp.mtfNyq*100,0)})+'</p>'
      +'<details style="margin-top:12px"><summary>'+t('Détail des calculs')+'</summary><div class="calc">'
      +row(t('Pixels requis'),t('N = FOV × k ÷ défaut'),t('= {a} × {k} ÷ {d} mm = {n} px (largeur)',{a:n(inp.fovH),k:n(req.kEff),d:n(inp.defect/1000,3),n:n(req.nH)}))
      +row(t('Grandissement maximal'),'m = min(L<sub>h</sub> ÷ FOV<sub>h</sub>, L<sub>v</sub> ÷ FOV<sub>v</sub>)','= '+n(ev.m,4)+'×')
      +(sp.f?row(t('Focale'),'f = WD × m ÷ (1 + m)','= '+n(inp.wd)+' × '+n(ev.m,4)+' ÷ '+n(1+ev.m,4)+' = '+n(sp.f,2)+' mm'):'')
      +row(t('Pixel côté objet'),'p<sub>obj</sub> = pixel ÷ m','= '+n(ev.sensor.p,2)+' ÷ '+n(ev.m,4)+' = '+n(ev.pixObj,1)+' µm')
      +row(t('Résolution requise'),t('ν = 1000 ÷ (2 × p<sub>équiv</sub>), p<sub>équiv</sub> = défaut × m ÷ k'),t('= {v} lp/mm côté image',{v:n(sp.nuK,1)}))
      +row(t('Fréquence de Nyquist'),'ν<sub>N</sub> = 1000 ÷ (2 × pixel)','= '+n(sp.nuN,1)+' lp/mm')
      +row(t('Ouverture effective'),'N<sub>eff</sub> = N × (1 + m)','= '+n(inp.nom,1)+' × '+n(1+ev.m,3)+' = '+n(sp.nEff,2))
      +row(t('Coupure de diffraction'),'ν<sub>c</sub> = 1 ÷ (λ × N<sub>eff</sub>)',t('= {v} lp/mm à {l} nm',{v:n(sp.cutoff,0),l:n(inp.lambda)}))
      +row(t('Erreur de perspective'),'Δ = FOV × Δz ÷ WD',t('= {a} mm, soit {b} px',{a:n(lt.perr,2),b:n(lt.perrPx,1)}))
      +row(t('Décalage du filtre'),'Δλ = λ₀ (1 − √(1 − (sin θ ÷ n*)²))',t('= {a} nm à {b}°',{a:n(L.shift,1),b:n(L.thetaDeg,1)}))
      +'</div></details></div></section>';
    out.innerHTML = h;
    out.classList.toggle('anim', animNext); animNext = false;
  }
  /* Environnement et boîtier : affiché seulement si l'option est cochée */
  function envSection(E, inp){
    var B=E.housing, T=E.thermal, mm=function(v){ return n(v,0)+' mm'; }, FIT={ok:'ok',juste:'warn',trop:'bad'};
    var h='<section id="c-env" class="card" style="overflow:hidden"><div class="ch"><b>'+t('Environnement et boîtier')+'</b><span>'+esc(E.expoLabel)+' · '+t('{a} à {b} °C',{a:n(E.tMin),b:n(E.tMax)})+'</span></div>';
    h+='<div class="grid g4" style="border-top:1px solid var(--line)">'
      +'<div class="cell"><span class="cap">'+t('Protection requise')+'</span><span class="v">'+esc(E.ip.code)+'</span><span class="n">'+esc(B.material)+'</span></div>'
      +'<div class="cell"><span class="cap">'+t('Caméra')+'</span><span class="v">'+esc(E.camera.v)+'</span><span class="n">'+esc(E.camera.head)+'</span></div>'
      +'<div class="cell"><span class="cap">'+t('Objectif')+'</span><span class="v">'+esc(E.lens.v)+'</span><span class="n">'+esc(E.lens.head)+'</span></div>'
      +'<div class="cell"><span class="cap">'+t('Éclairage')+'</span><span class="v">'+esc(E.light.v)+'</span><span class="n">'+esc(E.light.head)+'</span></div></div>';
    var li=function(a){ return flagsHtml(a.map(function(m){return {t:'info',m:m};})); };
    h+='<div class="spec">'
      +'<div><span class="cap">'+t('Protection requise')+'</span><p class="env-txt">'+esc(E.ip.text)+'</p><p class="note">'+esc(E.ip.explain)+'</p></div>'
      +'<div><span class="cap">'+t('Caméra')+'</span><p class="env-txt">'+esc(E.camera.text)+'</p><p class="note">'+esc(E.camera.typ)+'</p></div>'
      +'<div><span class="cap">'+t('Objectif')+'</span>'+li(E.lens.items)+'</div>'
      +'<div><span class="cap">'+t('Éclairage')+'</span>'+li(E.light.items)+'</div></div>';
    h+='<div class="ch" style="border-top:1px solid var(--line)"><b>'+t('Boîtier')+'</b><span>'+t('Cahier des charges estimé pour choisir un boîtier')+'</span></div><div class="spec">';
    h+='<div><span class="cap">'+t('Dimensions intérieures minimales')+'</span><span class="big">'+n(B.L)+' × '+n(B.W)+' × '+n(B.H)+' mm</span>'
      +'<dl class="kv"><dt>'+t('Caméra')+'</dt><dd>'+n(B.cam.w)+' × '+n(B.cam.h)+' × '+n(B.cam.l)+' mm</dd>'
      +'<dt>'+t('Objectif')+'</dt><dd>⌀ '+n(B.lens.d)+' × '+mm(B.lens.l)+'</dd>'
      +(B.filter+B.pol?'<dt>'+t('Filtre et polariseur')+'</dt><dd>'+mm(B.filter+B.pol)+'</dd>':'')
      +'<dt>'+t('Jeu avant le hublot')+'</dt><dd>'+mm(B.gap)+'</dd>'
      +'<dt>'+t('Connecteurs droits et câbles')+'</dt><dd>'+mm(B.rear)+'</dd>'
      +'<dt>'+t('Marge latérale')+'</dt><dd>'+t('{v} mm par côté',{v:n(B.side)})+'</dd>'
      +'<dt>'+t('Extérieur estimé')+'</dt><dd>'+n(B.ext.L)+' × '+n(B.ext.W)+' × '+n(B.ext.H)+' mm</dd></dl>'
      +'<p class="note">'+t('Longueur × largeur × hauteur. Caméra : {c}. Objectif : {o}.',{c:esc(B.cam.label),o:esc(B.lens.how)})+'</p></div>';
    h+='<div><span class="cap">'+t('Hublot')+'</span><span class="big">≥ '+mm(B.win.ap)+'</span>'
      +'<dl class="kv"><dt>'+t('Ouverture utile')+'</dt><dd>≥ '+mm(B.win.ap)+'</dd><dt>'+t('Épaisseur')+'</dt><dd>≈ '+mm(B.win.thick)+'</dd><dt>'+t('Demi-angle de champ')+'</dt><dd>'+n(B.win.half,1)+'°</dd></dl>'
      +'<p class="env-txt" style="margin-top:8px">'+esc(B.win.mat)+'</p><p class="note">'+esc(B.win.note)+'</p></div>';
    h+='<div><span class="cap">'+t('Gestion thermique')+'</span><span class="big">'+esc(T.head)+'</span>'+li(T.items)+'</div>';
    h+='<div><span class="cap">'+t('Matière, fixation, câbles')+'</span><dl class="kv kv-text"><dt>'+t('Matière')+'</dt><dd>'+esc(B.material)+'</dd><dt>'+t('Fixation')+'</dt><dd>'+esc(B.mount)+'</dd><dt>'+t('Passages')+'</dt><dd>'+esc(B.glandsText)+'</dd></dl></div>';
    h+='<div><span class="cap">'+t('Encombrement disponible')+'</span>'+(B.fit
      ?'<span class="big">'+n(B.fit.space.L)+' × '+n(B.fit.space.W)+' × '+n(B.fit.space.H)+' mm</span><div><span class="pill '+FIT[B.fit.status]+'">'+(B.fit.status==='ok'?t('compatible'):B.fit.status==='juste'?t('compatible de justesse'):t('insuffisant'))+'</span></div><p class="note">'+esc(B.fit.text)+'</p>'
      :'<span class="big">'+t('Non renseigné')+'</span><p class="note">'+t('Saisissez la longueur, la largeur et la hauteur disponibles pour vérifier que le boîtier tient.')+'</p>')+'</div>';
    h+='</div><div class="pad" style="padding-top:0">'+flagsHtml(E.flags.concat(E.notes.map(function(m){return {t:'info',m:m}})))
      +'<details style="margin-top:12px"><summary>'+t('Cahier des charges du boîtier')+'</summary><pre class="spec-txt" style="margin:12px 0 0">'+esc(E.spec)+'</pre></details></div></section>';
    return h;
  }
  window.LumenAnimate = function(){ animNext = true; render(); };
  function setMsg(t){ $('csvMsg').textContent=t; }
  function loadCsv(text){
    var r=C.parseCatalog(text);
    imported=r.entries;
    setMsg((r.entries.length>1?t('{n} références chargées',{n:r.entries.length}):t('{n} référence chargée',{n:r.entries.length}))+(r.errors.length?t('. {n} erreur(s) : {list}',{n:r.errors.length,list:r.errors.slice(0,3).join(' ')}):'.'));
    render();
  }
  function clearPreset(){ [].forEach.call(document.querySelectorAll('[data-p]'),function(b){b.classList.remove('on')}); }
  document.addEventListener('input', function(e){ if(e.target.closest && e.target.closest('#form') && e.target.id!=='csvText' && e.target.id!=='csvFile'){ clearPreset(); render(); } });
  document.addEventListener('change', function(e){
    if(e.target.id==='csvFile' && e.target.files && e.target.files[0]){ var fr=new FileReader(); fr.onload=function(){ $('csvText').value=String(fr.result); loadCsv(String(fr.result)); }; fr.readAsText(e.target.files[0]); }
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest) return;
    var p=e.target.closest('[data-p]'); if(p){ apply(PRESETS[p.dataset.p]); clearPreset(); p.classList.add('on'); picked=false; animNext=true; render(); return; }
    var tk=e.target.closest('[data-task]'); if(tk){ $('task').value=tk.dataset.task; syncTask(); clearPreset(); render(); return; }
    if(e.target.id==='csvLoad'){ loadCsv($('csvText').value); return; }
    if(e.target.id==='csvTpl'){ $('csvText').value=C.CSV_TEMPLATE; setMsg(t('Modèle collé : remplacez par vos lignes puis chargez.')); return; }
    if(e.target.id==='csvClear'){ imported=[]; $('csvText').value=''; setMsg(t('Aucun catalogue importé.')); render(); return; }
    var tr=e.target.closest('#out tr[data-id]'); if(tr){ sel=tr.dataset.id; picked=true; animNext=true; render(); return; }
    var a=e.target.closest('#out .anchors a'); if(a){ e.preventDefault(); var tg=document.querySelector(a.getAttribute('href')); if(tg) tg.scrollIntoView({behavior:'smooth',block:'start'}); }
  });
  document.addEventListener('keydown', function(e){
    if(e.key!=='Enter' && e.key!==' ') return;
    var row=e.target.closest && e.target.closest('#out tr[data-id]'); if(row){ e.preventDefault(); row.click(); }
  });
  window.LumenCalc = {
    state: function(){ return last; },
    load: function(o){ apply(Object.assign({}, ENV_DEF, o)); clearPreset(); if(o._sensor){ sel=o._sensor; picked=true; } else picked=false; render(); },
    /* changement de langue : listes construites en JS, puis résultats */
    rerender: function(){ buildMaterials(); render(); }
  };
  render();
})();
