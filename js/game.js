/* Dine & Shine — "Set the Table" game.
   Pieces are the illustrator's SVGs (assets/table/), all drawn at one real-world
   scale (2.5 px per unit). The board is a 2100 × 1310 scene: every piece keeps its
   own width and height and the whole table scales together.
   Input: Pointer Events (mouse, touch, pen), tap-to-place, or keyboard (Tab + Enter).
   While dragging, the piece hangs from the grab point and swings with a damped spring. */
(function () {
  'use strict';
  var root = document.querySelector('[data-game]');
  if (!root) return;

  var board = root.querySelector('[data-board]');
  var scroller = root.querySelector('[data-board-scroll]');
  var layer = root.querySelector('[data-placed]');
  var tray = root.querySelector('[data-tray]');
  var statusEl = root.querySelector('[data-status]');
  var movesEl = root.querySelector('[data-moves]');
  var doneBox = root.querySelector('[data-done]');
  var modeBtns = root.querySelectorAll('[data-mode]');
  var formalNote = root.querySelector('[data-formal-note]');
  var lunchNote = root.querySelector('[data-lunch-note]');
  var W = 2100, H = 1310;       // scene size in source pixels
  var REACH = 70;               // a drop may land this far (scene px) outside a spot
  var T = function (k, v) { return window.DS ? window.DS.t(k, v) : k; };
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* Intrinsic sizes come straight from each SVG's width/height. */
  var PIECES = {
    napkin:    { file: 'napkin',           w: 260, h: 585 },
    plate:     { file: 'plate-dinner',     w: 685, h: 685 },
    bread:     { file: 'plate-bread',      w: 422, h: 422 },
    butter:    { file: 'knife-butter',     w: 62,  h: 410 },
    knife:     { file: 'knife-dinner',     w: 53,  h: 590 },
    fishknife: { file: 'knife-fish',       w: 75,  h: 535 },
    salad:     { file: 'fork-salad',       w: 73,  h: 447 },
    fishfork:  { file: 'fork-fish',        w: 75,  h: 472 },
    fork:      { file: 'fork-dinner',      w: 73,  h: 510 },
    oyster:    { file: 'fork-oyster',      w: 63,  h: 360 },
    dfork:     { file: 'fork-dessert',     w: 58,  h: 405 },
    spoon:     { file: 'spoon-soup',       w: 120, h: 485 },
    dspoon:    { file: 'spoon-dessert',    w: 95,  h: 455 },
    water:     { file: 'glass-water',      w: 210, h: 442 },
    red:       { file: 'glass-wine-red',   w: 248, h: 567 },
    white:     { file: 'glass-wine-white', w: 185, h: 542 }
  };
  function srcOf(id) { return 'assets/table/' + PIECES[id].file + '.svg'; }
  function pname(id) { return T('game.p.' + id + '.name'); }

  /* Spots: x, y = top-left of the unrotated box in scene px; r = rotation; needs = a piece that must be placed first. */
  function S(id, label, x, y, w, h, accept, r, needs) {
    return { id: id, label: label, cx: x + w / 2, cy: y + h / 2, w: w, h: h, accept: accept, r: r || 0, needs: needs || null };
  }
  var NAPKIN_ON_PLATE = S('napkinP', 'napkinPlate', 883, 637.5, 260, 585, ['napkin'], 0, 'plate');
  var PLATE = S('plate', 'plate', 671, 588, 685, 685, ['plate']);
  var LAYOUTS = {
    /* Formal: salad served after the main course, so its fork sits next to the plate. */
    formal: [
      S('napkinL', 'napkinLeft', 40, 638, 260, 585, ['napkin']), NAPKIN_ON_PLATE,
      S('fishfork', 'leftOuter', 340, 694, 75, 472, ['fishfork']),
      S('fork', 'leftMiddle', 450, 675, 73, 510, ['fork']),
      S('salad', 'leftInner', 558, 706, 73, 447, ['salad']),
      PLATE,
      S('knife', 'rightInner', 1396, 635, 53, 590, ['knife']),
      S('fishknife', 'rightMiddle', 1484, 662, 75, 535, ['fishknife']),
      S('spoon', 'rightSpoon', 1594, 687, 120, 485, ['spoon']),
      S('oyster', 'farRight', 1749, 750, 63, 360, ['oyster']),
      S('bread', 'upperLeft', 274, 228, 422, 422, ['bread']),
      S('butter', 'onBread', 454, 234, 62, 410, ['butter'], -45, 'bread'),
      S('dspoon', 'aboveTop', 965.5, 214.5, 95, 455, ['dspoon'], -90),
      S('dfork', 'aboveBottom', 984, 331.5, 58, 405, ['dfork'], 90),
      S('water', 'upperRight', 1367, 168, 210, 442, ['water']),
      S('wineA', 'wineA', 1597, 43, 248, 567, ['red', 'white']),
      S('wineB', 'wineB', 1865, 68, 185, 542, ['red', 'white'])
    ],
    /* Business lunch (informal): salad first, so its fork sits outermost. */
    lunch: [
      S('napkinL', 'napkinLeft', 150, 638, 260, 585, ['napkin']), NAPKIN_ON_PLATE,
      S('salad', 'leftOuter', 450, 706, 73, 447, ['salad']),
      S('fork', 'leftInner', 558, 675, 73, 510, ['fork']),
      PLATE,
      S('knife', 'rightInner', 1396, 635, 53, 590, ['knife']),
      S('spoon', 'rightMiddle', 1484, 687, 120, 485, ['spoon']),
      S('dspoon', 'aboveTop', 965.5, 252.5, 95, 455, ['dspoon'], -90),
      S('water', 'upperRight', 1317, 168, 210, 442, ['water']),
      S('wineA', 'wineA', 1547, 43, 248, 567, ['red'])
    ]
  };
  var MODE_PIECES = {
    formal: ['napkin', 'plate', 'fishfork', 'fork', 'salad', 'knife', 'fishknife', 'spoon', 'oyster', 'bread', 'butter', 'dspoon', 'dfork', 'water', 'red', 'white'],
    lunch: ['napkin', 'plate', 'salad', 'fork', 'knife', 'spoon', 'dspoon', 'water', 'red']
  };

  var mode = 'lunch', selected = null, moves = 0, placed = 0, total = 0;
  var placedIds = {};

  function pct(v, of) { return (v / of * 100) + '%'; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hintFor(id) {
    if (id === 'salad' || id === 'spoon') return T('game.p.' + id + (mode === 'formal' ? '.hintFormal' : '.hintLunch'));
    return T('game.p.' + id + '.hint');
  }

  /* ---------- status (stored as keys so a language switch can re-render it) ---------- */
  var last = { key: 'game.pick', vars: null, kind: '' };
  function say(key, vars, kind) { last = { key: key, vars: vars || null, kind: kind || '' }; renderStatus(); }
  function renderStatus() {
    var v = {};
    if (last.vars) Object.keys(last.vars).forEach(function (k) { var x = last.vars[k]; v[k] = typeof x === 'function' ? x() : x; });
    statusEl.className = 'game-status' + (last.kind ? ' ' + last.kind : '');
    statusEl.textContent = T(last.key, v);
  }

  /* ---------- build ---------- */
  function makeImg(id, cls) {
    var p = PIECES[id], img = document.createElement('img');
    img.src = srcOf(id); img.width = p.w; img.height = p.h;
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    img.className = cls;
    img.style.setProperty('--w', p.w); img.style.setProperty('--h', p.h);
    return img;
  }
  function slotLabel(s) { return T('game.emptySpot', { label: T('game.s.' + s.label) }); }

  function build() {
    cancelAllMotion();
    board.querySelectorAll('.slot').forEach(function (s) { s.remove(); });
    layer.innerHTML = ''; tray.innerHTML = '';
    selected = null; moves = 0; placed = 0; placedIds = {};
    movesEl.textContent = '0';
    doneBox.classList.remove('is-shown');
    board.classList.remove('has-selection');
    if (formalNote) formalNote.hidden = mode !== 'formal';
    if (lunchNote) lunchNote.hidden = mode !== 'lunch';
    total = MODE_PIECES[mode].length;

    LAYOUTS[mode].forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slot';
      b._s = s; b.dataset.slot = s.id;
      b.style.left = pct(s.cx - s.w / 2, W); b.style.top = pct(s.cy - s.h / 2, H);
      b.style.width = pct(s.w, W); b.style.height = pct(s.h, H);
      if (s.r) b.style.transform = 'rotate(' + s.r + 'deg)';
      b.hidden = !!s.needs;
      b.setAttribute('aria-label', slotLabel(s));
      b.addEventListener('click', function (e) { e.stopPropagation(); onSlot(b); });
      board.appendChild(b);
    });

    shuffle(MODE_PIECES[mode].slice()).forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'piece';
      b.dataset.piece = id; b.setAttribute('aria-pressed', 'false');
      var fig = document.createElement('span'); fig.className = 'piece-fig';
      fig.appendChild(makeImg(id, 'piece-img'));
      var name = document.createElement('span'); name.setAttribute('data-name', ''); name.textContent = pname(id);
      b.appendChild(fig); b.appendChild(name);
      b.addEventListener('click', function () {
        if (b.dataset.justDragged) { delete b.dataset.justDragged; return; }
        onPiece(b);
      });
      b.addEventListener('pointerdown', startDrag);
      tray.appendChild(b);
    });
    say(mode === 'lunch' ? 'game.startLunch' : 'game.startFormal');
  }

  /* ---------- geometry ---------- */
  function sceneRect() { return board.getBoundingClientRect(); }
  function bbox(s) {   // axis-aligned box of a (possibly rotated) spot, in scene px
    var a = Math.abs(s.r) * Math.PI / 180;
    var bw = Math.abs(s.w * Math.cos(a)) + Math.abs(s.h * Math.sin(a));
    var bh = Math.abs(s.w * Math.sin(a)) + Math.abs(s.h * Math.cos(a));
    return { x: s.cx - bw / 2, y: s.cy - bh / 2, w: bw, h: bh };
  }
  function nearestSlot(clientX, clientY) {
    var r = sceneRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    var x = (clientX - r.left) / r.width * W, y = (clientY - r.top) / r.height * H;
    var best = null, bestD = Infinity;
    board.querySelectorAll('.slot:not(.is-filled):not([hidden])').forEach(function (el) {
      var q = bbox(el._s);
      var dx = Math.max(q.x - x, 0, x - (q.x + q.w)), dy = Math.max(q.y - y, 0, y - (q.y + q.h));
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) d = -1 / (1 + Math.hypot(x - el._s.cx, y - el._s.cy));
      if (d < bestD) { bestD = d; best = el; }
    });
    return bestD <= REACH ? best : null;
  }
  board.addEventListener('click', function (e) {
    if (!selected) return;
    var s = nearestSlot(e.clientX, e.clientY);
    if (s) onSlot(s);
  });

  /* ---------- selection, tap and keyboard ---------- */
  function select(btn) {
    if (selected) selected.setAttribute('aria-pressed', 'false');
    selected = btn;
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      board.classList.add('has-selection');
      var pid = btn.dataset.piece;
      say('game.picked', { name: function () { return pname(pid); } });
    } else board.classList.remove('has-selection');
  }
  function onPiece(btn) {
    if (selected === btn) { select(null); say('game.putBack'); return; }
    select(btn);
    if (btn.matches(':focus-visible')) {
      var first = board.querySelector('.slot:not(.is-filled):not([hidden])');
      if (first) first.focus();
    }
  }
  function onSlot(slot) {
    if (slot.classList.contains('is-filled')) return;
    if (!selected) { say('game.pickFirst'); return; }
    attempt(selected, slot, null);
  }

  /* Returns true when the piece was accepted. */
  function attempt(piece, slot, ghost) {
    var id = piece.dataset.piece;
    var usedKeyboard = !ghost && document.activeElement === slot && slot.matches(':focus-visible');
    moves++; movesEl.textContent = String(moves);
    if (slot._s.accept.indexOf(id) !== -1) {
      if (ghost) snapGhost(ghost, slot, function () { commit(piece, slot, usedKeyboard); });
      else commit(piece, slot, usedKeyboard);
      return true;
    }
    slot.classList.remove('is-wrong'); void slot.offsetWidth; slot.classList.add('is-wrong');
    setTimeout(function () { slot.classList.remove('is-wrong'); }, 400);
    say('game.notQuite', { hint: function () { return hintFor(id); } }, 'err');
    if (usedKeyboard) piece.focus();
    select(null);
    return false;
  }

  function commit(piece, slot, usedKeyboard) {
    var id = piece.dataset.piece, s = slot._s, p = PIECES[id];
    var img = makeImg(id, 'tp placed just-placed');
    img.alt = pname(id); img.dataset.piece = id;
    img.style.left = pct(s.cx - p.w / 2, W); img.style.top = pct(s.cy - p.h / 2, H);
    img.style.width = pct(p.w, W); img.style.height = pct(p.h, H);
    img.style.setProperty('--r', s.r + 'deg');
    if (id === 'plate') img.classList.add('is-under');
    layer.appendChild(img);
    setTimeout(function () { img.classList.remove('just-placed'); }, 360);
    slot.classList.add('is-filled'); slot.disabled = true;
    slot.dataset.placed = id;
    slot.setAttribute('aria-label', T('game.placed', { name: pname(id) }));
    placedIds[id] = true;
    // Unlock spots that depend on this piece; a napkin fills only one of its two spots.
    board.querySelectorAll('.slot[hidden]').forEach(function (el) { if (el._s.needs && placedIds[el._s.needs] && !(el._s.accept[0] === 'napkin' && placedIds.napkin)) el.hidden = false; });
    if (id === 'napkin') board.querySelectorAll('.slot').forEach(function (el) { if (el !== slot && el._s.accept[0] === 'napkin') el.hidden = true; });
    piece.remove(); select(null);
    placed++;
    if (placed === total) finish();
    else {
      say('game.p.' + id + '.ok', null, 'ok');
      if (usedKeyboard) { var next = tray.querySelector('.piece'); if (next) next.focus(); }
    }
  }

  function finish() {
    say(moves === total ? 'game.flawless' : 'game.done', { n: moves }, 'done');
    doneBox.classList.add('is-shown');
    relabelSwitch();
    doneBox.querySelector('[data-again]').focus({ preventScroll: true });
  }

  /* ---------- physics: one shared requestAnimationFrame loop ---------- */
  var SPRING = { k: 170, c: 12, m: 1 };
  var MAX_ANGLE = 25, LIFT = 1.05;
  var movers = [];          // ghosts that are dragging, snapping or returning
  var rafId = 0, lastT = 0;

  function loop(now) {
    var dt = Math.min((now - lastT) / 1000 || 0, 1 / 30);   // clamp so tab pauses never jump
    lastT = now;
    movers = movers.filter(stepMover.bind(null, dt));
    autoScroll(dt);
    if (movers.length) rafId = requestAnimationFrame(loop);
    else rafId = 0;
  }
  function wake() { if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(loop); } }

  function stepMover(dt, g) {
    var reduce = mq.matches;
    if (reduce) { g.x = g.tx; g.y = g.ty; g.angle = 0; g.av = 0; }
    else {
      var follow = 1 - Math.exp(-dt * (g.phase === 'drag' ? 26 : 14));   // slight lag behind the pointer
      var px = g.x;
      g.x += (g.tx - g.x) * follow; g.y += (g.ty - g.y) * follow;
      var vx = dt > 0 ? (g.x - px) / dt : 0;
      g.vxs += (vx - g.vxs) * (1 - Math.exp(-dt * 10));               // smoothed horizontal velocity
      var target = g.phase === 'drag' ? Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, g.vxs * 0.03)) : 0;
      var steps = Math.ceil(dt / (1 / 240)), h = dt / steps;            // damped spring, sub-stepped
      for (var i = 0; i < steps; i++) {
        var acc = (-SPRING.k * (g.angle - target) - SPRING.c * g.av) / SPRING.m;
        g.av += acc * h; g.angle += g.av * h;
      }
    }
    g.scale += (g.scaleTo - g.scale) * (reduce ? 1 : 1 - Math.exp(-dt * 16));
    render(g);
    if (g.phase === 'drag') return true;
    var settled = Math.abs(g.tx - g.x) < 0.6 && Math.abs(g.ty - g.y) < 0.6 && Math.abs(g.angle) < 0.15 && Math.abs(g.av) < 0.5 && Math.abs(g.scaleTo - g.scale) < 0.01;
    if (settled) { g.done(); return false; }
    return true;
  }
  function render(g) {
    g.el.style.transform = 'translate3d(' + (g.x - g.gx) + 'px,' + (g.y - g.gy) + 'px,0) rotate(' + g.angle.toFixed(2) + 'deg) scale(' + g.scale.toFixed(3) + ')';
  }
  function cancelAllMotion() {
    movers.forEach(function (g) { if (g.el.parentNode) g.el.remove(); if (g.btn) g.btn.classList.remove('is-dragging'); });
    movers = []; drag = null;
  }

  /* ---------- drag (Pointer Events: mouse, touch and pen share one path) ---------- */
  var drag = null;
  function startDrag(e) {
    if (e.button !== 0) return;
    var btn = e.currentTarget;
    drag = { btn: btn, id: btn.dataset.piece, sx: e.clientX, sy: e.clientY, pid: e.pointerId, ghost: null, over: null };
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    btn.addEventListener('pointermove', moveDrag);
    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', cancelDrag);
  }
  function makeGhost(e) {
    var btn = drag.btn, img = btn.querySelector('.piece-img'), r = img.getBoundingClientRect();
    var p = PIECES[drag.id], bs = sceneRect().width / W;            // board scale = global piece scale
    var trayScale = r.width / p.w;
    // Grab point in the lifted piece; a grab on the button's padding is clamped onto the drawing.
    var gx = Math.max(0, Math.min(r.width, e.clientX - r.left)) / trayScale * bs;
    var gy = Math.max(0, Math.min(r.height, e.clientY - r.top)) / trayScale * bs;
    var el = makeImg(drag.id, 'drag-ghost');
    el.style.width = (p.w * bs) + 'px'; el.style.height = (p.h * bs) + 'px';
    el.style.transformOrigin = gx + 'px ' + gy + 'px';               // hang from the grab point
    document.body.appendChild(el);
    var g = { el: el, btn: btn, gx: gx, gy: gy, x: e.clientX, y: e.clientY, tx: e.clientX, ty: e.clientY,
              angle: 0, av: 0, vxs: 0, scale: trayScale / bs, scaleTo: mq.matches ? 1 : LIFT, phase: 'drag', done: function () {} };
    btn.classList.add('is-dragging');
    render(g); movers.push(g); wake();
    return g;
  }
  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.ghost) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 6) return;
      select(drag.btn);
      drag.ghost = makeGhost(e);
    }
    drag.ghost.tx = e.clientX; drag.ghost.ty = e.clientY;
    drag.px = e.clientX; drag.py = e.clientY;
    var slot = nearestSlot(e.clientX, e.clientY);
    if (drag.over && drag.over !== slot) drag.over.classList.remove('is-over');
    if (slot) slot.classList.add('is-over');
    drag.over = slot;
  }
  function detach() {
    var b = drag.btn;
    b.removeEventListener('pointermove', moveDrag);
    b.removeEventListener('pointerup', endDrag);
    b.removeEventListener('pointercancel', cancelDrag);
    try { b.releasePointerCapture(drag.pid); } catch (err) { /* already released */ }
  }
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    detach();
    var d = drag; drag = null;
    if (!d.ghost) return;                         // a plain tap: the click handler selects the piece
    d.btn.dataset.justDragged = '1';
    setTimeout(function () { delete d.btn.dataset.justDragged; }, 0);
    if (d.over) d.over.classList.remove('is-over');
    var slot = nearestSlot(e.clientX, e.clientY);
    if (slot && attempt(d.btn, slot, d.ghost)) return;
    if (!slot) { select(null); say('game.dropped'); }
    returnGhost(d.ghost);
  }
  function cancelDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    detach();
    var d = drag; drag = null;
    if (d.over) d.over.classList.remove('is-over');
    if (d.ghost) { select(null); returnGhost(d.ghost); }
  }
  function snapGhost(g, slot, after) {
    var r = slot.getBoundingClientRect(), p = PIECES[g.btn.dataset.piece], bs = sceneRect().width / W;
    g.phase = 'snap'; g.scaleTo = 1;
    g.tx = r.left + r.width / 2 - (p.w * bs / 2 - g.gx);
    g.ty = r.top + r.height / 2 - (p.h * bs / 2 - g.gy);
    g.done = function () { g.el.remove(); g.btn.classList.remove('is-dragging'); after(); };
    wake();
  }
  function returnGhost(g) {
    var img = g.btn.querySelector('.piece-img'), r = img.getBoundingClientRect();
    var bs = sceneRect().width / W, trayScale = r.width / PIECES[g.btn.dataset.piece].w;
    g.phase = 'return'; g.scaleTo = trayScale / bs;
    g.tx = r.left + g.gx * trayScale / bs; g.ty = r.top + g.gy * trayScale / bs;
    g.done = function () { g.el.remove(); g.btn.classList.remove('is-dragging'); };
    wake();
  }

  /* Edge auto-scroll while dragging: the page vertically, the board frame horizontally. */
  function autoScroll(dt) {
    if (!drag || !drag.ghost || drag.px == null) return;
    var edge = 56, speed = 700 * dt;
    if (drag.py < edge) window.scrollBy(0, -speed);
    else if (drag.py > window.innerHeight - edge) window.scrollBy(0, speed);
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      var r = scroller.getBoundingClientRect();
      if (drag.py > r.top && drag.py < r.bottom) {
        if (drag.px < r.left + edge) scroller.scrollLeft -= speed;
        else if (drag.px > r.right - edge) scroller.scrollLeft += speed;
      }
    }
  }

  /* ---------- controls and language ---------- */
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      modeBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      build();
    });
  });
  root.querySelector('[data-again]').addEventListener('click', build);
  root.querySelector('[data-switch]').addEventListener('click', function () {
    root.querySelector('[data-mode="' + (mode === 'lunch' ? 'formal' : 'lunch') + '"]').click();
    var first = tray.querySelector('.piece');
    if (first) first.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && selected) { var s = selected; select(null); say('game.putBack'); s.focus(); }
  });
  function relabelSwitch() {
    doneBox.querySelector('[data-switch]').textContent = T(mode === 'lunch' ? 'game.tryFormal' : 'game.tryLunch');
  }
  function relabel() {
    tray.querySelectorAll('.piece').forEach(function (b) { b.querySelector('[data-name]').textContent = pname(b.dataset.piece); });
    board.querySelectorAll('.slot').forEach(function (s) {
      s.setAttribute('aria-label', s.dataset.placed ? T('game.placed', { name: pname(s.dataset.placed) }) : slotLabel(s._s));
    });
    layer.querySelectorAll('img[data-piece]').forEach(function (i) { i.alt = pname(i.dataset.piece); });
    relabelSwitch(); renderStatus();
  }
  if (window.DS) window.DS.onChange(relabel);

  build();
})();
