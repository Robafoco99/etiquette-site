/* Dine & Shine — "Set the Table" game.
   Three ways to play: drag and drop (mouse/pen), tap a piece then tap a spot
   (touch), or keyboard (Tab + Enter, Esc to cancel).
   Spots are drawn slim, but any tap on the board goes to the nearest empty spot,
   so every spot gets a touch area of at least 44px on a 375px-wide phone. */
(function () {
  'use strict';
  var root = document.querySelector('[data-game]');
  if (!root) return;

  var board = root.querySelector('[data-board]');
  var tray = root.querySelector('[data-tray]');
  var statusEl = root.querySelector('[data-status]');
  var movesEl = root.querySelector('[data-moves]');
  var doneBox = root.querySelector('[data-done]');
  var modeBtns = root.querySelectorAll('[data-mode]');
  var formalNote = root.querySelector('[data-formal-note]');
  var BW = 600, BH = 400;     // board coordinate system
  var REACH = 45;             // how far (board units) a tap may land outside a spot

  /* Pieces: drawing + viewBox. Names and messages come from the i18n dictionaries (game.p.<id>.*). */
  var PIECES = {
    napkin:    { icon: 'i-napkin',    vb: '0 0 60 120' },
    salad:     { icon: 'i-fork',      vb: '0 0 24 120' },
    fishfork:  { icon: 'i-fishfork',  vb: '0 0 24 120' },
    fork:      { icon: 'i-fork',      vb: '0 0 24 120' },
    knife:     { icon: 'i-knife',     vb: '0 0 24 120' },
    fishknife: { icon: 'i-fishknife', vb: '0 0 24 120' },
    spoon:     { icon: 'i-spoon',     vb: '0 0 24 120' },
    bread:     { icon: 'i-bread',     vb: '0 0 100 100' },
    dessert:   { icon: 'i-dessert',   vb: '0 0 120 56' },
    water:     { icon: 'i-water',     vb: '0 0 60 90' },
    wine:      { icon: 'i-wine',      vb: '0 0 60 90' }
  };
  var T = function (k, v) { return window.DS ? window.DS.t(k, v) : k; };
  function pname(id) { return T('game.p.' + id + '.name'); }

  /* Spots per mode on a 600 × 400 board (x, y = top-left corner). */
  var LAYOUTS = {
    lunch: [
      { id: 'napkin', label: 'farLeft',        x: 58,  y: 175, w: 64,  h: 150 },
      { id: 'fork',   label: 'left',            x: 160, y: 175, w: 50,  h: 150 },
      { id: 'knife',  label: 'right',           x: 390, y: 175, w: 50,  h: 150 },
      { id: 'spoon',  label: 'farRight',       x: 480, y: 175, w: 50,  h: 150 },
      { id: 'bread',  label: 'upperLeft',                   x: 82,  y: 47,  w: 96,  h: 96 },
      { id: 'water',  label: 'upperRight', x: 386, y: 38,  w: 58,  h: 94 }
    ],
    formal: [
      { id: 'salad',     label: 'leftOuter',              x: 14,  y: 175, w: 50,  h: 150 },
      { id: 'fishfork',  label: 'leftMiddle',                 x: 93,  y: 175, w: 50,  h: 150 },
      { id: 'fork',      label: 'leftInner',      x: 172, y: 175, w: 50,  h: 150 },
      { id: 'knife',     label: 'rightInner',     x: 378, y: 175, w: 50,  h: 150 },
      { id: 'fishknife', label: 'rightMiddle',                x: 457, y: 175, w: 50,  h: 150 },
      { id: 'spoon',     label: 'rightOuter',             x: 536, y: 175, w: 50,  h: 150 },
      { id: 'bread',     label: 'upperLeft',                   x: 70,  y: 47,  w: 96,  h: 96 },
      { id: 'dessert',   label: 'above',              x: 230, y: 116, w: 140, h: 50 },
      { id: 'water',     label: 'upperRight', x: 383, y: 38,  w: 58,  h: 94 },
      { id: 'wine',      label: 'farUpperRight',              x: 461, y: 53,  w: 58,  h: 94 }
    ]
  };

  var mode = 'lunch';
  var selected = null;
  var moves = 0, placed = 0, total = 0;

  function svgFor(id) {
    var p = PIECES[id];
    return '<svg viewBox="' + p.vb + '" aria-hidden="true" focusable="false"><use href="#' + p.icon + '"/></svg>';
  }
  function hintFor(id) {
    if (id === 'spoon') return T(mode === 'formal' ? 'game.p.spoon.hintFormal' : 'game.p.spoon.hintLunch');
    return T('game.p.' + id + '.hint');
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* Status messages are stored as keys so they can be re-rendered in another language. */
  var last = { key: 'game.pick', vars: null, kind: '' };
  function say(key, vars, kind) {
    last = { key: key, vars: vars || null, kind: kind || '' };
    renderStatus();
  }
  function renderStatus() {
    var v = {};
    if (last.vars) Object.keys(last.vars).forEach(function (k) {
      var x = last.vars[k];
      v[k] = typeof x === 'function' ? x() : x;
    });
    statusEl.className = 'game-status' + (last.kind ? ' ' + last.kind : '');
    statusEl.textContent = T(last.key, v);
  }

  function build() {
    board.querySelectorAll('.slot').forEach(function (s) { s.remove(); });
    tray.innerHTML = '';
    selected = null; moves = 0; placed = 0;
    movesEl.textContent = '0';
    doneBox.classList.remove('is-shown');
    board.classList.remove('has-selection');
    board.dataset.mode = mode;
    if (formalNote) formalNote.hidden = mode !== 'formal';

    var layout = LAYOUTS[mode];
    total = layout.length;

    layout.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.dataset.accept = s.id;
      b._rect = s;
      b.style.left = (s.x / BW * 100) + '%';
      b.style.top = (s.y / BH * 100) + '%';
      b.style.width = (s.w / BW * 100) + '%';
      b.style.height = (s.h / BH * 100) + '%';
      b.dataset.label = s.label;
      b.setAttribute('aria-label', T('game.emptySpot', { label: T('game.s.' + s.label) }));
      b.addEventListener('click', function (e) { e.stopPropagation(); onSlot(b); });
      board.appendChild(b);
    });

    shuffle(layout.map(function (s) { return s.id; })).forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'piece';
      b.dataset.piece = id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = svgFor(id) + '<span data-name></span>';
      b.querySelector('[data-name]').textContent = pname(id);
      b.addEventListener('click', function () {
        if (b.dataset.justDragged) { delete b.dataset.justDragged; return; }
        onPiece(b);
      });
      b.addEventListener('pointerdown', startDrag);
      tray.appendChild(b);
    });

    say(mode === 'lunch' ? 'game.startLunch' : 'game.startFormal');
  }

  /* Nearest empty spot to a screen point, or null if the point is too far away. */
  function nearestSlot(clientX, clientY) {
    var r = board.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    var x = (clientX - r.left) / r.width * BW;
    var y = (clientY - r.top) / r.height * BH;
    var best = null, bestD = Infinity;
    board.querySelectorAll('.slot:not(.is-filled)').forEach(function (s) {
      var q = s._rect;
      var dx = Math.max(q.x - x, 0, x - (q.x + q.w));
      var dy = Math.max(q.y - y, 0, y - (q.y + q.h));
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) {   // inside: prefer the spot whose center is closest
        d = -1 / (1 + Math.hypot(x - (q.x + q.w / 2), y - (q.y + q.h / 2)));
      }
      if (d < bestD) { bestD = d; best = s; }
    });
    return bestD <= REACH ? best : null;
  }

  board.addEventListener('click', function (e) {
    if (!selected) return;
    var s = nearestSlot(e.clientX, e.clientY);
    if (s) onSlot(s);
  });

  function select(btn) {
    if (selected) selected.setAttribute('aria-pressed', 'false');
    selected = btn;
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      board.classList.add('has-selection');
      var pid = btn.dataset.piece;
      say('game.picked', { name: function () { return pname(pid); } });
    } else {
      board.classList.remove('has-selection');
    }
  }

  function onPiece(btn) {
    if (selected === btn) { select(null); say('game.putBack'); return; }
    select(btn);
    if (btn.matches(':focus-visible')) {
      var first = board.querySelector('.slot:not(.is-filled)');
      if (first) first.focus();
    }
  }

  function onSlot(slot) {
    if (slot.classList.contains('is-filled')) return;
    if (!selected) { say('game.pickFirst'); return; }
    attempt(selected, slot);
  }

  function attempt(piece, slot) {
    var id = piece.dataset.piece;
    var usedKeyboard = document.activeElement === slot && slot.matches(':focus-visible');
    moves++;
    movesEl.textContent = String(moves);

    if (slot.dataset.accept === id) {
      slot.classList.add('is-filled', 'just-placed');
      slot.innerHTML = svgFor(id);
      slot.disabled = true;
      slot.dataset.placed = id;
      slot.setAttribute('aria-label', T('game.placed', { name: pname(id) }));
      setTimeout(function () { slot.classList.remove('just-placed'); }, 320);
      piece.remove();
      select(null);
      placed++;
      if (placed === total) {
        finish();
      } else {
        say('game.p.' + id + '.ok', null, 'ok');
        if (usedKeyboard) {
          var next = tray.querySelector('.piece');
          if (next) next.focus();
        }
      }
    } else {
      slot.classList.remove('is-wrong');
      void slot.offsetWidth;
      slot.classList.add('is-wrong');
      setTimeout(function () { slot.classList.remove('is-wrong'); }, 400);
      say('game.notQuite', { hint: function () { return hintFor(id); } }, 'err');
      if (usedKeyboard) piece.focus();
      select(null);
    }
  }

  function finish() {
    var perfect = moves === total;
    say(perfect ? 'game.flawless' : 'game.done', { n: moves }, 'done');
    doneBox.classList.add('is-shown');
    relabelSwitch();
    doneBox.querySelector('[data-again]').focus({ preventScroll: true });
  }

  /* ---------- Drag and drop (mouse and pen) ---------- */
  var drag = null;
  function startDrag(e) {
    if (e.pointerType === 'touch' || e.button !== 0) return; // touch uses tap-to-place
    drag = { btn: e.currentTarget, x: e.clientX, y: e.clientY, active: false, ghost: null, over: null };
    document.addEventListener('pointermove', moveDrag);
    document.addEventListener('pointerup', endDrag);
  }
  function moveDrag(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.active = true;
      select(drag.btn);
      drag.btn.classList.add('is-dragging');
      var g = document.createElement('div');
      g.className = 'drag-ghost';
      g.innerHTML = svgFor(drag.btn.dataset.piece);
      document.body.appendChild(g);
      drag.ghost = g;
    }
    e.preventDefault();
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    var slot = nearestSlot(e.clientX, e.clientY);
    if (drag.over && drag.over !== slot) drag.over.classList.remove('is-over');
    if (slot) slot.classList.add('is-over');
    drag.over = slot;
  }
  function endDrag() {
    document.removeEventListener('pointermove', moveDrag);
    document.removeEventListener('pointerup', endDrag);
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.active) return;
    d.btn.dataset.justDragged = '1';
    setTimeout(function () { delete d.btn.dataset.justDragged; }, 0);
    d.btn.classList.remove('is-dragging');
    if (d.ghost) d.ghost.remove();
    if (d.over) {
      d.over.classList.remove('is-over');
      attempt(d.btn, d.over);
    } else {
      select(null);
      say('game.dropped');
    }
  }

  /* ---------- Controls ---------- */
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      modeBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      build();
    });
  });
  root.querySelector('[data-again]').addEventListener('click', build);
  root.querySelector('[data-switch]').addEventListener('click', function () {
    var other = mode === 'lunch' ? 'formal' : 'lunch';
    root.querySelector('[data-mode="' + other + '"]').click();
    var first = tray.querySelector('.piece');
    if (first) first.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && selected) {
      var s = selected; select(null); say('game.putBack'); s.focus();
    }
  });

  function relabelSwitch() {
    doneBox.querySelector('[data-switch]').textContent = T(mode === 'lunch' ? 'game.tryFormal' : 'game.tryLunch');
  }
  /* Language change: re-render text only; the board, tray, moves and status stay as they are. */
  function relabel() {
    tray.querySelectorAll('.piece').forEach(function (b) { b.querySelector('[data-name]').textContent = pname(b.dataset.piece); });
    board.querySelectorAll('.slot').forEach(function (s) {
      s.setAttribute('aria-label', s.dataset.placed
        ? T('game.placed', { name: pname(s.dataset.placed) })
        : T('game.emptySpot', { label: T('game.s.' + s.dataset.label) }));
    });
    relabelSwitch();
    renderStatus();
  }
  if (window.DS) window.DS.onChange(relabel);

  build();
})();
