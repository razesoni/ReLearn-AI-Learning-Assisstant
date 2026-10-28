/** Library: search, filter, sort, delete. */
(function () {
  'use strict';
  const { $, $$, api, esc, setRow, toast } = Margin;

  let items = [];
  let kind = 'all';
  let pendingDelete = null;

  const rows = $('#rows'), empty = $('#empty'), dialog = $('#confirm');

  function view() {
    const q = $('#q').value.trim().toLowerCase();
    let list = items.filter(i => (kind === 'all' || i.kind === kind) && (!q || i.title.toLowerCase().indexOf(q) !== -1));
    const sort = $('#sort').value;
    list.sort((a, b) => {
      if (sort === 'old') return a.created_at.localeCompare(b.created_at);
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'score') return (b.best_score == null ? -1 : b.best_score) - (a.best_score == null ? -1 : a.best_score);
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }

  function render() {
    const list = view();
    if (!items.length) {
      rows.hidden = true; empty.hidden = false;
      empty.innerHTML = '<h3>Your library is empty</h3><p>Study sets you make will be listed here.</p><a class="btn primary" href="/new">Make a study set</a>';
      return;
    }
    if (!list.length) {
      rows.hidden = true; empty.hidden = false;
      empty.innerHTML = '<h3>No matches</h3><p>Nothing in your library fits that search or filter.</p><button class="btn" id="clear" type="button">Clear filters</button>';
      $('#clear').addEventListener('click', () => {
        $('#q').value = ''; kind = 'all'; syncSeg(); render();
      });
      return;
    }
    empty.hidden = true; rows.hidden = false;
    rows.innerHTML = list.map(i =>
      '<div class="lib-item">' + setRow(i) +
      '<button class="icon-btn" type="button" data-delete="' + esc(i.id) + '" aria-label="Delete ' + esc(i.title) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'
    ).join('');
  }

  function syncSeg() {
    $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
  }

  $$('.seg button').forEach(b => b.addEventListener('click', () => { kind = b.dataset.kind; syncSeg(); render(); }));
  $('#q').addEventListener('input', render);
  $('#sort').addEventListener('change', render);

  rows.addEventListener('click', e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    pendingDelete = items.find(i => i.id === btn.dataset.delete);
    if (!pendingDelete) return;
    $('#confirmText').textContent = '“' + pendingDelete.title + '” will be removed along with its terms, quiz and your scores. This cannot be undone.';
    dialog.showModal();
  });

  $('#cancelDelete').addEventListener('click', () => dialog.close());
  $('#doDelete').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    dialog.close();
    try {
      await api.deleteSet(target.id);
      items = items.filter(i => i.id !== target.id);
      render();
      toast('Study set deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  Margin.ready.then(async () => {
    try {
      const data = await api.listSets();
      items = data.items || [];
      render();
    } catch (err) {
      rows.hidden = true; empty.hidden = false;
      empty.innerHTML = '<h3>Could not load your library</h3><p>' + esc(err.message) + '</p><button class="btn" onclick="location.reload()">Try again</button>';
    }
  });
})();
