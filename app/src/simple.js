(function(){
  var C=OptiCalc, $=function(i){return document.getElementById(i)};
  function n(x,d){ if(x==null||!isFinite(x)) return '∞'; return x.toLocaleString('fr-FR',{minimumFractionDigits:d||0,maximumFractionDigits:d||0}); }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function num(i){return parseFloat($(i).value)}
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
    if(s){ $('o_sw').value=s.w; $('o_sh').value=s.h; $('o_p').value=s.p; var inList=C.SENSORS.filter(function(x){return x.id===s.id})[0]; selEl.value=inList?s.id:'custom'; msg.textContent='Trouvé : '+s.w+' × '+s.h+' px, pixel '+s.p+' µm, '+s.fmt+(inList?'':' (valeurs publiques usuelles, à confirmer sur la fiche)'); }
    else msg.textContent='Référence absente de la base : saisissez ci-dessous la taille en pixels et le pixel. Le conseil de monture reste disponible.';
  }
  function fromSel(){ var s=C.SENSORS.filter(function(x){return x.id===selEl.value})[0]; if(s){ $('o_sw').value=s.w; $('o_sh').value=s.h; $('o_p').value=s.p; } }
  var lastText='';
  function chip(c,t){return '<span class="chip '+c+'">'+t+'</span>'}
  function fl(a){return '<ul class="flags">'+a.map(function(f){return '<li class="'+(f.t==='good'?'good':f.t)+'">'+(f.n?'<b>'+esc(f.n)+'.</b> ':'')+esc(f.m)+'</li>'}).join('')+'</ul>'}
  function render(){
    var meas=$('o_task').value==='mesure';
    $('o_detW').classList.toggle('hidden',meas); $('o_mesW').classList.toggle('hidden',!meas);
    var s={sw:num('o_sw'),sh:num('o_sh'),p:num('o_p'),wd:num('o_wd'),fovH:num('o_fovH'),fovV:num('o_fovV'),depth:num('o_depth')||0,mount:$('o_mount').value,task:$('o_task').value,
      defect:num('o_defect'),k:num('o_k'),prec:num('o_prec'),subdiv:num('o_sub'),nom:num('o_nom'),lambda:num('o_lam')||550,cocPx:num('o_coc'),backlight:$('o_back').checked};
    var out=$('oOut');
    var ok=s.sw>0&&s.sh>0&&s.p>0&&s.wd>0&&s.fovH>0&&s.fovV>0&&(meas?s.prec>0:s.defect>0);
    if(!ok){ out.innerHTML='<div class="card empty">Renseignez le capteur, le champ de vue, la distance de travail et le détail à voir.</div>'; return; }
    var R=C.adviseOptic(s), sp=R.spec, lt=R.lt, kind=lt.kind, st=R.status;
    var stTxt={ok:'Capteur suffisant',limite:'Capteur à la limite',insuffisant:'Capteur insuffisant'}[st];
    var h='<section class="card summary">'
      +'<div><div class="k">Objectif conseillé</div><div class="v" style="font-size:18px">'+esc(R.headline)+'</div><div class="s">'+esc(lt.label)+'</div></div>'
      +'<div><div class="k">Grandissement</div><div class="v">'+n(R.m,4)+'×</div><div class="s">focale calculée ≈ '+(kind==='telecentrique'?'sans objet':n(R.fNeed,1)+' mm')+'</div></div>'
      +'<div><div class="k">Pixel côté objet</div><div class="v">'+n(R.pixObj,1)+' µm</div><div class="s">maximum admis : '+n(R.reqPix,1)+' µm</div></div>'
      +'<div><div class="k">'+(R.meas?'Précision atteinte':'Défaut minimal vu')+'</div><div class="v">'+n(R.capab,1)+' µm</div><div class="s">'+chip(st==='ok'?'ok':st,stTxt)+'</div></div></section>';
    h+=fl(R.flags.map(function(f){return f}));
    // type
    h+='<section class="card"><div class="sec-head"><h2>Type d\'objectif : '+esc(lt.label.toLowerCase())+'</h2><p>'+(R.meas?'Mesure':'Détection')+', '+n(s.fovH)+' × '+n(s.fovV)+' mm à '+n(s.wd)+' mm</p></div>'+fl(lt.reasons)
      +(lt.alt.length?'<p class="note">Alternative : '+lt.alt.map(function(k){return esc(C.KIND_LABEL[k])}).join(', ')+'.</p>':'')+'</section>';
    // focales
    if(kind!=='telecentrique'){
      h+='<section class="card"><div class="sec-head"><h2>Focales proches</h2><p>Focale exacte ≈ '+n(R.fNeed,1)+' mm. Deux façons de caler : garder la distance, ou garder le champ.</p></div><div class="scroll"><table><thead><tr><th>Focale</th><th class="n">Champ à '+n(s.wd)+' mm</th><th class="n">Pixel objet</th><th class="n">Distance pour le champ exact</th><th class="n">Allonge</th><th>Verdict</th></tr></thead><tbody>';
      R.options.forEach(function(o){
        var isRec=R.rec&&o.f===R.rec.f, v;
        if(!o.covers) v=chip('limite','Champ trop petit à cette distance'); else if(!o.okAtWD) v=chip('limite','Résolution limite'); else v=chip('ok','Convient à la distance demandée');
        h+='<tr class="'+(isRec?'sel':'')+'"><td><b>'+o.f+' mm</b>'+(isRec?' <span class="chip neutral">conseillée</span>':'')+'</td><td class="n num">'+n(o.fovHatWD,1)+' × '+n(o.fovVatWD,1)+' mm</td><td class="n num">'+n(o.pixAtWD,1)+' µm</td><td class="n num">'+n(o.wdExact,0)+' mm ('+(o.wdDelta>=0?'+':'')+n(o.wdDelta,0)+')</td><td class="n num">'+(o.tube>0.3?'≈ '+n(o.tube,1)+' mm':'non')+'</td><td>'+v+'</td></tr>';
      });
      h+='</tbody></table></div><p class="note">Distance pour le champ exact = f × (1 + m) ÷ m. Allonge : au-delà du tirage propre de l\'objectif (mise au point minimale type, à confirmer sur la fiche).</p></section>';
    }
    h+='<section class="card"><div class="sec-head"><h2>Doubleur, allonge et accessoires</h2></div>'+fl(R.acc)+'</section>';
    // monture
    var MT=R.mount, mc=MT.chosen;
    h+='<section class="card"><div class="sec-head"><h2>Monture'+(mc?' : '+esc(mc.label):'')+'</h2><p>'+(mc?esc(mc.thread)+(mc.flange!=null?', tirage '+String(parseFloat(mc.flange.toFixed(3))).replace('.',',')+' mm':''):'Conseil selon le capteur')+'</p></div>';
    h+=fl([{t:'info',m:MT.recText}].concat(MT.flags));
    if(!mc) h+='<p class="note">Montures possibles : '+MT.rec.map(function(m){return esc(m.label)}).join(', ')+'. Choisissez-en une dans « Monture (option) » pour la vérifier.</p>';
    h+='</section>';
    // résolution
    h+='<section class="card"><div class="sec-head"><h2>Résolution et ouverture</h2><p>À donner au fabricant d\'objectif, sans préférence de marque</p></div><div class="spec">';
    h+='<div><div class="k">Résolution de l\'objectif</div><div class="big">≥ '+n(sp.nuK,0)+' lp/mm</div><dl><dt>Côté image</dt><dd>'+n(sp.nuK,0)+' lp/mm</dd><dt>Pixel effectif maximal</dt><dd>'+n(sp.pitchEq,2)+' µm</dd><dt>Nyquist du capteur</dt><dd>'+n(sp.nuN,0)+' lp/mm</dd><dt>Côté objet</dt><dd>'+n(1000/(2*R.pixObj),1)+' lp/mm</dd></dl></div>';
    h+='<div><div class="k">Format</div><div class="big">cercle ≥ '+n(sp.circleMin,1)+' mm</div><dl><dt>Diagonale capteur</dt><dd>'+n(R.dims.D,1)+' mm</dd><dt>Équivalent optique</dt><dd>≈ '+n(sp.inch,2)+'"</dd><dt>Mégapixels</dt><dd>'+n(R.dims.mpx,1)+'</dd></dl></div>';
    h+='<div><div class="k">Ouverture f/'+n(s.nom,1)+'</div><div class="big">f/'+n(sp.nEff,1)+' eff.</div><dl><dt>Coupure à '+n(s.lambda)+' nm</dt><dd>'+n(sp.cutoff,0)+' lp/mm</dd><dt>Contraste au Nyquist</dt><dd>'+n(sp.mtfNyq*100,0)+' %</dd>'+(sp.dof?'<dt>Profondeur de champ</dt><dd>'+n(sp.dof.total,1)+' mm</dd>':'')+'</dl>'
      +(kind==='telecentrique'?fl([{t:'info',m:'La profondeur de champ d\'un télécentrique est fixée par sa conception, pas par le diaphragme : la lire sur la fiche et la comparer aux '+n(s.depth,1)+' mm. Ne pas dépasser f/'+n(sp.win.nMax,1)+' (diffraction).'}]):sp.win.nMin!=null&&s.depth>0?(sp.win.nMin>sp.win.nMax?fl([{t:'bad',m:'Pour tenir '+n(s.depth)+' mm il faut au moins f/'+n(sp.win.nMin,1)+', mais la diffraction limite à f/'+n(sp.win.nMax,1)+'. Réduire la variation de hauteur ou choisir un télécentrique.'}]):fl([{t:'good',m:'Plage d\'ouverture : f/'+n(Math.max(sp.win.nMin,1.4),1)+' à f/'+n(sp.win.nMax,1)+'.'}])):fl([{t:'good',m:'Ne pas dépasser f/'+n(sp.win.nMax,1)+' (diffraction).'}]))+'</div></div>';
    h+=fl(R.notes.map(function(m){return {t:'info',m:m}}))+'</section>';
    // résumé copiable
    var lines=['Capteur : '+s.sw+' × '+s.sh+' px, pixel '+s.p+' µm ('+n(R.dims.D,1)+' mm de diagonale)',
      'Scène : champ '+s.fovH+' × '+s.fovV+' mm, distance de travail '+s.wd+' mm, variation de hauteur '+s.depth+' mm',
      (R.meas?'Mesure : précision visée '+s.prec+' µm, interpolation 1/'+s.subdiv+' pixel':'Détection : défaut de '+s.defect+' µm sur '+s.k+' pixels'),
      'Objectif : '+R.headline,
      'Grandissement : '+n(R.m,4)+'×, focale calculée '+(kind==='telecentrique'?'sans objet':n(R.fNeed,1)+' mm'),
      'Résolution objectif : ≥ '+n(sp.nuK,0)+' lp/mm côté image, cercle d\'image ≥ '+n(sp.circleMin,1)+' mm',
      'Monture : '+(mc?mc.label+' ('+mc.thread+(mc.flange!=null?', tirage '+String(parseFloat(mc.flange.toFixed(3))).replace('.',',')+' mm':'')+')':'non précisée, '+MT.recText),
      'Ouverture de travail : f/'+n(s.nom,1)+' à '+s.lambda+' nm'];
    lastText=lines.join('\n');
    h+='<section class="card"><div class="sec-head"><h2>Cahier des charges de l\'objectif</h2><p>À envoyer à un fabricant ou à votre bureau d\'études</p></div><pre style="margin:0;white-space:pre-wrap;font:12px/1.5 var(--font-num);overflow-wrap:anywhere">'+esc(lastText)+'</pre><div class="btns" style="margin-top:10px"><button type="button" class="btn" id="oCopy">Copier le texte</button><span class="unit" id="oCopyMsg"></span></div></section>';
    // détail
    h+='<section class="card"><details><summary>Détail des calculs</summary><div class="calc">'
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
  }
  document.addEventListener('input',function(e){
    var t=e.target; if(!t.closest||!t.closest('#oForm')) return;
    if(t.id==='o_imx') lookupImx(); else if(t.id==='o_sensor'){ fromSel(); $('o_imx').value=''; $('o_imxMsg').textContent=''; } else if(t.id==='o_sw'||t.id==='o_sh'||t.id==='o_p') selEl.value='custom';
    render();
  });
  document.addEventListener('click',function(e){
    var p=e.target.closest&&e.target.closest('[data-o]');
    if(p){ var d=PRE[p.dataset.o]; Object.keys(d).forEach(function(k){var el=$(k); if(!el) return; if(el.type==='checkbox') el.checked=d[k]; else el.value=d[k];}); fromSel(); render(); return; }
    if(e.target.id==='oCopy'){
      var done=function(m){$('oCopyMsg').textContent=m};
      try{ navigator.clipboard.writeText(lastText).then(function(){done('Texte copié.')},function(){done('Copie refusée : sélectionnez le texte ci-dessus.')}); }catch(x){ done('Copie refusée : sélectionnez le texte ci-dessus.'); }
    }
  });
  fromSel(); render();
})();
