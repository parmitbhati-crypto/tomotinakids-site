(() => {
  const form = document.querySelector('[data-job-application-form]');
  if (!form) return;
  const submit = form.querySelector('[data-job-submit]');
  const status = form.querySelector('[data-job-status]');
  const show = (message, type) => { status.hidden = false; status.textContent = message; status.dataset.type = type; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true; submit.textContent = 'Submitting…'; show('Submitting your application…', 'info');
    const data = new FormData(form);
    const payload = {
      full_name: String(data.get('full_name') || '').trim(), email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim() || null, role_interest: String(data.get('role_interest') || '').trim(),
      experience: String(data.get('experience') || '').trim() || null, resume_url: String(data.get('resume_url') || '').trim() || null,
      consent: data.get('consent') === 'on', attribution: window.tomotinaAttribution?.() || {}
    };
    if (payload.resume_url && !/^https:\/\//i.test(payload.resume_url)) {
      submit.disabled = false; submit.textContent = 'Submit Application';
      show('Please use a secure resume link beginning with https://.', 'error'); return;
    }
    try {
      if (!window.sb) throw new Error('Application service unavailable');
      const { error } = await window.sb.from('job_applications').insert(payload);
      if (error) throw error;
      form.reset(); show('Thank you. Your application has been received.', 'success');
      window.tomotinaTrack?.('job_application_submit', { role_interest: payload.role_interest });
    } catch (_) { show('We could not submit your application. Please try again or contact the centre.', 'error'); }
    finally { submit.disabled = false; submit.textContent = 'Submit Application'; }
  });
})();
