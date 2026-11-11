/* Optique conseillée : à partir d'un capteur saisi, recommande focale, type d'objectif, monture et accessoires. */
(function(){
  var C=OptiCalc, $=function(i){return document.getElementById(i)};
  function n(x,d){ if(x==null||!isFinite(x)) return '∞'; return x.toLocaleString('fr-FR',{minimumFractionDigits:d||0,maximumFractionDigits:d||0}); }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function num(i){return parseFloat($(i).value)}
  var FIELDS=['o_imx','o_sensor','o_sw','o_sh','o_p','o_mount','o_fovH','o_fovV','o_wd','o_depth','o_back','o_task','o_defect','o_k','o_prec','o_sub','o_nom','o_lam','o_coc'];
  var PRE={
    defaut:{o_sensor:'IMX250 / IMX264',o_fovH:100,o_fovV:80,o_wd:300,o_depth:5,o_task:'detection',o_defect:200,o_k:3,o_back:false,o_nom:5.6},
    cote:{o_sensor:'IMX253 / IMX304',o_fovH:50,o_fovV:40,o_wd:250,o_depth:2,o_task:'mesure',o_prec:10,o_sub:3,o_back:true,o_nom:5.6},
    micro:{o_sensor:'IMX250 / IMX264',o_fovH:10,o_fovV:8,o_wd:120,o_depth:0.5,o_task:'detection',o_defect:20,o_k:3,o_back:false,o_nom:8},
    grand:{o_sensor:'IMX253 / IMX304',o_fovH:600,o_fovV:450,o_wd:1200,o_depth:20,o_task:'detection',o_defect:500,o_k:3,o_back:false,o_nom:5.6}
  };
  var selEl=$('o_sensor'), h='<option value="custom">Saisie libre</option>';
  C.SENSORS.filter(function(s){return !s.swir}).forEach(function(s){ h+='<option value="'+esc(s.id)+'">'+esc(s.id)+' · '+s.w+' × '+s.h+', '+s.p+' µm</option>'; });
  selEl.innerHTML=h; selEl.value='IMX250 / IMX264';
  var mh='<option value="none">Non précisée (conseil automatique)</option>'; C.MOUNTS.forEach(function(m){ mh+='<option value="'+m.id+'">'+esc(m.label)+'</option>'; }); $('o_mount').innerHTML=mh;
  var dl=''; C.SENSORS.concat(C.IMX_EXTRA).filter(function(s){return !s.swir}).forEach(function(s){ s.id.split(' / ').forEach(function(x){ dl+='<option value="'+esc(x)+'">'; }); }); $('o_imxList').innerHTML=dl;
  function lookupImx(){
    var q=$('o_imx').value.trim(), msg=$('o_imxMsg'); if(!q){ msg.textContent=''; return; }
    var s=C.findSensor(q);
    if(s){ $('o_sw').value=s.w; $('o_sh').value=s.h; $('o_p').value=s.p; var inList=C.SENSORS.filter(function(x){return x.id===s.id})[0]; selEl.value=inList?s.id:'custom'; msg.textContent=s.w+' × '+s.h+' · '+String(s.p).replace('.',',')+' µm · '+s.fmt+(inList?'':' (valeurs publiques usuelles, à confirmer sur la fiche)'); }
    else msg.textContent='Référence absente de la base : saisissez la taille en pixels et le pixel ci-dessous.';
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
    if(!ok){ last=null; out.innerHTML='<div class="card empty">Renseignez le capteur, le champ de vue, la distance de travail et le détail à voir.</div>'; return; }
    var R=C.adviseOptic(s), sp=R.spec, lt=R.lt, kind=lt.kind, st=R.status;
    var stTxt={ok:'capteur suffisant',limite:'capteur à la limite',insuffisant:'capteur insuffisant'}[st];
    var MT=R.mount, mc=MT.chosen;
    var flange=function(m){return m.flange!=null?', tirage '+String(parseFloat(m.flange.toFixed(3))).replace('.',',')+' mm':''};
    var lines=[
      ['Type', lt.label],
      ['Objectif', R.headline],
      ['Grandissement', n(R.m,4)+'×'+(kind==='telecentrique'?'':', focale calculée ≈ '+n(R.fNeed,1)+' mm')],
      ['Capteur', s.sw+' × '+s.sh+' px, pixel '+String(s.p).replace('.',',')+' µm ('+n(R.dims.D,1)+' mm de diagonale)'],
      ['Champ objet', n(s.fovH)+' × '+n(s.fovV)+' mm'],
      ['Distance trav.', n(s.wd)+' mm, variation de hauteur '+n(s.depth,1)+' mm'],
      [R.meas?'Mesure':'Détection', R.meas?'précision visée '+s.prec+' µm, interpolation 1/'+s.subdiv+' px':'défaut de '+s.defect+' µm sur '+s.k+' pixels'],
      ['Résolution', '≥ '+n(sp.nuK,0)+' lp/mm côté image'],
      ['Cercle d\'image', '≥ '+n(sp.circleMin,1)+' mm (≈ '+n(sp.inch,2)+'")'],
      ['Monture', mc?mc.label+' ('+mc.thread+flange(mc)+')':'non précisée, '+MT.recText],
      ['Ouverture', 'f/'+n(s.nom,1)+' à '+s.lambda+' nm']
    ];
    var text=lines.map(function(l){ var k=l[0]; while(k.length<16) k+=' '; return k+l[1]; }).join('\n');
    last={ inputs:snapshot(), spec:text, summary:{ type:lt.label, objectif:R.headline, grandissement:R.m, focale:kind==='telecentrique'?null:R.fNeed, resolution_lpmm:sp.nuK, cercle_mm:sp.circleMin, statut:st }, title:R.headline };

    var g=window.LumenGauge?window.LumenGauge(R.reqPix/R.pixObj/2, n(R.pixObj,1)+' µm', 'pixel objet · max '+n(R.reqPix,1), st, 'Pixel objet '+n(R.pixObj,1)+' µm pour un maximum de '+n(R.reqPix,1)+' µm'):'';
    var h='<section class="card verdict '+st+'"><div class="l">'+g+'<div><span class="eyebrow">Recommandation · '+stTxt+'</span>'
      +'<h1 style="margin-top:6px">'+esc(R.headline)+'</h1>'
      +'<p>'+(R.meas?'Pour une mesure à '+n(s.prec,1)+' µm':'Pour voir un défaut de '+n(s.defect)+' µm')+', le pixel objet doit rester sous '+n(R.reqPix,1)+' µm. Ici il vaut '+n(R.pixObj,1)+' µm.</p></div></div>'
      +'<div class="btns"><button type="button" class="btn" data-act="copy-opt">Copier la spécification</button><button type="button" class="btn pri" data-act="save-opt">Enregistrer le projet</button></div></section>';
    h+='<section class="card grid">'
      +'<div class="cell"><span class="cap">Grandissement</span><span class="v">'+n(R.m,4)+'×</span><span class="n">'+(kind==='telecentrique'?'objectif télécentrique':'focale calculée ≈ '+n(R.fNeed,1)+' mm')+'</span></div>'
      +'<div class="cell"><span class="cap">Pixel objet</span><span class="v">'+n(R.pixObj,1)+' µm</span><span class="n">maximum admis : '+n(R.reqPix,1)+' µm</span></div>'
      +'<div class="cell"><span class="cap">'+(R.meas?'Précision atteinte':'Défaut minimal vu')+'</span><span class="v">'+n(R.capab,1)+' µm</span><span class="n">'+pill(st,stTxt)+'</span></div>'
      +'<div class="cell"><span class="cap">Résolution objectif</span><span class="v">≥ '+n(sp.nuK,0)+' lp/mm</span><span class="n">cercle d\'image ≥ '+n(sp.circleMin,1)+' mm</span></div></section>';
    if(R.flags.length) h+=fl(R.flags);
    h+='<section class="card"><div class="ch"><b>Type d\'objectif : '+esc(lt.label.toLowerCase())+'</b><span>'+(R.meas?'Mesure':'Détection')+', '+n(s.fovH)+' × '+n(s.fovV)+' mm à '+n(s.wd)+' mm</span></div><div class="pad">'+fl(lt.reasons)
      +(lt.alt.length?'<p class="note">Alternative : '+lt.alt.map(function(k){return esc(C.KIND_LABEL[k])}).join(', ')+'.</p>':'')+'</div></section>';
    if(kind!=='telecentrique'){
      h+='<section class="card" style="overflow:hidden"><div class="ch"><b>Focales proches</b><span>Focale exacte ≈ '+n(R.fNeed,1)+' mm : garder la distance, ou garder le champ</span></div><div class="scroll"><table class="t cards"><thead><tr><th>Focale</th><th class="n">Champ à '+n(s.wd)+' mm</th><th class="n">Pixel objet</th><th class="n">Distance pour le champ exact</th><th class="n">Allonge</th><th>Verdict</th></tr></thead><tbody>';
      R.options.forEach(function(o){
        var isRec=R.rec&&o.f===R.rec.f, v;
        if(!o.covers) v=pill('limite','champ trop petit à cette distance'); else if(!o.okAtWD) v=pill('limite','résolution limite'); else v=pill('ok','convient');
        h+='<tr class="'+(isRec?'sel':'')+'"><td><span style="font-weight:500">'+o.f+' mm</span>'+(isRec?' '+pill('neutral','conseillée'):'')+'</td><td class="n num"><span class="lbl">Champ </span>'+n(o.fovHatWD,1)+' × '+n(o.fovVatWD,1)+' mm</td><td class="n num"><span class="lbl">Pixel objet </span>'+n(o.pixAtWD,1)+' µm</td><td class="n num"><span class="lbl">Distance </span>'+n(o.wdExact,0)+' mm ('+(o.wdDelta>=0?'+':'')+n(o.wdDelta,0)+')</td><td class="n num"><span class="lbl">Allonge </span>'+(o.tube>0.3?'≈ '+n(o.tube,1)+' mm':'non')+'</td><td>'+v+'</td></tr>';
      });
      h+='</tbody></table></div><p class="note pad" style="padding-top:0">Distance pour le champ exact = f × (1 + m) ÷ m. Allonge : au-delà du tirage propre de l\'objectif (mise au point minimale type, à confirmer sur la fiche).</p></section>';
    }
    h+='<section class="card"><div class="ch"><b>Monture'+(mc?' '+esc(mc.label):'')+'</b><span>'+(mc?esc(mc.thread)+esc(flange(mc)):'Conseil selon le capteur')+'</span></div><div class="pad">'+fl([{t:'info',m:MT.recText}].concat(MT.flags))
      +(mc?'':'<p class="note">Montures possibles : '+MT.rec.map(function(m){return esc(m.label)}).join(', ')+'. Choisissez-en une dans le formulaire pour la vérifier.</p>')+'</div></section>';
    h+='<section class="card"><div class="ch"><b>Doubleur, allonge et accessoires</b></div><div class="pad">'+fl(R.acc)+'</div></section>';
    h+='<section class="card" style="overflow:hidden"><div class="ch"><b>Résolution et ouverture</b><span>À donner au fabricant, sans préférence de marque</span></div><div class="spec">';
    h+='<div><span class="cap">Résolution de l\'objectif</span><span class="big">≥ '+n(sp.nuK,0)+' lp/mm</span><dl class="kv"><dt>Côté image</dt><dd>'+n(sp.nuK,0)+' lp/mm</dd><dt>Pixel effectif max.</dt><dd>'+n(sp.pitchEq,2)+' µm</dd><dt>Nyquist du capteur</dt><dd>'+n(sp.nuN,0)+' lp/mm</dd><dt>Côté objet</dt><dd>'+n(1000/(2*R.pixObj),1)+' lp/mm</dd></dl></div>';
    h+='<div><span class="cap">Format</span><span class="big">cercle ≥ '+n(sp.circleMin,1)+' mm</span><dl class="kv"><dt>Diagonale capteur</dt><dd>'+n(R.dims.D,1)+' mm</dd><dt>Équivalent optique</dt><dd>≈ '+n(sp.inch,2)+'"</dd><dt>Mégapixels</dt><dd>'+n(R.dims.mpx,1)+'</dd></dl></div>';
    h+='<div><span class="cap">Ouverture f/'+n(s.nom,1)+'</span><span class="big">f/'+n(sp.nEff,1)+' eff.</span><dl class="kv"><dt>Coupure à '+n(s.lambda)+' nm</dt><dd>'+n(sp.cutoff,0)+' lp/mm</dd><dt>Contraste au Nyquist</dt><dd>'+n(sp.mtfNyq*100,0)+' %</dd>'+(sp.dof?'<dt>Profondeur de champ</dt><dd>'+n(sp.dof.total,1)+' mm</dd>':'')+'</dl>'
      +(kind==='telecentrique'?fl([{t:'info',m:'La profondeur de champ d\'un télécentrique est fixée par sa conception, pas par le diaphragme : la lire sur la fiche et la comparer aux '+n(s.depth,1)+' mm. Ne pas dépasser f/'+n(sp.win.nMax,1)+' (diffraction).'}]):sp.win.nMin!=null&&s.depth>0?(sp.win.nMin>sp.win.nMax?fl([{t:'bad',m:'Pour tenir '+n(s.depth)+' mm il faut au moins f/'+n(sp.win.nMin,1)+', mais la diffraction limite à f/'+n(sp.win.nMax,1)+'. Réduire la variation de hauteur ou choisir un télécentrique.'}]):fl([{t:'good',m:'Plage d\'ouverture : f/'+n(Math.max(sp.win.nMin,1.4),1)+' à f/'+n(sp.win.nMax,1)+'.'}])):fl([{t:'good',m:'Ne pas dépasser f/'+n(sp.win.nMax,1)+' (diffraction).'}]))+'</div></div>';
    if(R.notes.length) h+='<div class="pad" style="padding-top:0">'+fl(R.notes.map(function(m){return {t:'info',m:m}}))+'</div>';
    h+='</section>';
    h+='<section class="card"><div class="ch"><b>Spécification à copier</b><button type="button" class="btn sm" data-act="copy-opt">Copier</button></div><pre class="spec-txt">'+esc(text)+'</pre></section>';
    h+='<section class="card pad"><details><summary>Détail des calculs</summary><div class="calc">'
      +'<div><span><b>Pixel objet maximal</b><br><code>'+(R.meas?'précision × interpolation':'défaut ÷ pixels')+'</code></span><span class="res">'+(R.meas?n(s.prec,1)+' × '+s.subdiv:n(s.defect,1)+' ÷ '+R.k)+' = '+n(R.reqPix,1)+' µm</span></div>'
      +'<div><span><b>Grandissement</b><br><code>m = min(L<sub>h</sub> ÷ FOV<sub>h</sub>, L<sub>v</sub> ÷ FOV<sub>v</sub>)</code></span><span class="res">'+n(R.m,4)+'×'+(R.ev.portrait?' (capteur tourné)':'')+'</span></div>'
      +'<div><span><b>Pixel objet atteint</b><br><code>p ÷ m</code></span><span class="res">'+n(s.p,2)+' ÷ '+n(R.m,4)+' = '+n(R.pixObj,1)+' µm</span></div>'
      +'<div><span><b>Focale</b><br><code>f = WD × m ÷ (1 + m)</code></span><span class="res">'+n(s.wd)+' × '+n(R.m,4)+' ÷ '+n(1+R.m,4)+' = '+n(R.fNeed,1)+' mm</span></div>'
      +'<div><span><b>Pixels requis</b><br><code>FOV ÷ pixel objet maximal</code></span><span class="res">'+n(R.need.nH)+' × '+n(R.need.nV)+' px ('+n(R.need.mpx,1)+' Mpx), disponibles '+n(R.have.nH)+' × '+n(R.have.nV)+'</span></div>'
      +'<div><span><b>Champ maximal avec ce capteur</b><br><code>N<sub>px</sub> × pixel objet maximal</code></span><span class="res">'+n(R.fovMax.H,0)+' × '+n(R.fovMax.V,0)+' mm</span></div>'
      +'<div><span><b>Distorsion estimée</b><br><code>'+n(R.distPct,1)+' % × FOV ÷ 2</code></span><span class="res">'+n(R.distErr,0)+' µm en bord de champ (valeur type, à confirmer)</span></div>'
      +'<div><span><b>Erreur de perspective</b><br><code>Δ = FOV × Δz ÷ WD</code></span><span class="res">'+n(lt.perr||0,2)+' mm</span></div>'
      +'</div><p class="note">Approximation lentille mince. La distorsion, la mise au point minimale et les focales de série sont des valeurs de travail : la fiche de l\'objectif fait foi.</p></details></section>';
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
  window.LumenOptique = { state:function(){return last}, load:function(o){ apply(o); clearPreset(); animNext=true; render(); }, animate:function(){ animNext=true; render(); } };
  fromSel(); render();
})();
