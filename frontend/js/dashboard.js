/** Dashboard: greeting, recent study sets, study log. */
(function () {
  'use strict';
  const { $, $$, api, esc, setRow, kindIcon, toast } = Margin;

  ['video', 'pdf', 'youtube'].forEach(k => { const el = $('#ico-' + k); if (el) el.innerHTML = kindIcon(k); });

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  Margin.ready.then(async user => {
    $('#greeting').textContent = greeting() + ', ' + String(user.name).split(/\s+/)[0];
    try {
      const data = await api.listSets();
      renderRecent(data.items || []);
      renderStats(data.stats || {});
    } catch (err) {
      $('#recent').innerHTML = '<div class="empty" style="border:0"><h3>Could not load your study sets</h3><p>' + esc(err.message) + '</p><button class="btn" onclick="location.reload()">Try again</button></div>';
      toast(err.message, 'error');
    }
  });

  function renderRecent(items) {
    const box = $('#recent');
    if (!items.length) {
      box.outerHTML = '<div class="empty" id="recent"><h3>No study sets yet</h3><p>Upload a lecture, a PDF or a YouTube link and your first summary, key terms and quiz will appear here.</p><a class="btn primary" href="/new">Make your first study set</a></div>';
      return;
    }
    box.innerHTML = items.slice(0, 5).map(i => setRow(i)).join('');
  }

  function renderStats(s) {
    const set = (k, v) => { const el = $('[data-stat="' + k + '"]'); if (el) el.textContent = v; };
    set('sets', s.sets || 0);
    set('terms', s.terms || 0);
    set('quizzes_taken', s.quizzes_taken || 0);
    set('avg_score', s.avg_score == null ? '–' : s.avg_score + '%');

    const scores = s.recent_scores || [];
    const holder = $('#scoreBars');
    if (!scores.length) {
      holder.innerHTML = '<p>Take a practice quiz and your scores will show up here.</p>';
      return;
    }
    holder.innerHTML = '<div class="bars" role="img" aria-label="Recent quiz scores: ' + scores.map(v => v + ' percent').join(', ') + '">' +
      scores.map(v => '<div class="bar" style="height:' + Math.max(4, v) + '%"><span>' + v + '</span></div>').join('') + '</div>';
  }
})();
