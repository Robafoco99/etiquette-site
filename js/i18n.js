/* Dine & Shine — tiny native i18n engine. No network requests.
   Dictionaries live in js/i18n/<lang>.js and register on window.DS_I18N.
   Markup:
     data-i18n="key"            -> textContent
     data-i18n-html="key"       -> innerHTML (trusted, local strings only)
     data-i18n-attr="attr:key;attr2:key2"
     <html data-i18n-title="key"> -> document.title
   Missing keys fall back to English silently. First visit is always English. */
(function () {
  'use strict';
  var DICTS = window.DS_I18N = window.DS_I18N || {};
  var LANGS = ['en', 'es-419', 'es-ES', 'pt-BR', 'fr'];
  var STORE = 'ds-lang';
  var listeners = [];
  var current = 'en';

  function get(lang, key) {
    var d = DICTS[lang];
    return d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : undefined;
  }
  function t(key, vars) {
    var s = get(current, key);
    if (s === undefined) s = get('en', key);
    if (s === undefined) return '';
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-html'));
      if (v) el.innerHTML = v;
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length < 2) return;
        var v = t(p[1].trim());
        if (v) el.setAttribute(p[0].trim(), v);
      });
    });
    var tk = document.documentElement.getAttribute('data-i18n-title');
    if (tk && t(tk)) document.title = t(tk);
  }

  function setLang(lang, opts) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    current = lang;
    document.documentElement.lang = lang;
    apply(document);
    if (!opts || opts.save !== false) {
      try { window.localStorage.setItem(STORE, lang); } catch (e) { /* storage unavailable: fine */ }
    }
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* keep going */ } });
  }

  function saved() {
    try { return window.localStorage.getItem(STORE); } catch (e) { return null; }
  }

  window.DS = {
    t: t,
    apply: apply,
    setLang: setLang,
    onChange: function (fn) { listeners.push(fn); },
    lang: function () { return current; },
    langs: LANGS,
    dicts: DICTS
  };

  /* ---------- Language switcher (disclosure menu) ---------- */
  function initSwitcher() {
    document.querySelectorAll('[data-lang-switch]').forEach(function (wrap) {
      var btn = wrap.querySelector('.lang-btn');
      var menu = wrap.querySelector('.lang-menu');
      var label = wrap.querySelector('[data-lang-current]');
      var items = Array.prototype.slice.call(menu.querySelectorAll('[data-lang]'));

      function sync() {
        var cur = current;
        items.forEach(function (it) {
          var on = it.getAttribute('data-lang') === cur;
          it.setAttribute('aria-current', on ? 'true' : 'false');
          if (on && label) label.textContent = it.getAttribute('data-short');
        });
      }
      function open(focusFirst) {
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        var target = menu.querySelector('[aria-current="true"]') || items[0];
        if (focusFirst) target.focus();
      }
      function close(focusBtn) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (focusBtn) btn.focus();
      }
      btn.addEventListener('click', function () { menu.hidden ? open(true) : close(false); });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(true); }
      });
      items.forEach(function (it, i) {
        it.addEventListener('click', function () {
          setLang(it.getAttribute('data-lang'));
          close(true);
        });
        it.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
          if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
          if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
        });
      });
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); close(true); }
      });
      document.addEventListener('click', function (e) {
        if (!menu.hidden && !wrap.contains(e.target)) close(false);
      });
      listeners.push(sync);
      sync();
    });
  }

  /* Boot: English unless the visitor chose another language before. */
  var start = saved();
  if (LANGS.indexOf(start) === -1) start = 'en';
  function boot() {
    initSwitcher();
    setLang(start, { save: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
