/** Study set page: processing view, then Summary / Key points / Terms / Practice. */
(function () {
  'use strict';
  const { $, $$, api, esc, kindIcon, kindLabel, formatDate, highlight, statusChip, ICONS, toast } = Margin;

  const id = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const root = $('#setRoot');
  const TABS = ['summary', 'points', 'terms', 'practice'];

  function stageList(kind) {
    const textLabel = kind === 'pdf' ? 'Reading the pages' : kind === 'youtube' ? 'Fetching the transcript' : 'Transcribing the audio';
    return [
      { key: 'intake', label: 'Receiving your source' },
      { key: 'text', label: textLabel },
      { key: 'summary', label: 'Writing the summary' },
      { key: 'terms', label: 'Finding key terms' },
      { key: 'quiz', label: 'Building practice problems' }
    ];
  }

  function showError(title, message) {
    root.innerHTML = '<div class="empty"><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p><a class="btn primary" href="/library">Back to library</a></div>';
  }

  /* ---------- processing ---------- */
  function renderProcessing(set, status) {
    const stages = status && status.stages || {};
    root.innerHTML =
      '<div class="set-head"><div><h1>' + esc(set.title) + '</h1><div class="set-meta"><span class="kind" style="width:30px;height:30px;border-radius:8px">' + kindIcon(set.kind) + '</span><span>' + esc(kindLabel(set.kind)) + '</span>' + statusChip('processing') + '</div></div></div>' +
      '<div class="card" style="max-width:600px"><h2 style="font-size:20px">Building your study set</h2>' +
      '<p style="color:var(--muted);margin-top:4px">This page updates by itself. You can leave and come back; it will be in your library.</p>' +
      '<ul class="stages" aria-label="Progress">' + stageList(set.kind).map(s => {
        const state = stages[s.key] || 'pending';
        return '<li class="stage ' + state + '"><span class="dot">' + ICONS.check + '</span>' + esc(s.label) + '</li>';
      }).join('') + '</ul></div>';
  }

  async function poll(set) {
    try {
      const status = await api.setStatus(id);
      if (status.status === 'ready') {
        const full = await api.getSet(id);
        return renderReady(full);
      }
      if (status.status === 'failed') {
        return showError('This study set could not be built', status.message || 'The source could not be processed. Try uploading it again, or use a different file.');
      }
      renderProcessing(set, status);
      setTimeout(() => poll(set), 1500);
    } catch (err) {
      showError('Could not check progress', err.message);
    }
  }

  /* ---------- ready ---------- */
  function renderReady(set) {
    document.title = set.title + ' — Margin';
    const terms = set.terms || [];
    const points = set.key_points || [];
    const questions = (set.quiz && set.quiz.questions) || [];
    const attempts = set.attempts || [];
    const summary = set.summary || { overview: '', sections: [] };

    const source = set.source_label ? '<span>' + esc(set.source_label) + '</span>' : '';
    root.innerHTML =
      '<div class="set-head"><div><h1>' + esc(set.title) + '</h1>' +
      '<div class="set-meta"><span class="kind" style="width:30px;height:30px;border-radius:8px">' + kindIcon(set.kind) + '</span><span>' + esc(kindLabel(set.kind)) + '</span>' + source + '<span>Added ' + esc(formatDate(set.created_at)) + '</span></div></div>' +
      '<div class="set-actions">' +
      (questions.length ? '<a class="btn primary" href="/sets/' + encodeURIComponent(set.id) + '/quiz">Start practice quiz</a>' : '') +
      '<button class="btn" type="button" id="exportBtn">Export notes</button></div></div>' +

      '<div class="tabs" role="tablist" aria-label="Study set sections">' +
      tabBtn('summary', 'Summary') + tabBtn('points', 'Key points (' + points.length + ')') +
      tabBtn('terms', 'Key terms (' + terms.length + ')') + tabBtn('practice', 'Practice') + '</div>' +

      '<section class="panel" id="panel-summary" role="tabpanel" aria-labelledby="tab-summary">' + summaryHTML(summary, terms) + '</section>' +
      '<section class="panel" id="panel-points" role="tabpanel" aria-labelledby="tab-points" hidden>' + pointsHTML(points) + '</section>' +
      '<section class="panel" id="panel-terms" role="tabpanel" aria-labelledby="tab-terms" hidden>' + termsHTML(terms) + '</section>' +
      '<section class="panel" id="panel-practice" role="tabpanel" aria-labelledby="tab-practice" hidden>' + practiceHTML(set, questions, attempts) + '</section>';

    wireTabs();
    wirePoints(set.id, points.length);
    wireTerms(terms);
    wireHighlights();
    $('#exportBtn').addEventListener('click', () => exportNotes(set));
  }

  const tabBtn = (key, label) =>
    '<button class="tab" role="tab" id="tab-' + key + '" data-tab="' + key + '" aria-selected="false" aria-controls="panel-' + key + '">' + esc(label) + '</button>';

  function summaryHTML(summary, terms) {
    if (!summary.overview && !(summary.sections || []).length) return '<p class="empty" style="border:0">No summary was generated for this source.</p>';
    return '<div class="reading">' +
      (terms.length ? '<p class="hint-line">Highlighted words are key terms. Select one to see its definition.</p>' : '') +
      '<p class="overview">' + highlight(summary.overview, terms) + '</p>' +
      (summary.sections || []).map(s => '<h3>' + esc(s.heading) + '</h3><p class="body">' + highlight(s.body, terms) + '</p>').join('') + '</div>';
  }

  function pointsHTML(points) {
    if (!points.length) return '<p class="empty" style="border:0">No key points were generated for this source.</p>';
    return '<div class="points-head"><span>Tick each point once you could explain it without looking.</span><span id="pointsCount"></span></div>' +
      '<div class="points">' + points.map((p, i) =>
        '<label class="point"><input type="checkbox" data-point="' + i + '"><span class="box">' + ICONS.check + '</span><p>' + esc(p) + '</p></label>'
      ).join('') + '</div>';
  }

  function termsHTML(terms) {
    if (!terms.length) return '<p class="empty" style="border:0">No key terms were found in this source.</p>';
    return '<div class="terms-bar"><div class="grow"><input class="input" id="termSearch" type="search" placeholder="Search terms" aria-label="Search terms"></div>' +
      '<label class="check"><input type="checkbox" id="hideDefs"> Hide definitions to test yourself</label></div>' +
      '<div id="termList">' + terms.map(t =>
        '<article class="term" data-key="' + esc(t.term.toLowerCase()) + '"><h3><span class="hl">' + esc(t.term) + '</span></h3><p class="def">' + esc(t.definition) + '</p>' +
        (t.where ? '<span class="where">' + esc(t.where) + '</span>' : '<span></span>') + '</article>'
      ).join('') + '</div><p class="empty" id="noTerms" style="border:0" hidden>No terms match that search.</p>';
  }

  function practiceHTML(set, questions, attempts) {
    if (!questions.length) return '<p class="empty" style="border:0">No practice problems were generated for this source.</p>';
    const types = { mcq: 0, numeric: 0, reveal: 0 };
    questions.forEach(q => { types[q.type] = (types[q.type] || 0) + 1; });
    const parts = [];
    if (types.mcq) parts.push(types.mcq + ' multiple choice');
    if (types.numeric) parts.push(types.numeric + ' worked numeric');
    if (types.reveal) parts.push(types.reveal + ' open-ended');
    return '<div class="practice-box"><h2>' + questions.length + ' practice problems</h2><p>' + esc(parts.join(', ')) + '. Every problem has an explanation, and your score is saved when you finish.</p>' +
      '<a class="btn primary large" href="/sets/' + encodeURIComponent(set.id) + '/quiz">' + (attempts.length ? 'Take it again' : 'Start practice quiz') + '</a></div>' +
      (attempts.length ? '<div class="attempts"><h3 class="section-title" style="font-size:17px">Your attempts</h3><ul>' +
        attempts.map(a => '<li><span>' + esc(formatDate(a.taken_at)) + '</span><strong>' + a.score + ' of ' + a.total + ' (' + Math.round(a.score / a.total * 100) + '%)</strong></li>').join('') + '</ul></div>' : '');
  }

  /* ---------- behaviour ---------- */
  function showTab(key, focus) {
    if (!TABS.includes(key)) key = 'summary';
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    TABS.forEach(k => { const p = $('#panel-' + k); if (p) p.hidden = k !== key; });
    if (location.hash !== '#' + key) history.replaceState(null, '', '#' + key);
  }

  function wireTabs() {
    const tabs = $$('.tab');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => showTab(t.dataset.tab));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        showTab(n.dataset.tab, true);
      });
    });
    showTab(location.hash.replace('#', '') || 'summary');
  }

  function wirePoints(setId, count) {
    const boxes = $$('[data-point]');
    if (!boxes.length) return;
    const key = 'margin-points-' + setId;
    let done = [];
    try { done = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { /* ignore */ }
    const update = () => { $('#pointsCount').textContent = boxes.filter(b => b.checked).length + ' of ' + count + ' understood'; };
    boxes.forEach(b => {
      b.checked = done.includes(Number(b.dataset.point));
      b.addEventListener('change', () => {
        try { localStorage.setItem(key, JSON.stringify(boxes.filter(x => x.checked).map(x => Number(x.dataset.point)))); } catch (e) { /* ignore */ }
        update();
      });
    });
    update();
  }

  function wireTerms(terms) {
    const search = $('#termSearch'), hide = $('#hideDefs'), list = $('#termList');
    if (!search) return;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      $$('.term', list).forEach(el => {
        const t = terms.find(x => x.term.toLowerCase() === el.dataset.key);
        const match = !q || el.dataset.key.indexOf(q) !== -1 || (t && t.definition.toLowerCase().indexOf(q) !== -1);
        el.hidden = !match;
        if (match) shown++;
      });
      $('#noTerms').hidden = shown !== 0;
    });
    hide.addEventListener('change', () => {
      list.classList.toggle('hide-defs', hide.checked);
      $$('.term', list).forEach(el => { el.classList.remove('revealed'); });
    });
    list.addEventListener('click', e => { if (list.classList.contains('hide-defs')) e.target.closest('.term')?.classList.toggle('revealed'); });
  }

  function wireHighlights() {
    const jump = mark => {
      const key = mark.dataset.term;
      showTab('terms');
      const el = $$('#termList .term').find(t => esc(t.dataset.key).toLowerCase() === key || t.dataset.key === key);
      const search = $('#termSearch');
      if (search && search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    };
    $$('#panel-summary mark.hl').forEach(m => {
      m.addEventListener('click', () => jump(m));
      m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(m); } });
    });
  }

  function exportNotes(set) {
    const s = set.summary || {};
    const lines = ['# ' + set.title, '', '## Summary', '', s.overview || ''];
    (s.sections || []).forEach(sec => { lines.push('', '### ' + sec.heading, '', sec.body); });
    lines.push('', '## Key points', '');
    (set.key_points || []).forEach(p => lines.push('- ' + p));
    lines.push('', '## Key terms', '');
    (set.terms || []).forEach(t => lines.push('- **' + t.term + '**: ' + t.definition + (t.where ? ' (' + t.where + ')' : '')));
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (set.title || 'study-set').replace(/[^\w\-]+/g, '-').toLowerCase() + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Notes exported');
  }

  /* ---------- boot ---------- */
  Margin.ready.then(async () => {
    try {
      const set = await api.getSet(id);
      if (set.status === 'failed') return showError('This study set could not be built', set.message || 'The source could not be processed. Try uploading it again, or use a different file.');
      if (set.status !== 'ready') { renderProcessing(set, null); return poll(set); }
      renderReady(set);
    } catch (err) {
      if (err.status === 404) showError('Study set not found', 'It may have been deleted, or the link is wrong.');
      else showError('Could not load this study set', err.message);
    }
  });
})();
