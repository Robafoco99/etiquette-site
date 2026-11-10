/* Dine & Shine — interactive quiz. Every answer is taught somewhere on the site.
   The quiz renders from state, so switching language keeps the question, answer and score.
   "Show me the answers" ends the quiz until the page is refreshed (memory only). */
(function () {
  'use strict';
  var root = document.querySelector('[data-quiz]');
  if (!root) return;
  var T = function (k, v) { return window.DS ? window.DS.t(k, v) : k; };

  /* c = index of the correct option; tag = Carreño source (kept in its original form). */
  var QUESTIONS = [
    { c: 0, tag: 'Carreño · Mesa ¶25' }, { c: 1 }, { c: 0 }, { c: 1 }, { c: 1 },
    { c: 2 }, { c: 2 }, { c: 1 }, { c: 1, tag: 'Carreño · Banquetes ¶20' }, { c: 1, tag: 'Carreño · Mesa ¶39' }
  ];
  var LETTERS = ['A', 'B', 'C'];
  var state = { view: 'question', i: 0, score: 0, picked: null };

  function q(k, field) { return T('quiz.q' + (k + 1) + '.' + field); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function start() {
    if (state.view === 'locked') return;
    state = { view: 'question', i: 0, score: 0, picked: null };
    render();
  }

  function render(focusTarget) {
    root.innerHTML = '';
    if (state.view === 'question') renderQuestion(focusTarget);
    else if (state.view === 'result') renderResult(focusTarget);
    else renderLocked(focusTarget);
  }

  function renderQuestion(focusTarget) {
    var i = state.i, item = QUESTIONS[i], answered = state.picked !== null;
    var prog = el('div', 'quiz-progress');
    prog.appendChild(el('span', null, T('quiz.progress', { n: i + 1, total: QUESTIONS.length })));
    prog.appendChild(el('span', null, T('quiz.score', { n: state.score })));
    root.appendChild(prog);
    var bar = el('div', 'bar'); var fill = el('span'); bar.appendChild(fill); root.appendChild(bar);
    fill.style.width = (i / QUESTIONS.length * 100) + '%';

    var fs = el('fieldset');
    var lg = el('legend', null, q(i, 'q')); lg.tabIndex = -1;
    fs.appendChild(lg);
    var opts = el('div', 'options');
    [0, 1, 2].forEach(function (idx) {
      var b = el('button', 'option'); b.type = 'button';
      var m = el('span', 'mark', LETTERS[idx]); m.setAttribute('aria-hidden', 'true');
      b.appendChild(m);
      b.appendChild(el('span', null, q(i, 'a' + idx)));
      if (answered) {
        b.disabled = true;
        if (idx === item.c) { b.classList.add('correct'); m.textContent = '✓'; }
        else if (idx === state.picked) { b.classList.add('wrong'); m.textContent = '✗'; }
      } else {
        b.addEventListener('click', function () { answer(idx); });
      }
      opts.appendChild(b);
    });
    fs.appendChild(opts);
    root.appendChild(fs);

    var live = el('div', 'quiz-live'); live.setAttribute('aria-live', 'polite');
    root.appendChild(live);
    var next = null;
    if (answered) {
      var right = state.picked === item.c;
      var box = el('div', 'explain');
      box.appendChild(el('p', 'verdict-line', right ? T('quiz.correct') : T('quiz.wrong', { a: q(i, 'a' + item.c) })));
      box.appendChild(el('p', null, q(i, 'why')));
      if (item.tag) box.appendChild(el('span', 'src-tag', item.tag));
      live.appendChild(box);

      var actions = el('div', 'quiz-actions');
      var last = i === QUESTIONS.length - 1;
      next = el('button', 'btn btn--primary', T(last ? 'quiz.see' : 'quiz.next'));
      next.type = 'button';
      next.addEventListener('click', function () {
        if (last) { state.view = 'result'; render('heading'); }
        else { state.i++; state.picked = null; render('legend'); }
      });
      actions.appendChild(next);
      root.appendChild(actions);
    }
    if (focusTarget === 'legend') lg.focus({ preventScroll: true });
    if (focusTarget === 'next' && next) next.focus({ preventScroll: true });
  }

  function answer(idx) {
    if (state.view !== 'question' || state.picked !== null) return;
    state.picked = idx;
    if (idx === QUESTIONS[state.i].c) state.score++;
    render('next');
  }

  function renderResult(focusTarget) {
    var score = state.score;
    var r = el('div', 'result');
    r.appendChild(el('span', 'eyebrow', T('quiz.yourResult')));
    r.appendChild(el('p', 'score', score + ' / ' + QUESTIONS.length));
    var h = el('h3', null, T(score >= 9 ? 'quiz.r9' : score >= 6 ? 'quiz.r6' : 'quiz.r0')); h.tabIndex = -1;
    r.appendChild(h);
    var actions = el('div', 'quiz-actions btn-row');
    var again = el('button', 'btn btn--primary', T('quiz.retake')); again.type = 'button';
    again.addEventListener('click', function () { start(); var lg = root.querySelector('legend'); if (lg) lg.focus({ preventScroll: true }); });
    var link = el('a', 'btn btn--ghost', T('quiz.review')); link.href = 'table.html';
    actions.appendChild(again); actions.appendChild(link);
    r.appendChild(actions);
    var live = el('div'); live.setAttribute('aria-live', 'polite');
    root.appendChild(live);
    live.appendChild(r);
    if (focusTarget === 'heading') h.focus({ preventScroll: true });
  }

  function renderLocked(focusTarget) {
    var m = el('div', 'locked-msg');
    var h = el('h3', null, T('quiz.revealedTitle')); h.tabIndex = -1;
    m.appendChild(h);
    m.appendChild(el('p', null, T('quiz.revealedText')));
    var ol = el('ol', 'answer-key');
    QUESTIONS.forEach(function (item, k) {
      var li = el('li', null, q(k, 'q'));
      li.appendChild(el('span', 'ans', T('quiz.answer', { a: q(k, 'a' + item.c) })));
      ol.appendChild(li);
    });
    m.appendChild(ol);
    root.appendChild(m);
    if (focusTarget === 'heading') h.focus();
  }

  /* ---------- Show me the answers (ends the quiz until refresh) ---------- */
  var wrap = document.querySelector('[data-reveal-wrap]');
  if (wrap) {
    var revealBtn = wrap.querySelector('[data-reveal]');
    var confirmBox = wrap.querySelector('[data-confirm]');
    var yes = wrap.querySelector('[data-confirm-yes]');
    var no = wrap.querySelector('[data-confirm-no]');
    revealBtn.setAttribute('aria-expanded', 'false');
    revealBtn.setAttribute('aria-controls', 'confirm-box');
    confirmBox.id = 'confirm-box';

    revealBtn.addEventListener('click', function () {
      confirmBox.hidden = false;
      revealBtn.setAttribute('aria-expanded', 'true');
      yes.focus();
    });
    no.addEventListener('click', function () {
      confirmBox.hidden = true;
      revealBtn.setAttribute('aria-expanded', 'false');
      revealBtn.focus();
    });
    confirmBox.addEventListener('keydown', function (e) { if (e.key === 'Escape') no.click(); });
    yes.addEventListener('click', function () {
      state.view = 'locked';
      wrap.remove();
      // The answer key already lists every question, so the separate list is no longer needed.
      var list = document.querySelector('.qlist');
      if (list) list.remove();
      render('heading');
    });
  }

  if (window.DS) window.DS.onChange(function () { render(); });
  render();
})();
