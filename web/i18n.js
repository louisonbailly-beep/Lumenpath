/* Vision Path : choix de la langue (français, anglais, allemand).
   Le français est la langue source : chaque texte français sert de clé aux dictionnaires
   anglais et allemand (web/i18n-en.js, web/i18n-de.js). Clé absente : le texte français reste affiché.
   I18N.t(texte, {n:…}) remplit les variables {n}. I18N.apply(racine) traduit le HTML statique. */
(function(root){
  var LANGS = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE' };
  var DICTS = root.I18N_DICTS = root.I18N_DICTS || {};
  var listeners = [], rev = {};
  var I = { lang: 'fr', locale: 'fr-FR' };

  function fill(s, v){
    if(!v) return s;
    return String(s).replace(/\{(\w+)\}/g, function(m, k){ return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m; });
  }
  function has(d, k){ return !!d && Object.prototype.hasOwnProperty.call(d, k); }
  function t(s, v){
    if(s == null) return s;
    var d = DICTS[I.lang];
    return fill(has(d, s) ? d[s] : s, v);
  }
  /* texte français d'origine d'un texte déjà traduit (pour retraduire un texte posé par un script) */
  function reverse(code){
    if(rev[code]) return rev[code];
    var r = {}, d = DICTS[code] || {};
    Object.keys(d).forEach(function(k){ if(d[k].indexOf('{') < 0 && !has(r, d[k])) r[d[k]] = k; });
    return (rev[code] = r);
  }
  function key(s){
    if(has(DICTS.en, s) || has(DICTS.de, s)) return s;
    var codes = Object.keys(DICTS);
    for(var i = 0; i < codes.length; i++){ var r = reverse(codes[i]); if(has(r, s)) return r[s]; }
    return null;
  }

  /* ---------- HTML statique ---------- */
  var TXT = new WeakMap(), ATT = new WeakMap();
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  function skipEl(el){ return SKIP[el.tagName] || el.id === 'out' || el.id === 'oOut' || el.hasAttribute('data-i18n-skip'); }
  function trNode(node){
    var cur = node.data, rec = TXT.get(node), k;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(cur);
    if(rec && rec.shown === cur) k = rec.key;
    else { if(!m[2]) return; k = key(m[2]); if(k == null) return; }
    var out = m[1] + t(k) + m[3];
    if(out !== cur) node.data = out;
    TXT.set(node, { key: k, shown: out });
  }
  function trAttrs(el){
    var store = ATT.get(el);
    ATTRS.forEach(function(a){
      if(!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), rec = store && store[a], k;
      if(rec && rec.shown === cur) k = rec.key;
      else { k = key(cur.trim()); if(k == null) return; }
      var out = t(k);
      if(out !== cur) el.setAttribute(a, out);
      if(!store){ store = {}; ATT.set(el, store); }
      store[a] = { key: k, shown: out };
    });
  }
  function apply(rootEl){
    rootEl = rootEl || document.body;
    if(!rootEl) return;
    if(rootEl.nodeType === 1){ if(skipEl(rootEl)) return; trAttrs(rootEl); }
    var w = document.createTreeWalker(rootEl, 5 /* éléments et textes */, { acceptNode: function(n){
      return n.nodeType === 1 && skipEl(n) ? 2 /* FILTER_REJECT : saute le sous-arbre */ : 1;
    } });
    var n, texts = [];
    while((n = w.nextNode())){ if(n.nodeType === 3) texts.push(n); else trAttrs(n); }
    texts.forEach(trNode);
    if(rootEl === document.body || rootEl === document.documentElement){
      var md = document.querySelector('meta[name="description"]');
      if(md) trAttrsMeta(md);
      var tk = key(document.title); if(tk != null) document.title = t(tk);
    }
    syncSwitchers();
  }
  function trAttrsMeta(md){
    var rec = ATT.get(md), cur = md.getAttribute('content'), k;
    if(rec && rec.shown === cur) k = rec.key; else { k = key(cur); if(k == null) return; }
    var out = t(k); md.setAttribute('content', out); ATT.set(md, { key: k, shown: out });
  }

  /* ---------- Sélecteur FR · EN · DE ---------- */
  function syncSwitchers(){
    [].forEach.call(document.querySelectorAll('[data-lang]'), function(b){
      var on = b.getAttribute('data-lang') === I.lang;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    });
  }
  function save(code){ try{ localStorage.setItem('vp_lang', code); }catch(e){} }
  function setLang(code, quiet){
    if(!LANGS[code]) code = 'fr';
    var changed = code !== I.lang;
    I.lang = code; I.locale = LANGS[code];
    try{ document.documentElement.lang = code; }catch(e){}
    if(quiet) return;
    save(code);
    apply(document.body);
    if(changed) listeners.slice().forEach(function(fn){ try{ fn(code); }catch(e){ if(root.console) console.error(e); } });
  }
  function onChange(fn){ if(typeof fn === 'function') listeners.push(fn); }

  function initial(){
    var s = null;
    try{ s = localStorage.getItem('vp_lang'); }catch(e){}
    if(LANGS[s]) return s;
    var nav = [];
    try{ nav = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || '']; }catch(e){}
    for(var i = 0; i < nav.length; i++){
      var c = String(nav[i] || '').toLowerCase().slice(0, 2);
      if(c === 'fr') return 'fr';
      if(c === 'en' || c === 'de') return c;
    }
    return 'fr';
  }

  I.t = t; I.fill = fill; I.key = key; I.apply = apply; I.setLang = function(code){ setLang(code); }; I.onChange = onChange;
  /* minuscules pour une étiquette insérée dans une phrase ; l'allemand garde ses majuscules */
  I.lc = function(s){ return I.lang === 'de' ? String(s) : String(s).toLowerCase(); };
  /* séparateur décimal d'un nombre déjà mis en chaîne (« 3.45 ») */
  I.dec = function(s){ return I.lang === 'en' ? String(s) : String(s).replace('.', ','); };
  root.I18N = I;
  setLang(initial(), true);

  if(typeof document !== 'undefined'){
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-lang]');
      if(!b) return;
      e.preventDefault();
      setLang(b.getAttribute('data-lang'));
    });
    var start = function(){ apply(document.body); };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})(typeof self !== 'undefined' ? self : this);
