/** Login and sign-up forms. */
(function () {
  'use strict';
  const { $, $$, api, safeNext } = Margin;

  const form = $('#authForm');
  if (!form) return;
  const mode = form.dataset.mode;
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));
  const formError = $('#formError');
  const submit = $('#submitBtn');
  const label = submit.textContent;

  // keep ?next= when switching between login and sign up
  $$('[data-keep-next]').forEach(a => {
    if (params.get('next')) a.href += '?next=' + encodeURIComponent(params.get('next'));
  });

  $$('[data-reveal]').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.reveal);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));

  function setError(name, message) {
    const input = form.elements[name];
    const slot = $('[data-error-for="' + name + '"]');
    if (slot) slot.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(values) {
    let ok = true;
    ['name', 'email', 'password'].forEach(n => setError(n, ''));
    if (mode === 'signup' && !values.name) { setError('name', 'Enter your name.'); ok = false; }
    if (!values.email) { setError('email', 'Enter your email.'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) { setError('email', 'That email address does not look right.'); ok = false; }
    if (!values.password) { setError('password', 'Enter your password.'); ok = false; }
    else if (mode === 'signup' && values.password.length < 8) { setError('password', 'Use at least 8 characters.'); ok = false; }
    return ok;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    formError.hidden = true;
    const values = {
      name: form.elements.name ? form.elements.name.value.trim() : '',
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    };
    if (!validate(values)) {
      const bad = form.querySelector('[aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = mode === 'signup' ? 'Creating account…' : 'Logging in…';
    try {
      if (mode === 'signup') await api.register(values);
      else await api.login({ email: values.email, password: values.password });
      location.href = next;
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
      submit.disabled = false;
      submit.textContent = label;
    }
  });
})();
