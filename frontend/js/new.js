/** Create a study set from a video, a PDF or a YouTube link. */
(function () {
  'use strict';
  const { $, $$, api, esc, kindIcon, toast } = Margin;

  const MB = 1024 * 1024, GB = 1024 * MB;
  // Keep these in step with the limits enforced by the backend.
  const KINDS = {
    video: { title: 'Drop your video here', hint: 'MP4, MKV, AVI, MOV or WebM, up to 200 MB', ext: ['mp4', 'mkv', 'avi', 'mov', 'webm'], max: 200 * MB, maxLabel: '200 MB' }
  };

  const form = $('#createForm'), fileInput = $('#file'), dz = $('#dropzone');
  const formError = $('#formError'), submit = $('#submitBtn');
  let file = null;

  const kind = () => 'video';

  function showError(msg) { formError.textContent = msg; formError.hidden = !msg; if (msg) formError.scrollIntoView({ block: 'nearest' }); }

  function fmtSize(bytes) {
    return bytes >= GB ? (bytes / GB).toFixed(2) + ' GB' : (bytes / MB).toFixed(1) + ' MB';
  }

  function applyKind() {
    const k = kind();
    $('#dropTitle').textContent = KINDS[k].title;
    $('#dropHint').textContent = KINDS[k].hint;
    fileInput.accept = KINDS[k].ext.map(e => '.' + e).join(',');
    if (file && !KINDS[k].ext.includes(extOf(file.name))) setFile(null);
    showError('');
  }

  const extOf = name => (name.split('.').pop() || '').toLowerCase();

  function setFile(f) {
    file = f;
    $('#fileChosen').hidden = !f;
    if (f) {
      $('#fileName').textContent = f.name;
      $('#fileSize').textContent = fmtSize(f.size);
      $('#fileIcon').innerHTML = kindIcon(kind());
    } else {
      fileInput.value = '';
    }
  }

  function pickFile(f) {
    if (!f) return;
    const k = kind();
    if (!KINDS[k].ext.includes(extOf(f.name))) {
      showError('That file type is not supported here. Use ' + KINDS[k].ext.map(e => e.toUpperCase()).join(', ') + '.');
      return;
    }
    if (f.size > KINDS[k].max) {
      showError('That file is ' + fmtSize(f.size) + '. The limit is ' + KINDS[k].maxLabel + '.');
      return;
    }
    showError('');
    setFile(f);
  }

  $('#browse').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => pickFile(fileInput.files[0]));
  $('#clearFile').addEventListener('click', () => setFile(null));

  ['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => pickFile(e.dataTransfer.files[0]));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    showError('');
    const data = new FormData();
    if (!file) return showError('Choose a video file first.');
    data.append('file', file, file.name);
    data.append('title', $('#title').value.trim());

    submit.disabled = true;
    const box = $('#uploading'), bar = $('#bar'), text = $('#uploadText');
    box.hidden = false;
    text.textContent = 'Uploading…';

    try {
      const res = await api.uploadVideo(data, p => {
        const pct = Math.round(p * 100);
        bar.style.width = pct + '%';
        box.firstElementChild.setAttribute('aria-valuenow', pct);
        text.textContent = pct < 100 ? 'Uploading… ' + pct + '%' : 'Upload complete. Processing video…';
      });
      if (res.error) throw new Error(res.error);
      $('#transcriptText').textContent = res.transcript;
      $('#transcriptResult').hidden = false;
      box.hidden = true;
      submit.disabled = false;
    } catch (err) {
      showError(err.message);
      box.hidden = true;
      bar.style.width = '0';
      submit.disabled = false;
    }
  });

  Margin.ready.then(() => {
    applyKind();
  });
})();
