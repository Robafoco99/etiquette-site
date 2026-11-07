/* Dine & Shine — shared behaviour: mobile nav, scroll reveal, tabs,
   flip cards and the illustrated-setting legend. No libraries. */
(function () {
  'use strict';

  var tr = function (k) { return window.DS ? window.DS.t(k) : k; };

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var list = document.getElementById('nav-list');
  if (toggle && list) {
    var syncToggle = function () {
      toggle.setAttribute('aria-label', tr(list.classList.contains('is-open') ? 'a11y.closeMenu' : 'a11y.openMenu'));
    };
    if (window.DS) { window.DS.onChange(syncToggle); syncToggle(); }
    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', tr(open ? 'a11y.closeMenu' : 'a11y.openMenu'));
    });
    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        list.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', tr('a11y.openMenu'));
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && list.classList.contains('is-open')) {
        list.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden (e.g., for very tall elements).
    window.addEventListener('load', function () {
      setTimeout(function () {
        reveals.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight) el.classList.add('is-visible');
        });
      }, 400);
    });
  }

  /* ---------- Tabs (WAI-ARIA tabs pattern) ---------- */
  document.querySelectorAll('[data-tabs]').forEach(function (wrap) {
    var tabs = Array.prototype.slice.call(wrap.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.hidden = !on;
          if (on) {
            panel.classList.remove('is-entering');
            void panel.offsetWidth;
            panel.classList.add('is-entering');
          }
        }
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
    // Open the right panel when arriving via a #panel-n link.
    function fromHash() {
      var target = location.hash && document.getElementById(location.hash.slice(1));
      if (target && target.getAttribute('role') === 'tabpanel') {
        var t = document.getElementById(target.getAttribute('aria-labelledby'));
        if (t) select(t, false);
      }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
  });

  /* ---------- Flip cards ---------- */
  document.querySelectorAll('.flip').forEach(function (card) {
    card.setAttribute('aria-pressed', 'false');
    card.addEventListener('click', function () {
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(flipped));
      var front = card.querySelector('.flip-front');
      var back = card.querySelector('.flip-back');
      if (front && back) {
        front.setAttribute('aria-hidden', String(flipped));
        back.setAttribute('aria-hidden', String(!flipped));
      }
    });
    var b = card.querySelector('.flip-back');
    if (b) b.setAttribute('aria-hidden', 'true');
  });

  /* ---------- Illustrated setting: legend <-> drawing highlight ---------- */
  var legend = document.querySelector('[data-legend]');
  if (legend) {
    var art = document.querySelector('[data-setting-art]');
    var clear = function () {
      legend.querySelectorAll('.is-hl').forEach(function (n) { n.classList.remove('is-hl'); });
      if (art) art.querySelectorAll('.is-hl').forEach(function (n) { n.classList.remove('is-hl'); });
    };
    var highlight = function (id) {
      clear();
      var btn = legend.querySelector('[data-part="' + id + '"]');
      var part = art && art.querySelector('.part[data-part="' + id + '"]');
      if (btn) btn.classList.add('is-hl');
      if (part) part.classList.add('is-hl');
    };
    legend.querySelectorAll('button[data-part]').forEach(function (btn) {
      var id = btn.getAttribute('data-part');
      btn.addEventListener('mouseenter', function () { highlight(id); });
      btn.addEventListener('focus', function () { highlight(id); });
      btn.addEventListener('click', function () { highlight(id); });
    });
    legend.addEventListener('mouseleave', function () {
      if (!legend.contains(document.activeElement)) clear();
    });
    if (art) {
      art.querySelectorAll('.part[data-part]').forEach(function (p) {
        p.addEventListener('mouseenter', function () { highlight(p.getAttribute('data-part')); });
        p.addEventListener('click', function () { highlight(p.getAttribute('data-part')); });
      });
    }
  }
})();
