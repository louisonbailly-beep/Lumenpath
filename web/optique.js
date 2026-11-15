/* Optique conseillée : à partir d'un capteur saisi, recommande focale, type d'objectif, monture et accessoires. */
(function(){
  var C=OptiCalc, $=function(i){return document.getElementById(i)};
  var I=window.I18N, t=function(s,v){ return I.t(s,v); }, lc=function(s){ return I.lc(s); }, dec=function(s){ return I.dec(s); };
  function n(x,d){ if(x==null||!isFinite(x)) return '∞'; return x.toLocaleString(I.locale,{minimumFractionDigits:d||0,maximumFractionDigits:d||0}); }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function num(i){return parseFloat($(i).value)}
  var FIELDS=['o_imx','o_sensor','o_sw','o_sh','o_p','o_mount','o_fovH','o_fovV','o_wd','o_depth','o_back','o_task','o_defect','o_k','o_prec','o_sub','o_nom','o_lam','o_coc'];
  var PRE={
    defaut:{o_sensor:'IMX250 / IMX264',o_fovH:100,o_fovV:80,o_wd:300,o_depth:5,o_task:'detection',o_defect:200,o_k:3,o_back:false,o_nom:5.6},
    cote:{o_sensor:'IMX253 / IMX304',o_fovH:50,o_fovV:40,o_wd:250,o_depth:2,o_task:'mesure',o_prec:10,o_sub:3,o_back:true,o_nom:5.6},
    micro:{o_sensor:'IMX250 / IMX264',o_fovH:10,o_fovV:8,o_wd:120,o_depth:0.5,o_task:'detection',o_defect:20,o_k:3,o_back:false,o_nom:8},
    grand:{o_sensor:'IMX253 / IMX304',o_fovH:600,o_fovV:450,o_wd:1200,o_depth:20,o_task:'detection',o_defect:500,o_k:3,o_back:false,o_nom:5.6}
  };
  var selEl=$('o_sensor');
  function buildSelects(){
    var sv=selEl.value, mv=$('o_mount').value;
    var h='<option value="custom">'+t('Saisie libre')+'</option>';
    C.SENSORS.filter(function(s){return !s.swir}).forEach(function(s){ h+='<option value="'+esc(s.id)+'">'+esc(s.id)+' · '+s.w+' × '+s.h+', '+s.p+' µm</option>'; });
    selEl.innerHTML=h; selEl.value=sv||'IMX250 / IMX264';
    var mh='<option value="none">'+t('Non précisée (conseil automatique)')+'</option>'; C.MOUNTS.forEach(function(m){ mh+='<option value="'+m.id+'">'+esc(t(m.label))+'</option>'; }); $('o_mount').innerHTML=mh;
    if(mv) $('o_mount').value=mv;
  }
  buildSelects();
  var dl=''; C.SENSORS.concat(C.IMX_EXTRA).filter(function(s){return !s.swir}).forEach(function(s){ s.id.split(' / ').forEach(function(x){ dl+='<option value="'+esc(x)+'">'; }); }); $('o_imxList').innerHTML=dl;
  function lookupImx(){
    var q=$('o_imx').value.trim(), msg=$('o_imxMsg'); if(!q){ msg.textContent=''; return; }
    var s=C.findSensor(q);
    if(s){ $('o_sw').value=s.w; $('o_sh').value=s.h; $('o_p').value=s.p; var inList=C.SENSORS.filter(function(x){return x.id===s.id})[0]; selEl.value=inList?s.id:'custom'; msg.textContent=s.w+' × '+s.h+' · '+dec(String(s.p))+' µm · '+t(s.fmt)+(inList?'':t(' (valeurs publiques usuelles, à confirmer sur la fiche)')); }
    else msg.textContent=t('Référence absente de la base : saisissez la taille en pixels et le pixel ci-dessous.');
  }
  function fromSel(){ var s=C.SENSORS.filter(function(x){return x.id===selEl.value})[0]; if(s){ $('o_sw').value=s.w; $('o_sh').value=s.h; $('o_p').value=s.p; } }
  function syncTask(){ var v=$('o_task').value; [].forEach.call(document.querySelectorAll('[data-otask]'),function(b){ b.classList.toggle('on', b.dataset.otask===v); b.setAttribute('aria-pressed', b.dataset.otask===v); }); }
  function snapshot(){ var o={}; FIELDS.forEach(function(k){ var el=$(k); if(el) o[k]=el.type==='checkbox'?el.checked:el.value; }); return o; }
  function apply(o){ Object.keys(o).forEach(function(k){var el=$(k); if(!el) return; if(el.type==='checkbox') el.checked=!!o[k]; else el.value=o[k];}); syncTask(); }
  var last=null, animNext=true;
  function pill(c,t){return '<span class="pill '+c+'">'+t+'</span>'}
  function fl(a){return '<ul class="flags">'+a.map(function(f){return '<li class="'+(f.t==='good'?'good':f.t)+'">'+(f.n?'<b>'+esc(f.n)+'.</b> ':'')+esc(f.m)+'</li>'}).join('')+'</ul>'}
  function render(){
    var meas=$('o_task').value==='mesure';
    $('o_detW').classList.toggle('hidden',meas); $('o_mesW').classList.toggle('hidden',!meas);
    var s={sw:num('o_sw'),sh:num('o_sh'),p:num('o_p'),wd:num('o_wd'),fovH:num('o_fovH'),fovV:num('o_fovV'),depth:num('o_depth')||0,mount:$('o_mount').value,task:$('o_task').value,
      defect:num('o_defect'),k:num('o_k'),prec:num('o_prec'),subdiv:num('o_sub'),nom:num('o_nom'),lambda:num('o_lam')||550,cocPx:num('o_coc'),backlight:$('o_back').checked};
    var out=$('oOut');
    var ok=s.sw>0&&s.sh>0&&s.p>0&&s.wd>0&&s.fovH>0&&s.fovV>0&&(meas?s.prec>0:s.defect>0);
    if(!ok){ last=null; out.innerHTML='<div class="card empty">'+t('Renseignez le capteur, le champ de vue, la distance de travail et le détail à voir.')+'</div>'; return; }
    var R=C.adviseOptic(s), sp=R.spec, lt=R.lt, kind=lt.kind, st=R.status;
    var stTxt=t({ok:'capteur suffisant',limite:'capteur à la limite',insuffisant:'capteur insuffisant'}[st]);
    var ltLabel=t(lt.label);
    var MT=R.mount, mc=MT.chosen;
    var flange=function(m){return m.flange!=null?t(', tirage {t} mm',{t:dec(String(parseFloat(m.flange.toFixed(3))))}):''};
    var lines=[
      [t('Type'), ltLabel],
      [t('Objectif'), R.headline],
      [t('Grandissement'), n(R.m,4)+'×'+(kind==='telecentrique'?'':t(', focale calculée ≈ {f} mm',{f:n(R.fNeed,1)}))],
      [t('Capteur'), t('{w} × {h} px, pixel {p} µm ({d} mm de diagonale)',{w:s.sw,h:s.sh,p:dec(String(s.p)),d:n(R.dims.D,1)})],
      [t('Champ objet'), n(s.fovH)+' × '+n(s.fovV)+' mm'],
      [t('Distance trav.'), t('{wd} mm, variation de hauteur {d} mm',{wd:n(s.wd),d:n(s.depth,1)})],
      [R.meas?t('Mesure'):t('Détection'), R.meas?t('précision visée {p} µm, interpolation 1/{s} px',{p:s.prec,s:s.subdiv}):t('défaut de {d} µm sur {k} pixels',{d:s.defect,k:s.k})],
      [t('Résolution'), t('≥ {v} lp/mm côté image',{v:n(sp.nuK,0)})],
      [t('Cercle d\'image'), '≥ '+n(sp.circleMin,1)+' mm (≈ '+n(sp.inch,2)+'")'],
      [t('Monture'), mc?t(mc.label)+' ('+t(mc.thread)+flange(mc)+')':t('non précisée, {rec}',{rec:MT.recText})],
      [t('Ouverture'), t('f/{n} à {l} nm',{n:n(s.nom,1),l:s.lambda})]
    ];
    var text=lines.map(function(l){ var k=l[0]; while(k.length<16) k+=' '; if(k.length===l[0].length) k+=' '; return k+l[1]; }).join('\n');
    last={ inputs:snapshot(), spec:text, summary:{ type:lt.label, objectif:R.headline, grandissement:R.m, focale:kind==='telecentrique'?null:R.fNeed, resolution_lpmm:sp.nuK, cercle_mm:sp.circleMin, statut:st }, title:R.headline };

    var g=window.LumenGauge?window.LumenGauge(R.reqPix/R.pixObj/2, n(R.pixObj,1)+' µm', t('pixel objet · max {v}',{v:n(R.reqPix,1)}), st, t('Pixel objet {a} µm pour un maximum de {b} µm',{a:n(R.pixObj,1),b:n(R.reqPix,1)})):'';
    var h='<section class="card verdict '+st+'"><div class="l">'+g+'<div><span class="eyebrow">'+t('Recommandation · {s}',{s:stTxt})+'</span>'
      +'<h1 style="margin-top:6px">'+esc(R.headline)+'</h1>'
      +'<p>'+(R.meas?t('Pour une mesure à {p} µm, le pixel objet doit rester sous {r} µm. Ici il vaut {v} µm.',{p:n(s.prec,1),r:n(R.reqPix,1),v:n(R.pixObj,1)}):t('Pour voir un défaut de {d} µm, le pixel objet doit rester sous {r} µm. Ici il vaut {v} µm.',{d:n(s.defect),r:n(R.reqPix,1),v:n(R.pixObj,1)}))+'</p></div></div>'
      +'<div class="btns"><button type="button" class="btn" data-act="copy-opt">'+t('Copier la spécification')+'</button><button type="button" class="btn pri" data-act="save-opt">'+t('Enregistrer le projet')+'</button></div></section>';
    h+='<section class="card grid">'
      +'<div class="cell"><span class="cap">'+t('Grandissement')+'</span><span class="v">'+n(R.m,4)+'×</span><span class="n">'+(kind==='telecentrique'?t('objectif télécentrique'):t('focale calculée ≈ {f} mm',{f:n(R.fNeed,1)}))+'</span></div>'
      +'<div class="cell"><span class="cap">'+t('Pixel objet')+'</span><span class="v">'+n(R.pixObj,1)+' µm</span><span class="n">'+t('maximum admis : {v} µm',{v:n(R.reqPix,1)})+'</span></div>'
      +'<div class="cell"><span class="cap">'+(R.meas?t('Précision atteinte'):t('Défaut minimal vu'))+'</span><span class="v">'+n(R.capab,1)+' µm</span><span class="n">'+pill(st,stTxt)+'</span></div>'
      +'<div class="cell"><span class="cap">'+t('Résolution objectif')+'</span><span class="v">≥ '+n(sp.nuK,0)+' lp/mm</span><span class="n">'+t('cercle d\'image ≥ {c} mm',{c:n(sp.circleMin,1)})+'</span></div></section>';
    if(R.flags.length) h+=fl(R.flags);
    h+='<section class="card"><div class="ch"><b>'+t('Type d\'objectif : {t}',{t:esc(lc(ltLabel))})+'</b><span>'+t('{task}, {h} × {v} mm à {wd} mm',{task:R.meas?t('Mesure'):t('Détection'),h:n(s.fovH),v:n(s.fovV),wd:n(s.wd)})+'</span></div><div class="pad">'+fl(lt.reasons)
      +(lt.alt.length?'<p class="note">'+t('Alternative : {list}.',{list:lt.alt.map(function(k){return esc(t(C.KIND_LABEL[k]))}).join(', ')})+'</p>':'')+'</div></section>';
    if(kind!=='telecentrique'){
      h+='<section class="card" style="overflow:hidden"><div class="ch"><b>'+t('Focales proches')+'</b><span>'+t('Focale exacte ≈ {f} mm : garder la distance, ou garder le champ',{f:n(R.fNeed,1)})+'</span></div><div class="scroll"><table class="t cards"><thead><tr><th>'+t('Focale')+'</th><th class="n">'+t('Champ à {wd} mm',{wd:n(s.wd)})+'</th><th class="n">'+t('Pixel objet')+'</th><th class="n">'+t('Distance pour le champ exact')+'</th><th class="n">'+t('Allonge')+'</th><th>'+t('Verdict')+'</th></tr></thead><tbody>';
      R.options.forEach(function(o){
        var isRec=R.rec&&o.f===R.rec.f, v;
        if(!o.covers) v=pill('limite',t('champ trop petit à cette distance')); else if(!o.okAtWD) v=pill('limite',t('résolution limite')); else v=pill('ok',t('convient'));
        h+='<tr class="'+(isRec?'sel':'')+'"><td><span style="font-weight:500">'+o.f+' mm</span>'+(isRec?' '+pill('neutral',t('conseillée')):'')+'</td><td class="n num"><span class="lbl">'+t('Champ')+' </span>'+n(o.fovHatWD,1)+' × '+n(o.fovVatWD,1)+' mm</td><td class="n num"><span class="lbl">'+t('Pixel objet')+' </span>'+n(o.pixAtWD,1)+' µm</td><td class="n num"><span class="lbl">'+t('Distance')+' </span>'+n(o.wdExact,0)+' mm ('+(o.wdDelta>=0?'+':'')+n(o.wdDelta,0)+')</td><td class="n num"><span class="lbl">'+t('Allonge')+' </span>'+(o.tube>0.3?'≈ '+n(o.tube,1)+' mm':t('non'))+'</td><td>'+v+'</td></tr>';
      });
      h+='</tbody></table></div><p class="note pad" style="padding-top:0">'+t('Distance pour le champ exact = f × (1 + m) ÷ m. Allonge : au-delà du tirage propre de l\'objectif (mise au point minimale type, à confirmer sur la fiche).')+'</p></section>';
    }
    h+='<section class="card"><div class="ch"><b>'+t('Monture')+(mc?' '+esc(t(mc.label)):'')+'</b><span>'+(mc?esc(t(mc.thread))+esc(flange(mc)):t('Conseil selon le capteur'))+'</span></div><div class="pad">'+fl([{t:'info',m:MT.recText}].concat(MT.flags))
      +(mc?'':'<p class="note">'+t('Montures possibles : {list}. Choisissez-en une dans le formulaire pour la vérifier.',{list:MT.rec.map(function(m){return esc(t(m.label))}).join(', ')})+'</p>')+'</div></section>';
    h+='<section class="card"><div class="ch"><b>'+t('Doubleur, allonge et accessoires')+'</b></div><div class="pad">'+fl(R.acc)+'</div></section>';
    h+='<section class="card" style="overflow:hidden"><div class="ch"><b>'+t('Résolution et ouverture')+'</b><span>'+t('À donner au fabricant, sans préférence de marque')+'</span></div><div class="spec">';
    h+='<div><span class="cap">'+t('Résolution de l\'objectif')+'</span><span class="big">≥ '+n(sp.nuK,0)+' lp/mm</span><dl class="kv"><dt>'+t('Côté image')+'</dt><dd>'+n(sp.nuK,0)+' lp/mm</dd><dt>'+t('Pixel effectif max.')+'</dt><dd>'+n(sp.pitchEq,2)+' µm</dd><dt>'+t('Nyquist du capteur')+'</dt><dd>'+n(sp.nuN,0)+' lp/mm</dd><dt>'+t('Côté objet')+'</dt><dd>'+n(1000/(2*R.pixObj),1)+' lp/mm</dd></dl></div>';
    h+='<div><span class="cap">'+t('Format')+'</span><span class="big">'+t('cercle ≥ {c} mm',{c:n(sp.circleMin,1)})+'</span><dl class="kv"><dt>'+t('Diagonale capteur')+'</dt><dd>'+n(R.dims.D,1)+' mm</dd><dt>'+t('Équivalent optique')+'</dt><dd>≈ '+n(sp.inch,2)+'"</dd><dt>'+t('Mégapixels')+'</dt><dd>'+n(R.dims.mpx,1)+'</dd></dl></div>';
    h+='<div><span class="cap">'+t('Ouverture f/{n}',{n:n(s.nom,1)})+'</span><span class="big">'+t('f/{n} eff.',{n:n(sp.nEff,1)})+'</span><dl class="kv"><dt>'+t('Coupure à {l} nm',{l:n(s.lambda)})+'</dt><dd>'+n(sp.cutoff,0)+' lp/mm</dd><dt>'+t('Contraste au Nyquist')+'</dt><dd>'+n(sp.mtfNyq*100,0)+' %</dd>'+(sp.dof?'<dt>'+t('Profondeur de champ')+'</dt><dd>'+n(sp.dof.total,1)+' mm</dd>':'')+'</dl>'
      +(kind==='telecentrique'?fl([{t:'info',m:t('La profondeur de champ d\'un télécentrique est fixée par sa conception, pas par le diaphragme : la lire sur la fiche et la comparer aux {d} mm. Ne pas dépasser f/{b} (diffraction).',{d:n(s.depth,1),b:n(sp.win.nMax,1)})}]):sp.win.nMin!=null&&s.depth>0?(sp.win.nMin>sp.win.nMax?fl([{t:'bad',m:t('Pour tenir {d} mm il faut au moins f/{a}, mais la diffraction limite à f/{b}. Réduire la variation de hauteur ou choisir un télécentrique.',{d:n(s.depth),a:n(sp.win.nMin,1),b:n(sp.win.nMax,1)})}]):fl([{t:'good',m:t('Plage d\'ouverture : f/{a} à f/{b}.',{a:n(Math.max(sp.win.nMin,1.4),1),b:n(sp.win.nMax,1)})}])):fl([{t:'good',m:t('Ne pas dépasser f/{b} (diffraction).',{b:n(sp.win.nMax,1)})}]))+'</div></div>';
    if(R.notes.length) h+='<div class="pad" style="padding-top:0">'+fl(R.notes.map(function(m){return {t:'info',m:m}}))+'</div>';
    h+='</section>';
    h+='<section class="card"><div class="ch"><b>'+t('Spécification à copier')+'</b><button type="button" class="btn sm" data-act="copy-opt">'+t('Copier')+'</button></div><pre class="spec-txt">'+esc(text)+'</pre></section>';
    h+='<section class="card pad"><details><summary>'+t('Détail des calculs')+'</summary><div class="calc">'
      +'<div><span><b>'+t('Pixel objet maximal')+'</b><br><code>'+(R.meas?t('précision × interpolation'):t('défaut ÷ pixels'))+'</code></span><span class="res">'+(R.meas?n(s.prec,1)+' × '+s.subdiv:n(s.defect,1)+' ÷ '+R.k)+' = '+n(R.reqPix,1)+' µm</span></div>'
      +'<div><span><b>'+t('Grandissement')+'</b><br><code>m = min(L<sub>h</sub> ÷ FOV<sub>h</sub>, L<sub>v</sub> ÷ FOV<sub>v</sub>)</code></span><span class="res">'+n(R.m,4)+'×'+(R.ev.portrait?t(' (capteur tourné)'):'')+'</span></div>'
      +'<div><span><b>'+t('Pixel objet atteint')+'</b><br><code>p ÷ m</code></span><span class="res">'+n(s.p,2)+' ÷ '+n(R.m,4)+' = '+n(R.pixObj,1)+' µm</span></div>'
      +'<div><span><b>'+t('Focale')+'</b><br><code>f = WD × m ÷ (1 + m)</code></span><span class="res">'+n(s.wd)+' × '+n(R.m,4)+' ÷ '+n(1+R.m,4)+' = '+n(R.fNeed,1)+' mm</span></div>'
      +'<div><span><b>'+t('Pixels requis')+'</b><br><code>'+t('FOV ÷ pixel objet maximal')+'</code></span><span class="res">'+t('{nh} × {nv} px ({mpx} Mpx), disponibles {hh} × {hv}',{nh:n(R.need.nH),nv:n(R.need.nV),mpx:n(R.need.mpx,1),hh:n(R.have.nH),hv:n(R.have.nV)})+'</span></div>'
      +'<div><span><b>'+t('Champ maximal avec ce capteur')+'</b><br><code>'+t('N<sub>px</sub> × pixel objet maximal')+'</code></span><span class="res">'+n(R.fovMax.H,0)+' × '+n(R.fovMax.V,0)+' mm</span></div>'
      +'<div><span><b>'+t('Distorsion estimée')+'</b><br><code>'+n(R.distPct,1)+' % × FOV ÷ 2</code></span><span class="res">'+t('{e} µm en bord de champ (valeur type, à confirmer)',{e:n(R.distErr,0)})+'</span></div>'
      +'<div><span><b>'+t('Erreur de perspective')+'</b><br><code>Δ = FOV × Δz ÷ WD</code></span><span class="res">'+n(lt.perr||0,2)+' mm</span></div>'
      +'</div><p class="note">'+t('Approximation lentille mince. La distorsion, la mise au point minimale et les focales de série sont des valeurs de travail : la fiche de l\'objectif fait foi.')+'</p></details></section>';
    out.innerHTML=h;
    out.classList.toggle('anim', animNext); animNext=false;
  }
  function clearPreset(){ [].forEach.call(document.querySelectorAll('[data-o]'),function(b){b.classList.remove('on')}); }
  document.addEventListener('input',function(e){
    var t=e.target; if(!t.closest||!t.closest('#oForm')) return;
    if(t.id==='o_imx') lookupImx(); else if(t.id==='o_sensor'){ fromSel(); $('o_imx').value=''; $('o_imxMsg').textContent=''; } else if(t.id==='o_sw'||t.id==='o_sh'||t.id==='o_p') selEl.value='custom';
    clearPreset(); render();
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest) return;
    var p=e.target.closest('[data-o]');
    if(p){ animNext=true; apply(PRE[p.dataset.o]); fromSel(); $('o_imx').value=''; $('o_imxMsg').textContent=''; clearPreset(); p.classList.add('on'); render(); return; }
    var tk=e.target.closest('[data-otask]'); if(tk){ $('o_task').value=tk.dataset.otask; syncTask(); clearPreset(); render(); }
  });
  window.LumenOptique = { state:function(){return last}, load:function(o){ apply(o); clearPreset(); animNext=true; render(); }, animate:function(){ animNext=true; render(); },
    /* changement de langue : listes construites en JS, message de référence, puis résultats */
    rerender:function(){ buildSelects(); lookupImx(); render(); } };
  fromSel(); render();
})();
