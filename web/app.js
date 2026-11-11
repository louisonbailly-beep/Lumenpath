/* Lumenpath : navigation, comptes (Supabase Auth), projets, accords, administration.
   Règles : aucun mot de passe envoyé par e-mail (lien de vérification puis choix du mot de passe),
   admin protégé par double authentification (TOTP), actions sensibles journalisées. */
(function(){
  var $=function(i){return document.getElementById(i)};
  var DEMO=!!window.LUMENPATH_DEMO;
  var CFG=window.LUMENPATH_SUPABASE||{};
  var BASE=location.origin+location.pathname;
  var sb=null, session=null, profile=null, recovery=false, admFactor=null, linkError='';
  var PROTECTED={calculateur:1,optique:1,compte:1};

  /* ---------- Utilitaires ---------- */
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  var toastT;
  function toast(m){ var t=$('toast'); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){t.hidden=true},3500); }
  function busy(form,on){ [].forEach.call(form.querySelectorAll('button[type=submit]'),function(b){b.disabled=on}); }
  function fr(err){
    var m=(err&&(err.message||err.error_description))||String(err||'');
    var map=[
      [/invalid login credentials/i,'Adresse ou mot de passe incorrect.'],
      [/email not confirmed/i,'Adresse pas encore confirmée : ouvrez le lien reçu par e-mail.'],
      [/rate limit|too many|security purposes/i,'Trop de demandes en peu de temps. Réessayez dans quelques minutes.'],
      [/password should be|weak password|at least/i,'Mot de passe trop faible : 12 caractères minimum, mélangez lettres, chiffres et symboles.'],
      [/same password|different from the old/i,'Choisissez un mot de passe différent de l\'ancien.'],
      [/invalid totp|invalid code|expired/i,'Code incorrect ou expiré. Saisissez le code affiché maintenant dans l\'application.'],
      [/signups not allowed|not allowed for otp/i,'Les inscriptions sont fermées pour le moment.'],
      [/failed to fetch|network/i,'Connexion au serveur impossible. Vérifiez votre réseau.'],
      [/error sending/i,'L\'e-mail n\'a pas pu être envoyé. Réessayez plus tard ou contactez l\'administrateur.'],
      [/not authorized|not allowed to send/i,'Cette adresse ne peut pas encore recevoir nos e-mails : l\'envoi est en cours de configuration. Contactez l\'administrateur.'],
      [/email address .* is invalid|invalid email|unable to validate email/i,'Adresse e-mail refusée. Vérifiez-la, ou utilisez votre adresse professionnelle.'],
      [/user already registered|already been registered/i,'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».'],
      [/otp_expired|link is invalid|has expired/i,'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.']
    ];
    for(var i=0;i<map.length;i++) if(map[i][0].test(m)) return map[i][1];
    return m||'Une erreur est survenue.';
  }
  function log(action, detail){ if(sb&&session) sb.rpc('log_action',{p_action:action,p_detail:detail||null}).then(function(){},function(){}); }
  function pwSet(){ var u=session&&session.user; return !!(u&&u.user_metadata&&u.user_metadata.pw_set); }
  function isAdmin(){ return profile&&profile.role==='admin'; }
  function date(d){ try{ return new Date(d).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}); }catch(e){ return d; } }

  /* stockage de session : appareil (localStorage) ou onglet seulement (sessionStorage) */
  function remember(){ try{ return localStorage.getItem('lp_remember')!=='0'; }catch(e){ return true; } }
  var storage={
    getItem:function(k){ try{ return localStorage.getItem(k)||sessionStorage.getItem(k); }catch(e){ return null; } },
    setItem:function(k,v){ try{ if(remember()){ localStorage.setItem(k,v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k,v); localStorage.removeItem(k); } }catch(e){} },
    removeItem:function(k){ try{ localStorage.removeItem(k); sessionStorage.removeItem(k); }catch(e){} }
  };

  /* ---------- Navigation ---------- */
  function route(){
    var h=location.hash.replace(/^#\/?/,'');
    if(/access_token=|error=|type=/.test(h)) h='';
    var view='home', tab=null;
    if(h==='connexion') view='login';
    else if(h==='mot-de-passe-oublie') view='forgot';
    else if(h==='inscription') view='signup';
    else if(h==='mot-de-passe') view='password';
    else if(h==='admin') view='admin-login';
    else if(h==='admin/tableau') view='admin';
    else if(PROTECTED[h]){ view='app'; tab=h; }

    if(DEMO){
      if(view==='login'||view==='signup'||view==='forgot'||view==='password'){ toast('Démonstration : l\'inscription fonctionne sur le site en ligne.'); return go('calculateur'); }
      if(view==='admin-login') return go('admin/tableau');
      if(tab==='compte') return go('calculateur');
    } else {
      var ok=session&&pwSet();
      if((view==='app'||view==='admin')&&!session) return go('connexion');
      if((view==='app'||view==='admin')&&session&&!pwSet()) return go('mot-de-passe');
      if(view==='admin'&&!(isAdmin()&&session.aal2)) return go('admin');
      if(view==='password'&&!session) return go('connexion');
      if(view==='password'&&ok&&!recovery) return go('calculateur');
      if((view==='login'||view==='signup')&&ok) return go('calculateur');
    }
    show(view, tab);
  }
  function go(h){ if(location.hash==='#/'+h) route(); else location.hash='#/'+h; }
  function show(view, tab){
    [].forEach.call(document.querySelectorAll('[data-view]'),function(el){ el.hidden=el.dataset.view!==view; });
    if(view==='app'){
      [].forEach.call(document.querySelectorAll('[data-tab-view]'),function(el){ el.hidden=el.dataset.tabView!==tab; });
      [].forEach.call(document.querySelectorAll('[data-tab]'),function(el){ el.classList.toggle('on',el.dataset.tab===tab); });
      if(tab==='compte') loadAccount();
      if(tab==='calculateur'&&window.LumenAnimate) window.LumenAnimate();
      if(tab==='optique'&&window.LumenOptique&&window.LumenOptique.animate) window.LumenOptique.animate();
    }
    if(view==='admin') loadAdmin();
    if(view==='password'){ $('pwMail').textContent=session&&session.user.email||''; $('pwCap').textContent=recovery?'Nouveau mot de passe':'Étape 3 sur 3 · Mot de passe'; }
    if(view==='login'){ $('loginMsg').textContent=linkError; $('loginMsg').className='msg'+(linkError?' bad':''); linkError=''; }
    if(view==='admin-login') resetAdminForm();
    document.title = {home:'Lumenpath',login:'Connexion · Lumenpath',signup:'Créer un accès · Lumenpath',forgot:'Mot de passe oublié · Lumenpath',password:'Mot de passe · Lumenpath','admin-login':'Administration · Lumenpath',admin:'Administration · Lumenpath'}[view] || ({calculateur:'Calculateur complet',optique:'Optique conseillée',compte:'Mon compte'}[tab]+' · Lumenpath');
    adminTimer(view==='admin');
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',route);
  document.addEventListener('click',function(e){
    if(!e.target.closest) return;
    var s=e.target.closest('[data-scroll]'); if(s){ e.preventDefault(); var t=$(s.dataset.scroll); if(t) t.scrollIntoView({behavior:'smooth'}); return; }
    if(e.target.closest('[data-logout]')){ logout(); return; }
    var a=e.target.closest('[data-act]'); if(a) act(a.dataset.act);
  });

  function setWho(){
    var w=$('whoTxt');
    if(DEMO){ w.textContent='Visiteur démo'; return; }
    var p=profile||{}; w.textContent=((p.prenom||'')+' '+(p.nom||'')).trim()+(p.societe?' · '+p.societe:'');
    if(!w.textContent) w.textContent=session&&session.user.email||'';
  }
  function loadProfile(){
    if(!session){ profile=null; return Promise.resolve(); }
    return sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(function(r){ profile=r.data||null; setWho(); });
  }
  function refreshSession(s){
    session=s||null;
    if(session){ var aal=null; try{ aal=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).aal; }catch(e){} session.aal2=aal==='aal2'; }
    return loadProfile();
  }
  function logout(){
    if(DEMO){ go(''); return; }
    log('deconnexion');
    sb.auth.signOut().then(function(){ session=null; profile=null; recovery=false; go('connexion'); });
  }

  /* ---------- Copier, enregistrer ---------- */
  function copy(text){
    var done=function(){ toast('Spécification copiée.'); }, fail=function(){ toast('Copie refusée par le navigateur : sélectionnez le texte.'); };
    try{ navigator.clipboard.writeText(text).then(done,fail); }catch(e){ fail(); }
  }
  function act(a){
    var calc=a.indexOf('calc')>0, st=calc?window.LumenCalc.state():window.LumenOptique.state();
    if(!st) return;
    if(a.indexOf('copy')===0) return copy(st.spec);
    if(DEMO) return toast('Démonstration : l\'enregistrement des projets fonctionne sur le site en ligne.');
    var name=window.prompt('Nom du projet', st.title||'Projet');
    if(name===null) return;
    sb.from('projects').insert({ tool:calc?'calculateur':'optique', name:name.trim()||st.title, inputs:st.inputs, results:{ summary:st.summary, spec:st.spec } })
      .then(function(r){ if(r.error) return toast(fr(r.error)); log('projet_enregistre',{tool:calc?'calculateur':'optique'}); toast('Projet enregistré. Retrouvez-le dans « Mon compte ».'); });
  }

  /* ---------- Connexion ---------- */
  $('loginForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this, em=$('l_email').value.trim(), pw=$('l_pw').value; $('l_err').textContent='';
    if(!em||!pw){ $('l_err').textContent='Saisissez votre adresse et votre mot de passe.'; return; }
    try{ localStorage.setItem('lp_remember',$('l_remember').checked?'1':'0'); }catch(x){}
    busy(f,true);
    sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
      busy(f,false);
      if(r.error){ $('l_err').textContent=fr(r.error); return; }
      $('l_pw').value='';
      var p=pwSet()?Promise.resolve():sb.auth.updateUser({data:{pw_set:true}});
      return Promise.resolve(p).then(function(){ return sb.auth.getSession(); }).then(function(s){ return refreshSession(s.data.session); }).then(function(){ log('connexion'); go('calculateur'); });
    });
  });

  /* ---------- Mot de passe oublié ---------- */
  $('forgotForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this, em=$('fg_email').value.trim(); $('fg_err').textContent=''; $('fg_ok').textContent='';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){ $('fg_err').textContent='Saisissez une adresse e-mail valide.'; return; }
    busy(f,true);
    sb.auth.resetPasswordForEmail(em,{redirectTo:BASE}).then(function(r){
      busy(f,false);
      if(r.error){ $('fg_err').textContent=fr(r.error); return; }
      $('fg_ok').textContent='Si un compte existe pour cette adresse, un lien vient d\'être envoyé. Il est à usage unique.';
    });
  });

  /* ---------- Inscription ---------- */
  var regData=null;
  function rv(id){ return $(id).value.trim(); }
  function rerr(id,m){ $('e_'+id).textContent=m||''; return !m; }
  function regStep(n){
    $('regStep1').hidden=n!==1; $('regStep2').hidden=n!==2;
    [].forEach.call($('regTl').children,function(li,i){ li.className=i+1===n?'on':(i+1<n?'done':''); });
  }
  function sendLink(){
    return sb.auth.signInWithOtp({ email:regData.email, options:{ shouldCreateUser:true, emailRedirectTo:BASE,
      data:{ prenom:regData.prenom, nom:regData.nom, societe:regData.societe, departement:regData.dept, telephone:regData.tel } } });
  }
  $('regForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this, ok=true;
    ok=rerr('prenom',rv('r_prenom')?'':'Renseignez votre prénom.')&&ok;
    ok=rerr('nom',rv('r_nom')?'':'Renseignez votre nom.')&&ok;
    ok=rerr('societe',rv('r_societe')?'':'Renseignez le nom de la société.')&&ok;
    ok=rerr('dept',$('r_dept').value?'':'Choisissez votre département.')&&ok;
    ok=rerr('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rv('r_email'))?'':'Saisissez une adresse e-mail valide, par exemple prenom.nom@societe.com.')&&ok;
    var tel=rv('r_tel'); ok=rerr('tel',!tel||/^\+?[0-9 ().-]{7,20}$/.test(tel)?'':'Numéro non reconnu : chiffres, espaces et un + éventuel.')&&ok;
    ok=rerr('cgu',$('r_cgu').checked?'':'Cochez la case pour continuer.')&&ok;
    rerr('reg','');
    if(!ok) return;
    regData={prenom:rv('r_prenom'),nom:rv('r_nom'),societe:rv('r_societe'),dept:$('r_dept').value,email:rv('r_email').toLowerCase(),tel:tel};
    busy(f,true);
    sendLink().then(function(r){
      busy(f,false);
      if(r.error){ rerr('reg',fr(r.error)); return; }
      $('regSentTo').textContent=regData.email; $('regResendMsg').textContent=''; regStep(2);
    });
  });
  $('regBack').addEventListener('click',function(){ regStep(1); });
  $('regResend').addEventListener('click',function(){
    var b=this; b.disabled=true;
    sendLink().then(function(r){ b.disabled=false; $('regResendMsg').textContent=r.error?fr(r.error):'Nouveau lien envoyé. Le précédent ne fonctionne plus.'; });
  });

  /* ---------- Choix du mot de passe ---------- */
  function score(p){ var s=0; if(p.length>=12)s++; if(p.length>=16)s++; if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++; if(/\d/.test(p)&&/[^A-Za-z0-9]/.test(p))s++; return p.length<12?Math.min(s,1):s; }
  $('pw1').addEventListener('input',function(){
    var s=score(this.value);
    [].forEach.call(document.querySelectorAll('.meter i'),function(b,i){ b.className=i<s?'on'+s:''; });
    $('pwHint').textContent=!this.value?'Mélangez majuscules, minuscules, chiffres et symboles, ou choisissez une longue phrase.':(s<=1?'Trop court ou trop simple.':s===2?'Correct. Ajoutez de la longueur pour plus de sécurité.':'Bon niveau.');
  });
  $('pwForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this, a=$('pw1').value, b=$('pw2').value, ok=true;
    $('e_pw1').textContent=a.length<12?'12 caractères minimum.':''; if(a.length<12) ok=false;
    $('e_pw2').textContent=a!==b?'Les deux mots de passe sont différents.':''; if(a!==b) ok=false;
    $('e_pw').textContent='';
    if(!ok) return;
    busy(f,true);
    sb.auth.updateUser({password:a,data:{pw_set:true}}).then(function(r){
      busy(f,false);
      if(r.error){ $('e_pw').textContent=fr(r.error); return; }
      $('pw1').value=''; $('pw2').value='';
      var was=recovery; recovery=false;
      return sb.auth.getSession().then(function(s){ return refreshSession(s.data.session); }).then(function(){
        log(was?'mot_de_passe_reinitialise':'compte_active'); toast(was?'Mot de passe modifié.':'Votre accès est activé.'); go('calculateur');
      });
    });
  });

  /* ---------- Administration : connexion avec double authentification ---------- */
  var admStage='creds';
  function resetAdminForm(){
    var signedAdmin=session&&isAdmin()&&pwSet();
    admStage=signedAdmin?'mfa':'creds';
    $('a_err').textContent='';
    if(signedAdmin) prepareMfa(); else { $('admCreds').hidden=false; $('admEnroll').hidden=true; $('admCodeW').hidden=true; $('admBtn').textContent='Se connecter'; }
  }
  function prepareMfa(){
    $('admCreds').hidden=true; $('admCodeW').hidden=false; $('admBtn').textContent='Valider le code';
    return sb.auth.mfa.listFactors().then(function(r){
      if(r.error){ $('a_err').textContent=fr(r.error); return; }
      var verified=(r.data.totp||[]).filter(function(f){return f.status==='verified'})[0];
      if(verified){ admFactor=verified.id; $('admEnroll').hidden=true; setTimeout(function(){$('a_code').focus()},0); return; }
      var stale=(r.data.all||[]).filter(function(f){return f.status!=='verified'});
      return Promise.all(stale.map(function(f){ return sb.auth.mfa.unenroll({factorId:f.id}); })).then(function(){
        return sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Lumenpath admin'});
      }).then(function(en){
        if(en.error){ $('a_err').textContent=fr(en.error); return; }
        admFactor=en.data.id; $('admQr').src=en.data.totp.qr_code; $('admSecret').textContent=en.data.totp.secret; $('admEnroll').hidden=false;
      });
    });
  }
  $('admForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this; $('a_err').textContent='';
    if(admStage==='creds'){
      var em=$('a_email').value.trim(), pw=$('a_pw').value;
      if(!em||!pw){ $('a_err').textContent='Saisissez l\'adresse et le mot de passe.'; return; }
      try{ localStorage.setItem('lp_remember','0'); }catch(x){}
      busy(f,true);
      sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
        if(r.error){ busy(f,false); $('a_err').textContent=fr(r.error); return; }
        $('a_pw').value='';
        return (pwSet()?Promise.resolve():sb.auth.updateUser({data:{pw_set:true}})).then(function(){ return sb.auth.getSession(); }).then(function(s){ return refreshSession(s.data.session); }).then(function(){
          busy(f,false);
          if(!isAdmin()){ log('connexion_admin_refusee'); return sb.auth.signOut().then(function(){ session=null; profile=null; $('a_err').textContent='Ce compte n\'a pas les droits d\'administration.'; }); }
          admStage='mfa'; return prepareMfa();
        });
      });
    } else {
      var code=$('a_code').value.replace(/\s/g,'');
      if(!/^\d{6}$/.test(code)){ $('a_err').textContent='Saisissez les 6 chiffres affichés dans l\'application.'; return; }
      busy(f,true);
      sb.auth.mfa.challengeAndVerify({factorId:admFactor,code:code}).then(function(r){
        busy(f,false);
        if(r.error){ $('a_err').textContent=fr(r.error); return; }
        $('a_code').value='';
        return sb.auth.getSession().then(function(s){ return refreshSession(s.data.session); }).then(function(){ log('connexion_admin'); go('admin/tableau'); });
      });
    }
  });
  /* déconnexion après 30 minutes d'inactivité en administration */
  var admT=null, admOn=false;
  function admBump(){ if(!admOn) return; clearTimeout(admT); admT=setTimeout(function(){ toast('Session administrateur fermée après 30 minutes d\'inactivité.'); log('deconnexion_inactivite'); sb.auth.signOut().then(function(){ session=null; profile=null; go('admin'); }); }, 30*60*1000); }
  function adminTimer(on){ admOn=on; if(on) admBump(); else clearTimeout(admT); }
  ['click','keydown','scroll','pointermove'].forEach(function(ev){ document.addEventListener(ev,admBump,{passive:true}); });

  /* ---------- Tableau de bord admin ---------- */
  var admUsers=[], admCons={};
  /* Démonstration : tableau de bord rempli d'exemples fictifs, sans base de données */
  function loadAdminDemo(){
    $('admWho').textContent='Aperçu (démonstration)';
    var now=Date.now(), d=function(h){ return new Date(now-h*3600e3).toISOString(); };
    admUsers=[
      {id:'d1',prenom:'Camille',nom:'Exemple',societe:'Société A',departement:'Qualité',role:'admin',created_at:d(400)},
      {id:'d2',prenom:'Julien',nom:'Exemple',societe:'Société B',departement:'Bureau d\'études',role:'editeur_catalogue',created_at:d(120)},
      {id:'d3',prenom:'Sarah',nom:'Exemple',societe:'Société C',departement:'Intégration, projets',role:'utilisateur',created_at:d(30)},
      {id:'d4',prenom:'Marc',nom:'Exemple',societe:'Société D',departement:'Production',role:'utilisateur',created_at:d(5)}
    ];
    admCons={d2:['ia','bureau_etudes'],d3:['ia']};
    $('stUsers').textContent='4'; $('stAdmins').textContent='2'; $('stIa').textContent='2'; $('stBe').textContent='1';
    var A=[[0.2,'connexion admin','Camille Exemple'],[3,'projet enregistré','Sarah Exemple'],[5,'compte activé','Marc Exemple'],[26,'accord donné','Julien Exemple']];
    $('admAudit').innerHTML=A.map(function(a){ return '<li>'+esc(date(d(a[0])))+' · '+a[1]+' · '+a[2]+'</li>'; }).join('');
    renderUsers();
  }
  function loadAdmin(){
    if(DEMO) return loadAdminDemo();
    var p=profile||{}; $('admWho').textContent=((p.prenom||'')+' '+(p.nom||'')).trim()||'Administrateur';
    Promise.all([
      sb.from('profiles').select('*').order('created_at',{ascending:false}),
      sb.from('consents').select('*'),
      sb.from('audit_log').select('*').order('at',{ascending:false}).limit(12)
    ]).then(function(r){
      var err=r[0].error||r[1].error||r[2].error; if(err){ toast(fr(err)); }
      admUsers=r[0].data||[]; admCons={};
      (r[1].data||[]).forEach(function(c){ if(c.granted){ (admCons[c.user_id]=admCons[c.user_id]||[]).push(c.kind); } });
      $('stUsers').textContent=admUsers.length;
      $('stAdmins').textContent=admUsers.filter(function(u){return u.role!=='utilisateur'}).length;
      $('stIa').textContent=(r[1].data||[]).filter(function(c){return c.granted&&c.kind==='ia'}).length;
      $('stBe').textContent=(r[1].data||[]).filter(function(c){return c.granted&&c.kind==='bureau_etudes'}).length;
      var names={}; admUsers.forEach(function(u){ names[u.id]=((u.prenom||'')+' '+(u.nom||'')).trim(); });
      var au=r[2].data||[];
      $('admAudit').innerHTML=au.length?au.map(function(a){ return '<li>'+esc(date(a.at))+' · '+esc(a.action.replace(/_/g,' '))+' · '+esc(names[a.actor]||'—')+(a.ip?' · '+esc(a.ip):'')+'</li>'; }).join(''):'<li>Aucune entrée pour l\'instant.</li>';
      renderUsers();
    });
  }
  var ROLE={utilisateur:['utilisateur',''],editeur_catalogue:['éditeur catalogue','neutral'],admin:['administrateur','ok']};
  function renderUsers(){
    var q=$('admQ').value.trim().toLowerCase();
    var rows=admUsers.filter(function(u){ return !q||[u.prenom,u.nom,u.societe,u.departement,u.telephone].join(' ').toLowerCase().indexOf(q)>=0; });
    $('admRows').innerHTML=rows.length?rows.map(function(u){
      var r=ROLE[u.role]||[u.role,''], c=(admCons[u.id]||[]).map(function(k){return k==='ia'?'IA':'mise en relation'}).join(' · ')||'aucun';
      return '<tr><td><div style="font-weight:500">'+esc((u.prenom+' '+u.nom).trim()||'—')+'</div>'+(u.telephone?'<div class="mono muted" style="font-size:12px">'+esc(u.telephone)+'</div>':'')+'</td><td>'+esc(u.societe)+'</td><td class="muted">'+esc(u.departement)+'</td><td><span class="pill '+r[1]+'">'+esc(r[0])+'</span></td><td class="num muted">'+esc(c)+'</td><td class="num muted">'+esc(date(u.created_at))+'</td></tr>';
    }).join(''):'<tr><td colspan="6" class="muted">Aucun utilisateur'+(q?' pour cette recherche':'')+'.</td></tr>';
  }
  $('admQ').addEventListener('input',renderUsers);

  /* ---------- Mon compte : projets, accords, profil ---------- */
  var projects=[];
  function loadAccount(){
    var p=profile||{};
    $('accName').textContent=((p.prenom||'')+' '+(p.nom||'')).trim()||'Mon compte';
    $('accSub').textContent=[session&&session.user.email,p.societe,p.departement].filter(Boolean).join(' · ');
    $('ac_prenom').value=p.prenom||''; $('ac_nom').value=p.nom||''; $('ac_societe').value=p.societe||''; $('ac_dept').value=p.departement||''; $('ac_tel').value=p.telephone||'';
    sb.from('projects').select('id,tool,name,inputs,created_at').order('created_at',{ascending:false}).then(function(r){
      projects=r.data||[];
      $('accProjects').innerHTML=projects.length?'<div class="scroll"><table class="t cards" style="min-width:560px"><thead><tr><th>Projet</th><th>Outil</th><th>Date</th><th></th></tr></thead><tbody>'+projects.map(function(x){
        return '<tr><td style="font-weight:500;white-space:normal">'+esc(x.name||'Sans nom')+'</td><td class="muted"><span class="lbl">Outil </span>'+(x.tool==='optique'?'optique conseillée':'calculateur complet')+'</td><td class="num muted"><span class="lbl">Date </span>'+esc(date(x.created_at))+'</td><td class="n"><button class="btn sm" type="button" data-open="'+x.id+'">Ouvrir</button> <button class="btn sm ghost" type="button" data-del="'+x.id+'">Supprimer</button></td></tr>';
      }).join('')+'</tbody></table></div>':'<div class="empty">Aucun projet. Utilisez « Enregistrer le projet » dans un calculateur.</div>';
    });
    sb.from('consents').select('*').then(function(r){
      var g={}; (r.data||[]).forEach(function(c){ g[c.kind]=c.granted; });
      [].forEach.call(document.querySelectorAll('[data-consent]'),function(cb){ cb.checked=!!g[cb.dataset.consent]; });
    });
  }
  document.addEventListener('click',function(e){
    if(!e.target.closest) return;
    var o=e.target.closest('[data-open]');
    if(o){ var x=projects.filter(function(p){return p.id===o.dataset.open})[0]; if(!x) return;
      if(x.tool==='optique'){ window.LumenOptique.load(x.inputs); go('optique'); } else { window.LumenCalc.load(x.inputs); go('calculateur'); } return; }
    var d=e.target.closest('[data-del]');
    if(d){ if(!window.confirm('Supprimer ce projet ? Cette action est définitive.')) return;
      sb.from('projects').delete().eq('id',d.dataset.del).then(function(r){ if(r.error) return toast(fr(r.error)); log('projet_supprime'); loadAccount(); }); }
  });
  document.addEventListener('change',function(e){
    var cb=e.target.closest&&e.target.closest('[data-consent]'); if(!cb) return;
    $('accConsentMsg').textContent='Enregistrement…';
    sb.from('consents').upsert({user_id:session.user.id,kind:cb.dataset.consent,granted:cb.checked,updated_at:new Date().toISOString()}).then(function(r){
      if(r.error){ cb.checked=!cb.checked; $('accConsentMsg').textContent=fr(r.error); return; }
      log(cb.checked?'accord_donne':'accord_retire',{kind:cb.dataset.consent}); $('accConsentMsg').textContent=cb.checked?'Accord enregistré.':'Accord retiré.';
    });
  });
  $('accForm').addEventListener('submit',function(e){
    e.preventDefault(); var f=this; busy(f,true); $('accMsg').textContent='';
    var v={prenom:$('ac_prenom').value.trim(),nom:$('ac_nom').value.trim(),societe:$('ac_societe').value.trim(),departement:$('ac_dept').value.trim(),telephone:$('ac_tel').value.trim()||null};
    sb.from('profiles').update(v).eq('id',session.user.id).then(function(r){
      busy(f,false); if(r.error){ $('accMsg').textContent=fr(r.error); return; }
      log('profil_modifie'); loadProfile().then(loadAccount); $('accMsg').textContent='Profil enregistré.';
    });
  });

  /* ---------- Démarrage ---------- */
  if(DEMO){
    $('demoBand').hidden=false; setWho();
    $('admDemo').hidden=false;
    document.querySelector('.app-head .tabs').insertAdjacentHTML('beforeend','<a href="#/admin/tableau"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg>Aperçu admin</a>');
    [].forEach.call(document.querySelectorAll('[data-logout],[data-tab="compte"]'),function(el){ el.hidden=true; });
    route(); return;
  }
  if(!window.supabase||!CFG.url||!CFG.anonKey){ document.body.insertAdjacentHTML('afterbegin','<div class="demo-band">Le service de comptes est indisponible pour le moment. Les calculateurs restent accessibles après connexion une fois le service rétabli.</div>'); route(); return; }
  var fromLink=/access_token=/.test(location.hash);
  var hp=new URLSearchParams(location.hash.replace(/^#\/?/,''));
  if(hp.get('type')==='recovery') recovery=true;
  if(hp.get('error_description')) linkError=(hp.get('error_code')==='otp_expired'?'Ce lien a expiré ou a déjà servi. ':'Lien invalide. ')+'Demandez-en un nouveau.';
  sb=window.supabase.createClient(CFG.url,CFG.anonKey,{auth:{flowType:'implicit',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true,storage:storage}});
  sb.auth.onAuthStateChange(function(ev,s){
    if(ev==='PASSWORD_RECOVERY'){ recovery=true; refreshSession(s).then(function(){ go('mot-de-passe'); }); }
    else if(ev==='TOKEN_REFRESHED'||ev==='USER_UPDATED'){ session=s; if(s){ refreshSession(s); } }
    else if(ev==='SIGNED_OUT'){ session=null; profile=null; }
  });
  sb.auth.getSession().then(function(r){ return refreshSession(r.data.session); }).then(function(){
    if(linkError) return go('connexion');
    if(session&&(recovery||!pwSet())) return go('mot-de-passe');
    if(fromLink&&session) return go('calculateur');
    route();
  });
})();
