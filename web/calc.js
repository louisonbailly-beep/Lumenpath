/* Calculateur complet : capteur, objectif, lumière. Interface seule : tout le calcul est dans OptiCalc (app/src/core.js). */
(function(){
  var C = OptiCalc, $ = function(id){return document.getElementById(id)};
  var sel = null, picked = false, imported = [], last = null;
  function n(x, d){ if(x==null||!isFinite(x)) return '∞'; return x.toLocaleString('fr-FR',{minimumFractionDigits:d==null?0:d, maximumFractionDigits:d==null?0:d}); }
  function num(id){ return parseFloat($(id).value); }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  var FIELDS = ['fovH','fovV','wd','depth','defect','k','color','globalOnly','speed','exposure','nom','coc','task','backlight','material','tcolor','lamCons','lamC','lamFwhm','lamMin','lamMax','ambient','showPrice','cur','rate','glare','useDemo','showBrand'];
  function readInputs(){
    return { fovH:num('fovH'), fovV:num('fovV'), wd:num('wd'), depth:num('depth')||0, defect:num('defect'), k:num('k'),
      color:$('color').checked, globalOnly:$('globalOnly').checked, speed:num('speed')||0, exposure:num('exposure')||0,
      nom:num('nom'), cocPx:num('coc'), task:$('task').value, backlight:$('backlight').checked,
      material:$('material').value, tcolor:$('tcolor').value, lamCons:$('lamCons').value,
      lamC:num('lamC'), lamFwhm:num('lamFwhm'), lamMin:num('lamMin'), lamMax:num('lamMax'),
      ambient:$('ambient').value, showPrice:$('showPrice').checked, rate:num('rate')>0?num('rate'):1, glare:$('glare').checked, nstar:2 };
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
  (function(){
    var g='', h='';
    C.MATERIALS.forEach(function(m){ if(m.grp!==g){ if(g) h+='</optgroup>'; h+='<optgroup label="'+esc(m.grp)+'">'; g=m.grp; } h+='<option value="'+m.id+'">'+esc(m.label)+'</option>'; });
    $('material').innerHTML=h+'</optgroup>';
  })();
  function syncVis(){
    var m=C.materialById($('material').value), c=$('lamCons').value;
    $('tcolorW').classList.toggle('hidden', !m.colorRule);
    $('lamSrcW').classList.toggle('hidden', c!=='source');
    $('lamBandW').classList.toggle('hidden', c!=='band');
  }
  function syncTask(){ var v=$('task').value; [].forEach.call(document.querySelectorAll('[data-task]'),function(b){ b.classList.toggle('on', b.dataset.task===v); b.setAttribute('aria-pressed', b.dataset.task===v); }); }

  var KCLS={plein:'ok',suffisant:'ok',limite:'limite',insuffisant:'insuffisant',inconnu:'off'};
  var KTXT={plein:'Résolution au moins égale au Nyquist',suffisant:'Résolution suffisante',limite:'Résolution limite',insuffisant:'Résolution insuffisante',inconnu:'Résolution inconnue'};
  var STXT={ok:'suffisant',limite:'limite',insuffisant:'insuffisant'};

  function money(usd, rate){ var cur=$('cur').value, v=usd*(cur==='EUR'?rate:1); return n(Math.round(v/10)*10,0)+' '+(cur==='EUR'?'€':'$'); }
  function priceCell(s, inp){
    var p=C.estimatePrice(s);
    if(p.quote) return '<span class="muted" title="'+esc(p.why)+'">sur devis</span>';
    return '<span title="'+esc(p.basis)+' · fourchette '+esc(money(p.lo,inp.rate))+' – '+esc(money(p.hi,inp.rate))+'">≈ '+money(p.usd,inp.rate)+'</span>';
  }
  function chartSvg(L){
    var W=720,H=250,l=52,r=16,t=14,b=52, pw=W-l-r, ph=H-t-b, xmax=L.cutoff;
    function X(v){return l+pw*Math.min(v,xmax)/xmax} function Y(v){return t+ph*(1-v)}
    var pts=[],i; for(i=0;i<=120;i++){var f=xmax*i/120; pts.push(X(f).toFixed(1)+','+Y(C.mtfDiff(f/xmax)).toFixed(1));}
    var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Contraste de diffraction en fonction de la fréquence spatiale">';
    [0,0.2,0.5,1].forEach(function(v){ s+='<line class="'+(v===0?'axis':'grid')+'" x1="'+l+'" x2="'+(W-r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(l-8)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+Math.round(v*100)+' %</text>'; });
    for(i=0;i<=4;i++){ var fv=xmax*i/4; s+='<line class="axis" x1="'+X(fv)+'" x2="'+X(fv)+'" y1="'+(t+ph)+'" y2="'+(t+ph+4)+'"/><text x="'+X(fv)+'" y="'+(t+ph+18)+'" text-anchor="middle">'+n(fv,0)+'</text>'; }
    s+='<text x="'+(l+pw/2)+'" y="'+(H-6)+'" text-anchor="middle">fréquence spatiale côté image, lp/mm</text>';
    s+='<polygon class="area" points="'+l+','+Y(0)+' '+pts.join(' ')+' '+X(xmax)+','+Y(0)+'"/><polyline class="curve" points="'+pts.join(' ')+'"/>';
    var nq=L.nuN, rq=L.nuReq, nqLeft=nq>xmax*0.6;
    s+='<line class="nyq" x1="'+X(nq)+'" x2="'+X(nq)+'" y1="'+t+'" y2="'+(t+ph)+'"/>';
    s+='<text x="'+(X(nq)+(nqLeft?-6:6))+'" y="'+(t+12)+'" text-anchor="'+(nqLeft?'end':'start')+'" style="fill:var(--ink)">Nyquist '+n(nq,0)+'</text>';
    if(rq<=xmax){ s+='<line class="req" x1="'+X(rq)+'" x2="'+X(rq)+'" y1="'+t+'" y2="'+(t+ph)+'"/><text x="'+(X(rq)+(rq>xmax*0.6?-6:6))+'" y="'+(t+28)+'" text-anchor="'+(rq>xmax*0.6?'end':'start')+'" style="fill:var(--warn)">requis '+n(rq,0)+'</text>'; }
    else { s+='<text x="'+(W-r)+'" y="'+(t+28)+'" text-anchor="end" style="fill:var(--bad)">requis '+n(rq,0)+' lp/mm, au-delà de la diffraction</text>'; }
    return s+'</svg>';
  }
  /* Jauge en arc : frac de 0 à 1, valeur et légende au centre */
  function gauge(frac, value, sub, st, label){
    var N=23, cx=110, cy=112, r1=72, r2=98, on=Math.round(Math.max(0,Math.min(1,frac))*N), s='';
    for(var i=0;i<N;i++){ var a=Math.PI*(1-i/(N-1)), c=Math.cos(a), si=Math.sin(a);
      s+='<line class="'+(i<on?'g-on':'g-off')+'" x1="'+(cx+r1*c).toFixed(1)+'" y1="'+(cy-r1*si).toFixed(1)+'" x2="'+(cx+r2*c).toFixed(1)+'" y2="'+(cy-r2*si).toFixed(1)+'" stroke-width="8" stroke-linecap="round"/>'; }
    return '<svg class="gauge '+st+'" viewBox="0 0 220 124" role="img" aria-label="'+esc(label)+'">'+s+'<text class="g-v" x="110" y="100" text-anchor="middle">'+esc(value)+'</text><text class="g-s" x="110" y="118" text-anchor="middle">'+esc(sub)+'</text></svg>';
  }
  window.LumenGauge = gauge;
  function row(a,b,c){ return '<div><span><b>'+a+'</b><br><code>'+b+'</code></span><span class="res">'+c+'</span></div>'; }
  function flagsHtml(fl, empty){ return '<ul class="flags">'+(fl.length?fl.map(function(f){return '<li class="'+f.t+'">'+esc(f.m)+'</li>'}).join(''):(empty?'<li class="good">'+empty+'</li>':''))+'</ul>'; }
  function catalog(){ var c=[]; if($('useDemo').checked) c=c.concat(C.DEMO_CATALOG); return c.concat(imported); }

  function lensCard(r, showBrand, ev){
    var e=r.e, isT=e.type==='telecentrique', head=isT?('×'+n(e.mag,3)):(n(e.f,e.f%1?1:0)+' mm');
    var h='<div class="lens"><div class="h"><span class="f">'+head+'</span><span class="pill neutral">'+esc(C.KIND_LABEL[e.type])+'</span></div>';
    h+='<div><span class="pill '+KCLS[r.verdict]+'">'+KTXT[r.verdict]+'</span></div>';
    h+='<dl class="kv"><dt>Résolution objectif</dt><dd>'+(e.res!=null?n(e.res,0)+' lp/mm':'non renseignée')+'</dd>'
      +'<dt>Pixel effectif</dt><dd>'+(r.pxEff!=null?n(r.pxEff,2)+' µm':'-')+'</dd>'
      +'<dt>Mpx résolus</dt><dd>'+(r.mpxResolved!=null?n(r.mpxResolved,1)+' sur '+n(ev.dims.mpx,1):'-')+'</dd>'
      +'<dt>Champ obtenu</dt><dd>'+n(r.fovH,1)+' × '+n(r.fovV,1)+' mm</dd>'
      +'<dt>Distance de travail</dt><dd>'+n(r.wd,0)+' mm'+(r.adjWd?' ('+(r.adjDelta>=0?'+':'')+n(r.adjDelta,0)+')':'')+'</dd>'
      +'<dt>Grandissement</dt><dd>'+n(r.m,4)+'×</dd>'
      +(r.ppdEff!=null&&r.verdict!=='inconnu'?'<dt>Pixels par défaut</dt><dd>'+n(r.ppdEff,1)+'</dd>':'')
      +(e.circle!=null?'<dt>Cercle d\'image</dt><dd>'+n(e.circle,1)+' mm</dd>':'')
      +(r.dof?'<dt>Profondeur de champ</dt><dd>'+n(r.dof.total,1)+' mm</dd>':'')
      +'<dt>Contraste diffraction</dt><dd>'+n(r.mtfNyq*100,0)+' % au Nyquist</dd></dl>';
    h+=flagsHtml(r.flags);
    var refs=r.refs.filter(function(x){return !x.demo});
    if(refs.length){
      var list=refs.slice(0,8).map(function(x){ return esc((x.brand?x.brand+' · ':'')+x.ref); });
      h+='<div class="refs">'+n(refs.length)+' référence'+(refs.length>1?'s':'')+' de même spécification'+(showBrand?' : '+list.join(', ')+(refs.length>8?'…':''):'. Cochez « Afficher fabricant et référence » pour les voir.')+'</div>';
    } else h+='<div class="refs">Exemple générique sans marque.</div>';
    return h+'</div>';
  }

  function render(){
    syncVis();
    var inp = readInputs(), out = $('out');
    if(!(inp.fovH>0&&inp.fovV>0&&inp.wd>0&&inp.defect>0)){ last=null; out.innerHTML='<div class="card empty">Renseignez le champ de vue, la distance de travail et le plus petit défaut.</div>'; return; }
    var lr = C.resolveLambda(inp); inp.lambda = lr.lam;
    var req = C.requiredPixels(inp), ranked = C.rankSensors(inp);
    var ev = ranked.filter(function(x){return x.sensor.id===sel})[0];
    if(!ev || !picked){ ev = ranked.filter(function(x){return !x.excluded && x.status==='ok'})[0] || ranked.filter(function(x){return !x.excluded})[0] || ranked[0]; sel = ev.sensor.id; }
    var lt = C.lensType(ev, inp), sp = C.lensSpec(ev, inp, lt), L = C.lightAdvice(inp, ev, lt.kind, lr);
    var pixTarget = inp.defect/inp.k, st = ev.excluded ? 'insuffisant' : ev.status;
    var shortId = ev.sensor.id.split(' / ')[0];
    var fTxt = sp.kind==='telecentrique' ? 'Objectif télécentrique, grandissement ≈ '+n(sp.m,3)+'×' : 'Objectif '+esc(lt.label.toLowerCase())+' de '+n(sp.f,1)+' mm environ';
    var apTxt = sp.win.nMin!=null && sp.win.nMin<=sp.win.nMax ? ', ouvert entre f/'+n(Math.max(sp.win.nMin,1.4),1)+' et f/'+n(sp.win.nMax,1) : ', ne pas fermer au-delà de f/'+n(sp.win.nMax,1);
    var title = st==='ok' ? 'Le capteur '+esc(shortId)+' convient' : st==='limite' ? 'Le capteur '+esc(shortId)+' est à la limite' : (ev.excluded ? 'Aucun capteur ne convient tel quel' : 'Le capteur '+esc(shortId)+' est insuffisant');

    // texte de spécification
    var spec = [
      'Inspection : '+(inp.task==='mesure'?'mesure':'détection')+', champ '+n(inp.fovH)+' × '+n(inp.fovV)+' mm à '+n(inp.wd)+' mm, variation de hauteur '+n(inp.depth)+' mm',
      'Plus petit défaut : '+n(inp.defect)+' µm sur '+n(req.kEff)+' pixels ('+n(pixTarget,1)+' µm par pixel côté objet)',
      'Capteur : '+ev.sensor.id+', '+ev.sensor.w+' × '+ev.sensor.h+' px, pixel '+n(ev.sensor.p,2)+' µm, '+ev.sensor.fmt,
      'Type d\'objectif : '+lt.label,
      (sp.kind==='telecentrique'?'Grandissement : ≈ '+n(sp.m,3)+'×':'Focale : ≈ '+n(sp.f,1)+' mm (séries voisines '+(sp.fBelow||'-')+' et '+(sp.fAbove||'-')+' mm)'),
      'Résolution objectif : ≥ '+n(sp.nuK,0)+' lp/mm côté image',
      'Cercle d\'image : ≥ '+n(sp.circleMin,1)+' mm (≈ '+n(sp.inch,2)+'")',
      'Ouverture : f/'+n(inp.nom,1)+' (f/'+n(sp.nEff,1)+' effectif), diffraction : f/'+n(sp.win.nMax,1)+' au plus',
      'Lumière : '+n(L.lam)+' nm ('+L.from+'), filtre '+L.filter.name+(L.pol.use?', polarisation conseillée':'')
    ].join('\n');
    last = { inputs: snapshot(), spec: spec, summary: { capteur: ev.sensor.id, statut: st, type: lt.label, focale: sp.f||null, grandissement: sp.m, resolution_lpmm: sp.nuK, cercle_mm: sp.circleMin, lambda_nm: L.lam }, title: title.replace(/&[^;]+;/g,'') };

    var ratio = ev.ppd/ev.kEff;
    var h = '<section class="card verdict '+st+'"><div class="l">'+gauge(ratio/2, n(ev.ppd,1)+' px', 'sur le défaut · '+n(ev.kEff)+' requis', st, n(ev.ppd,1)+' pixels sur le défaut pour '+n(ev.kEff)+' requis')
      + '<div><span class="eyebrow">'+(st==='ok'?'Capteur suffisant':st==='limite'?'À la limite':'Insuffisant')+'</span><h1 style="margin-top:6px">'+title+'</h1><p>'+fTxt+apTxt+', résolution d\'au moins '+n(sp.nuK,0)+' lp/mm.</p></div></div>'
      + '<div class="btns"><button type="button" class="btn" data-act="copy-calc">Copier la spécification</button><button type="button" class="btn pri" data-act="save-calc">Enregistrer le projet</button></div></section>';
    h += '<nav class="anchors" aria-label="Sections"><a class="chip" href="#c-resume">Résumé</a><a class="chip" href="#c-capteurs">Capteurs</a><a class="chip" href="#c-objectif">Objectif</a><a class="chip" href="#c-lumiere">Lumière</a><a class="chip" href="#c-contraste">Contraste</a></nav>';

    h += '<section id="c-resume" class="card grid">'
      + '<div class="cell"><span class="cap">Pixels requis</span><span class="v">'+n(req.nH)+' × '+n(req.nV)+'</span><span class="n">'+n(req.mpx,1)+' Mpx au minimum, '+n(req.kEff)+' px par défaut</span></div>'
      + '<div class="cell"><span class="cap">Pixel objet visé</span><span class="v">'+n(pixTarget,1)+' µm</span><span class="n">'+n(inp.defect)+' µm ÷ '+n(inp.k)+' pixels</span></div>'
      + '<div class="cell"><span class="cap">Capteur retenu</span><span class="v">'+esc(shortId)+'</span><span class="n">'+n(ev.sensor.w)+' × '+n(ev.sensor.h)+' · '+n(ev.sensor.p,2)+' µm · '+esc(ev.sensor.fmt)+'</span>'+(inp.showPrice?'<span class="n">Caméra : '+priceCell(ev.sensor,inp)+'</span>':'')+'</div>'
      + '<div class="cell"><span class="cap">Type d\'objectif</span><span class="v">'+esc(lt.label.toLowerCase())+'</span><span class="n">'+(sp.f?'focale ≈ '+n(sp.f,1)+' mm · ':'')+'λ '+n(lr.lam)+' nm</span></div>'
      + '</section>';

    h += '<section id="c-capteurs" class="card" style="overflow:hidden"><div class="ch"><b>Capteurs possibles</b><span>Du plus petit suffisant au plus grand. Cliquez une ligne pour calculer l\'objectif.</span></div><div class="scroll"><table class="t cards"><thead><tr><th>Capteur</th><th class="n">Résolution</th><th class="n">Pixel</th><th>Obturateur</th><th class="n">Px / défaut</th><th class="n">Grandissement</th><th>Verdict</th>'+(inp.showPrice?'<th class="n">Caméra</th>':'')+'</tr></thead><tbody>';
    ranked.forEach(function(e){
      var s=e.sensor, cls=(s.id===sel?'sel':'')+(e.excluded?' off':''), pct=Math.max(0,Math.min(100,e.ppd/e.kEff*50));
      var verdict = e.excluded ? '<span class="pill off">exclu : '+esc(e.why)+'</span>' : '<span class="pill '+e.status+'">'+STXT[e.status]+'</span>';
      h+='<tr tabindex="0" data-id="'+esc(s.id)+'" class="'+cls+'"><td><span style="font-weight:500">'+esc(s.id)+'</span> <span class="muted" style="font-size:13px">'+esc(s.fmt)+' · '+esc(s.fam)+(s.swir?' · 400–1700 nm':'')+'</span></td>'
        +'<td class="n num"><span class="lbl">Résolution </span>'+n(s.w)+' × '+n(s.h)+'</td><td class="n num"><span class="lbl">Pixel </span>'+n(s.p,2)+' µm</td><td><span class="lbl">Obturateur </span>'+(s.sh==='global'?'global':'roulant')+'</td>'
        +'<td class="n num"><span class="lbl">Px/défaut </span>'+n(e.ppd,1)+'<span class="bar" aria-hidden="true"><i style="width:'+pct+'%"></i></span></td><td class="n num"><span class="lbl">Grandissement </span>'+n(e.m,4)+'×'+(e.portrait?' ↻':'')+'</td><td>'+verdict+'</td>'+(inp.showPrice?'<td class="n num"><span class="lbl">Caméra </span>'+priceCell(s,inp)+'</td>':'')+'</tr>';
    });
    h+='</tbody></table></div><div class="pad" style="padding-top:4px">'+(inp.showPrice?'<p class="note">Prix indicatif hors taxes d\'une caméra monochrome USB3 de même résolution (Basler ace 2, revendeur américain), fourchette ±25 %. Interface, couleur, volume et droits de douane changent le prix : à confirmer par devis.</p>':'')+'<p class="note">↻ : capteur tourné de 90° pour mieux couvrir le champ. La barre atteint la moitié à la valeur exigée.</p></div></section>';

    var showBrand=$('showBrand').checked;
    h += '<section id="c-objectif" class="card" style="overflow:hidden"><div class="ch"><b>Objectif à spécifier</b><span>Neutre, valable pour toute marque</span></div><div class="spec">';
    h += '<div><span class="cap">Type conseillé</span><span class="big">'+esc(lt.label)+'</span>'+flagsHtml(lt.reasons)
      +(lt.alt.length?'<p class="note">Alternative : '+lt.alt.map(function(k){return esc(C.KIND_LABEL[k])}).join(', ')+'.</p>':'')+'</div>';
    h += '<div><span class="cap">'+(sp.kind==='telecentrique'?'Grandissement':'Focale')+'</span><span class="big">'+(sp.kind==='telecentrique'?'≈ '+n(sp.m,3)+'×':'≈ '+n(sp.f,1)+' mm')+'</span>'
      +'<dl class="kv"><dt>Grandissement</dt><dd>'+n(sp.m,4)+'×</dd>'
      +(sp.kind!=='telecentrique'?'<dt>Séries voisines</dt><dd>'+(sp.fBelow?sp.fBelow+' mm':'-')+' · '+(sp.fAbove?sp.fAbove+' mm':'-')+'</dd>':'<dt>Distance de travail</dt><dd>≈ '+n(inp.wd,0)+' mm, imposée</dd>')
      +'<dt>Cercle d\'image</dt><dd>≥ '+n(sp.circleMin,1)+' mm (≈ '+n(sp.inch,2)+'")</dd></dl></div>';
    h += '<div><span class="cap">Résolution</span><span class="big">≥ '+n(sp.nuK,0)+' lp/mm</span>'
      +'<dl class="kv"><dt>Pour '+n(sp.kEff)+' px/défaut</dt><dd>'+n(sp.nuK,0)+' lp/mm</dd>'
      +'<dt>Pixel effectif max.</dt><dd>'+n(sp.pitchEq,2)+' µm</dd>'
      +'<dt>Nyquist du capteur</dt><dd>'+n(sp.nuN,0)+' lp/mm</dd>'
      +'<dt>Défaut seul (2 px)</dt><dd>'+n(sp.nuReq,0)+' lp/mm</dd>'
      +'<dt>Côté objet</dt><dd>'+n(sp.objLpmm,1)+' lp/mm</dd></dl></div>';
    h += '<div><span class="cap">Ouverture</span><span class="big">f/'+n(inp.nom,1)+'</span>'
      +'<dl class="kv"><dt>Effective</dt><dd>f/'+n(sp.nEff,1)+'</dd><dt>Coupure à '+n(inp.lambda)+' nm</dt><dd>'+n(sp.cutoff,0)+' lp/mm</dd><dt>Contraste au Nyquist</dt><dd>'+n(sp.mtfNyq*100,0)+' %</dd>'
      +(sp.dof?'<dt>Profondeur de champ</dt><dd>'+n(sp.dof.total,1)+' mm</dd>':'')+'</dl>'
      +(sp.win.nMin!=null?(sp.win.nMin>sp.win.nMax?flagsHtml([{t:'bad',m:'Il faudrait au moins f/'+n(sp.win.nMin,1)+' pour tenir '+n(inp.depth)+' mm, mais la diffraction impose f/'+n(sp.win.nMax,1)+' au plus. Réduire la variation de hauteur, accepter 2 pixels de flou ou choisir un télécentrique.'}]):flagsHtml([{t:'good',m:'Plage d\'ouverture : f/'+n(Math.max(sp.win.nMin,1.4),1)+' à f/'+n(sp.win.nMax,1)+'.'}])):flagsHtml([{t:'good',m:'Ne pas dépasser f/'+n(sp.win.nMax,1)+' (diffraction).'}]))
      +'</div></div></section>';

    var cat=catalog(), prim=C.matchCatalog(ev, inp, cat, [lt.kind]), alts=lt.alt.length?C.matchCatalog(ev, inp, cat, lt.alt):[], nImp=imported.length;
    h += '<section class="card"><div class="ch"><b>Objectifs du catalogue : '+esc(lt.label.toLowerCase())+'</b><span>'+(nImp?n(nImp)+' références importées. ':'')+'Une carte par spécification, aucune marque mise en avant.</span></div>';
    if(!prim.length) h+='<div class="empty">Aucun objectif du catalogue ne correspond ('+esc(lt.label.toLowerCase())+', cercle d\'image ≥ '+n(ev.dims.D,1)+' mm).'+(nImp?'':' Importez votre gamme en CSV dans les options avancées.')+'</div>';
    else h+='<div class="lenses">'+prim.slice(0,6).map(function(r){return lensCard(r,showBrand,ev)}).join('')+'</div>'+(prim.length>6?'<p class="note pad" style="padding-top:0">'+(prim.length-6)+' autres spécifications non affichées.</p>':'');
    if(alts.length) h+='<details class="pad" style="border-top:1px solid var(--line)"><summary>Alternatives : '+lt.alt.map(function(k){return esc(C.KIND_LABEL[k])}).join(', ')+' ('+alts.length+')</summary><div class="lenses" style="padding:12px 0 0">'+alts.slice(0,6).map(function(r){return lensCard(r,showBrand,ev)}).join('')+'</div></details>';
    h+='</section>';

    var f=L.filter;
    h += '<section id="c-lumiere" class="card" style="overflow:hidden"><div class="ch"><b>Longueur d\'onde et filtre</b><span>'+esc(L.mat.label)+' · '+n(L.lam)+' nm ('+esc(L.from)+')</span></div><div class="spec">';
    h += '<div><span class="cap">À observer</span><dl class="kv">'+L.bands.map(function(b){ return '<dt>'+(b.lam!=null?n(b.lam)+' nm':n(b.lo)+'–'+n(b.hi)+' nm')+'</dt><dd style="text-align:left;font-family:var(--font)">'+esc(b.role)+'</dd>'; }).join('')+'</dl>'
      +'<ul class="flags" style="margin-top:8px">'+L.bands.map(function(b){return '<li class="info">'+esc(b.why)+'</li>'}).join('')+'</ul></div>';
    h += '<div><span class="cap">Filtre · '+esc(f.need)+'</span><span class="big">'+esc(f.name)+'</span>'
      +'<dl class="kv">'+(f.kind==='longpass'?'<dt>Coupure</dt><dd>≥ '+n(f.cut,0)+' nm</dd>':'<dt>Centre</dt><dd>'+n(f.c0,0)+' nm</dd><dt>Largeur mi-hauteur</dt><dd>≥ '+n(f.bmin,0)+' nm</dd>')
      +'<dt>Décalage en bord</dt><dd>'+(L.telecentric?'≈ 0':'−'+n(L.shift,1))+' nm</dd><dt>Angle de champ</dt><dd>'+(L.telecentric?'≈ 0':n(L.thetaDeg,1))+'°</dd></dl>'
      +'<p class="note">'+esc(f.text)+'</p></div>';
    h += '<div><span class="cap">Polarisation</span><span class="big">'+(L.pol.use?'Conseillée':'Inutile')+'</span>'+(L.pol.use?'<p class="note">'+esc(L.pol.text)+'</p>':'<p class="note">Aucun reflet ni matière transparente signalés. Cochez « Reflets gênants » si la surface brille.</p>')+'</div>';
    h += '</div><div class="pad" style="padding-top:0">'+flagsHtml(L.flags.concat(L.notes.map(function(m){return {t:'info',m:m}})));
    h += '<ul class="srcs">'+L.src.concat(inp.showPrice?['mvstore']:[]).map(function(k){var s=C.SRC[k]; return s?'<li><a href="'+s.u+'" target="_blank" rel="noopener noreferrer">'+esc(s.t)+'</a></li>':''}).join('')+'</ul>';
    h += '<p class="note">Le décalage vers le bleu suit λ = λ₀ √(1 − (sin θ ÷ n*)²) avec n* ≈ 2 supposé, une valeur indicative : la fiche du filtre donne la valeur exacte.</p></div></section>';

    h+='<section id="c-contraste" class="card"><div class="ch"><b>Contraste limité par la diffraction</b><span>f/'+n(inp.nom,1)+', f/'+n(sp.nEff,1)+' effectif, '+n(inp.lambda)+' nm</span></div><div class="pad">'+chartSvg(sp)
      +'<div class="legend"><span class="l1">contraste théorique sans aberration</span><span class="l2">Nyquist du capteur</span><span class="l3">fréquence requise pour le défaut</span></div>'
      +'<p class="note">Un objectif réel reste sous cette courbe : c\'est le plafond de la physique. Contraste théorique de '+n(sp.mtfNyq*100,0)+' % au Nyquist.</p>'
      +'<details style="margin-top:12px"><summary>Détail des calculs</summary><div class="calc">'
      +row('Pixels requis','N = FOV × k ÷ défaut','= '+n(inp.fovH)+' × '+n(req.kEff)+' ÷ '+n(inp.defect/1000,3)+' mm = '+n(req.nH)+' px (largeur)')
      +row('Grandissement maximal','m = min(L<sub>h</sub> ÷ FOV<sub>h</sub>, L<sub>v</sub> ÷ FOV<sub>v</sub>)','= '+n(ev.m,4)+'×')
      +(sp.f?row('Focale','f = WD × m ÷ (1 + m)','= '+n(inp.wd)+' × '+n(ev.m,4)+' ÷ '+n(1+ev.m,4)+' = '+n(sp.f,2)+' mm'):'')
      +row('Pixel côté objet','p<sub>obj</sub> = pixel ÷ m','= '+n(ev.sensor.p,2)+' ÷ '+n(ev.m,4)+' = '+n(ev.pixObj,1)+' µm')
      +row('Résolution requise','ν = 1000 ÷ (2 × p<sub>équiv</sub>), p<sub>équiv</sub> = défaut × m ÷ k','= '+n(sp.nuK,1)+' lp/mm côté image')
      +row('Fréquence de Nyquist','ν<sub>N</sub> = 1000 ÷ (2 × pixel)','= '+n(sp.nuN,1)+' lp/mm')
      +row('Ouverture effective','N<sub>eff</sub> = N × (1 + m)','= '+n(inp.nom,1)+' × '+n(1+ev.m,3)+' = '+n(sp.nEff,2))
      +row('Coupure de diffraction','ν<sub>c</sub> = 1 ÷ (λ × N<sub>eff</sub>)','= '+n(sp.cutoff,0)+' lp/mm à '+n(inp.lambda)+' nm')
      +row('Erreur de perspective','Δ = FOV × Δz ÷ WD','= '+n(lt.perr,2)+' mm, soit '+n(lt.perrPx,1)+' px')
      +row('Décalage du filtre','Δλ = λ₀ (1 − √(1 − (sin θ ÷ n*)²))','= '+n(L.shift,1)+' nm à '+n(L.thetaDeg,1)+'°')
      +'</div></details></div></section>';
    out.innerHTML = h;
  }
  function setMsg(t){ $('csvMsg').textContent=t; }
  function loadCsv(text){
    var r=C.parseCatalog(text);
    imported=r.entries;
    setMsg(r.entries.length+' référence'+(r.entries.length>1?'s':'')+' chargée'+(r.entries.length>1?'s':'')+(r.errors.length?'. '+r.errors.length+' erreur(s) : '+r.errors.slice(0,3).join(' '):'.'));
    render();
  }
  function clearPreset(){ [].forEach.call(document.querySelectorAll('[data-p]'),function(b){b.classList.remove('on')}); }
  document.addEventListener('input', function(e){ if(e.target.closest && e.target.closest('#form') && e.target.id!=='csvText' && e.target.id!=='csvFile'){ clearPreset(); render(); } });
  document.addEventListener('change', function(e){
    if(e.target.id==='csvFile' && e.target.files && e.target.files[0]){ var fr=new FileReader(); fr.onload=function(){ $('csvText').value=String(fr.result); loadCsv(String(fr.result)); }; fr.readAsText(e.target.files[0]); }
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest) return;
    var p=e.target.closest('[data-p]'); if(p){ apply(PRESETS[p.dataset.p]); clearPreset(); p.classList.add('on'); picked=false; render(); return; }
    var tk=e.target.closest('[data-task]'); if(tk){ $('task').value=tk.dataset.task; syncTask(); clearPreset(); render(); return; }
    if(e.target.id==='csvLoad'){ loadCsv($('csvText').value); return; }
    if(e.target.id==='csvTpl'){ $('csvText').value=C.CSV_TEMPLATE; setMsg('Modèle collé : remplacez par vos lignes puis chargez.'); return; }
    if(e.target.id==='csvClear'){ imported=[]; $('csvText').value=''; setMsg('Aucun catalogue importé.'); render(); return; }
    var tr=e.target.closest('#out tr[data-id]'); if(tr){ sel=tr.dataset.id; picked=true; render(); return; }
    var a=e.target.closest('#out .anchors a'); if(a){ e.preventDefault(); var t=document.querySelector(a.getAttribute('href')); if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); }
  });
  document.addEventListener('keydown', function(e){
    if(e.key!=='Enter' && e.key!==' ') return;
    var t=e.target.closest && e.target.closest('#out tr[data-id]'); if(t){ e.preventDefault(); t.click(); }
  });
  window.LumenCalc = {
    state: function(){ return last; },
    load: function(o){ apply(o); clearPreset(); if(o._sensor){ sel=o._sensor; picked=true; } else picked=false; render(); }
  };
  render();
})();
