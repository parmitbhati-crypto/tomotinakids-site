// Sanitized portal error reporting. Never sends form values, stack traces, or user data.
(() => {
  const sent = new Set();

  const sanitize = (value) => {
    const message = String(value || 'Unexpected portal error')
      .replace(/https?:\/\/\S+/gi, '[url]')
      .replace(/[A-Fa-f0-9]{8}-[A-Fa-f0-9-]{27,}/g, '[id]')
      .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email]')
      .slice(0, 500);
    return message || 'Unexpected portal error';
  };

  window.portalReportError = async (kind = 'application', value = 'Unexpected portal error') => {
    if (!window.sb) return;
    const message = sanitize(value?.message || value);
    const signature = `${kind}:${window.location.pathname}:${message}`;
    if (sent.has(signature)) return;
    sent.add(signature);

    try {
      const { data } = await window.sb.auth.getUser();
      if (!data?.user) return;
      await window.sb.from('portal_client_errors').insert({
        actor_id: data.user.id,
        page: window.location.pathname.slice(0, 200),
        kind: ['error', 'unhandledrejection', 'application'].includes(kind) ? kind : 'application',
        message
      });
    } catch {
      // Monitoring must never interrupt portal work.
    }
  };

  window.addEventListener('error', (event) => {
    window.portalReportError('error', event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.portalReportError('unhandledrejection', event.reason);
  });
})();
