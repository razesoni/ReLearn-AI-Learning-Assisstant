/** Practice quiz: multiple choice, numeric problems, open-ended self-check. */
(function () {
  'use strict';
  const { $, esc, api, toast } = Margin;

  const id = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const root = $('#quizRoot');
  const DIFF = { easy: 'Easier', medium: 'Medium', hard: 'Harder' };

  let set = null, questions = [], index = 0, results = [], checked = false, saved = false;

  function parseNumber(raw) {
    const n = parseFloat(String(raw).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function start(list) {
    questions = list; index = 0; results = new Array(list.length).fill(null); checked = false; saved = false;
    renderQuestion();
  }

  function renderQuestion() {
    const q = questions[index];
    checked = false;
    const pct = Math.round(index / questions.length * 100);
    let input = '';
    if (q.type === 'mcq') {
      input = '<div class="options" role="radiogroup" aria-label="Answer choices">' + q.options.map((o, i) =>
        '<label class="opt"><input type="radio" name="opt" value="' + i + '"><span class="radio"></span><span>' + esc(o) + '</span></label>').join('') + '</div>';
    } else if (q.type === 'numeric') {
      input = '<div class="numeric-row"><input class="input" id="num" inputmode="decimal" autocomplete="off" aria-label="Your answer">' +
        (q.unit ? '<span class="unit">' + esc(q.unit) + '</span>' : '') + '</div>';
    } else {
      input = '<div class="field"><label class="sr-only" for="own">Your answer</label><textarea class="textarea" id="own" placeholder="Write your answer first, then compare with the model answer."></textarea></div>';
    }

    root.innerHTML =
      '<div class="quiz-top"><span>Question ' + (index + 1) + ' of ' + questions.length + '</span><span class="chip">' + esc(DIFF[q.difficulty] || 'Medium') + '</span></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
      '<h2 class="q-prompt" id="prompt" tabindex="-1">' + esc(q.prompt) + '</h2>' + input +
      '<div id="feedback"></div>' +
      '<div class="quiz-actions" id="actions">' + (q.type === 'reveal'
        ? '<button class="btn primary" type="button" id="reveal">Show model answer</button>'
        : '<button class="btn primary" type="button" id="check" disabled>Check answer</button>') + '</div>';

    $('#prompt').focus({ preventScroll: true });
    if (q.type === 'mcq') {
      root.querySelectorAll('input[name="opt"]').forEach(r => r.addEventListener('change', () => {
        root.querySelectorAll('.opt').forEach(o => o.classList.toggle('selected', o.contains(r) && r.checked));
        $('#check').disabled = false;
      }));
    } else if (q.type === 'numeric') {
      const num = $('#num');
      num.addEventListener('input', () => { $('#check').disabled = parseNumber(num.value) === null; });
      num.addEventListener('keydown', e => { if (e.key === 'Enter' && !$('#check').disabled && !checked) { e.preventDefault(); check(); } });
    }
    const checkBtn = $('#check'); if (checkBtn) checkBtn.addEventListener('click', check);
    const revealBtn = $('#reveal'); if (revealBtn) revealBtn.addEventListener('click', reveal);
  }

  function nextButton() {
    const last = index === questions.length - 1;
    $('#actions').innerHTML = '<button class="btn primary" type="button" id="next">' + (last ? 'See results' : 'Next question') + '</button>';
    $('#next').addEventListener('click', () => { if (last) renderResults(); else { index++; renderQuestion(); } });
    $('#next').focus();
  }

  function feedback(ok, extra) {
    const q = questions[index];
    return '<div class="feedback ' + (ok ? 'ok' : 'bad') + '"><h3>' + (ok ? 'Correct' : 'Not quite') + '</h3>' + extra +
      (q.explanation ? '<p style="margin-top:8px">' + esc(q.explanation) + '</p>' : '') + '</div>';
  }

  function check() {
    if (checked) return;
    const q = questions[index];
    checked = true;
    let ok = false, extra = '';

    if (q.type === 'mcq') {
      const chosen = root.querySelector('input[name="opt"]:checked');
      const pick = chosen ? Number(chosen.value) : -1;
      ok = pick === q.answer;
      root.querySelectorAll('.opt').forEach((o, i) => {
        o.classList.add('locked');
        o.querySelector('input').disabled = true;
        if (i === q.answer) o.classList.add('is-correct');
        else if (i === pick) o.classList.add('is-wrong');
        o.classList.remove('selected');
      });
      if (!ok) extra = '<p>The answer is <strong>' + esc(q.options[q.answer]) + '</strong>.</p>';
      results[index] = { ok: ok, given: q.options[pick] };
    } else {
      const val = parseNumber($('#num').value);
      const tol = q.tolerance || 0;
      ok = val !== null && Math.abs(val - q.answer) <= tol;
      $('#num').disabled = true;
      if (!ok) extra = '<p>The answer is <strong>' + esc(q.answer) + (q.unit ? ' ' + esc(q.unit) : '') + '</strong>.</p>';
      if (q.steps && q.steps.length) extra += '<ol>' + q.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>';
      results[index] = { ok: ok, given: $('#num').value };
    }
    $('#feedback').innerHTML = feedback(ok, extra);
    nextButton();
  }

  function reveal() {
    const q = questions[index];
    checked = true;
    $('#own').readOnly = true;
    $('#feedback').innerHTML =
      '<div class="model-answer"><b>Model answer</b><p>' + esc(q.modelAnswer || '') + '</p></div>' +
      (q.explanation ? '<p style="font:400 16px/1.6 var(--font-read);color:var(--ink-2);margin-bottom:18px">' + esc(q.explanation) + '</p>' : '');
    $('#actions').innerHTML = '<span class="label" style="align-self:center">Did your answer cover it?</span>' +
      '<button class="btn" type="button" data-self="1">Yes, I got it</button><button class="btn" type="button" data-self="0">Not yet</button>';
    root.querySelectorAll('[data-self]').forEach(b => b.addEventListener('click', () => {
      results[index] = { ok: b.dataset.self === '1', given: $('#own').value };
      const last = index === questions.length - 1;
      if (last) renderResults(); else { index++; renderQuestion(); }
    }));
  }

  async function renderResults() {
    const total = questions.length;
    const score = results.filter(r => r && r.ok).length;
    const pct = Math.round(score / total * 100);
    const missed = questions.map((q, i) => ({ q: q, r: results[i] })).filter(x => !x.r || !x.r.ok);
    const msg = pct === 100 ? 'Full marks. You have this one down.' : pct >= 70 ? 'Solid. Review the ones you missed below.' : 'A good start. Go back through the key terms, then try the missed problems again.';

    root.innerHTML =
      '<div class="result"><p style="margin:0;color:var(--muted);font-weight:600">Your score</p><div class="big">' + score + ' / ' + total + '</div><p>' + pct + '%. ' + esc(msg) + '</p>' +
      '<div class="quiz-actions" style="justify-content:center">' +
      (missed.length ? '<button class="btn primary" type="button" id="retryMissed">Retry missed problems</button>' : '') +
      '<button class="btn' + (missed.length ? '' : ' primary') + '" type="button" id="retryAll">Take the whole quiz again</button>' +
      '<a class="btn quiet" href="/sets/' + encodeURIComponent(id) + '#practice">Back to study set</a></div></div>' +
      (missed.length ? '<div class="review"><h2>To review</h2>' + missed.map(x => {
        const a = x.q.type === 'mcq' ? x.q.options[x.q.answer] : x.q.type === 'numeric' ? x.q.answer + (x.q.unit ? ' ' + x.q.unit : '') : x.q.modelAnswer;
        return '<article><h3>' + esc(x.q.prompt) + '</h3><p class="ans"><b>Answer:</b> ' + esc(a) + '</p>' + (x.q.explanation ? '<p class="ans" style="margin-top:6px">' + esc(x.q.explanation) + '</p>' : '') + '</article>';
      }).join('') + '</div>' : '');

    const retryAll = $('#retryAll'); if (retryAll) retryAll.addEventListener('click', () => start(set.quiz.questions));
    const retryMissed = $('#retryMissed'); if (retryMissed) retryMissed.addEventListener('click', () => start(missed.map(x => x.q)));
    window.scrollTo({ top: 0 });

    // Only the full quiz counts towards saved scores.
    if (!saved && questions.length === set.quiz.questions.length) {
      saved = true;
      try { await api.saveAttempt(id, { score: score, total: total, answers: results.map((r, i) => ({ question_id: questions[i].id, correct: !!(r && r.ok) })) }); }
      catch (err) { toast('Your score could not be saved: ' + err.message, 'error'); }
    }
  }

  Margin.ready.then(async () => {
    $('#backLink').href = '/sets/' + encodeURIComponent(id);
    try {
      set = await api.getSet(id);
      if (set.status !== 'ready') { location.replace('/sets/' + encodeURIComponent(id)); return; }
      document.title = 'Quiz: ' + set.title + ' — Margin';
      const list = (set.quiz && set.quiz.questions) || [];
      if (!list.length) {
        root.innerHTML = '<div class="empty"><h3>No practice problems yet</h3><p>This study set has no quiz questions.</p><a class="btn primary" href="/sets/' + encodeURIComponent(id) + '">Back to study set</a></div>';
        return;
      }
      start(list);
    } catch (err) {
      root.innerHTML = '<div class="empty"><h3>Could not open this quiz</h3><p>' + esc(err.message) + '</p><a class="btn primary" href="/library">Back to library</a></div>';
    }
  });
})();
