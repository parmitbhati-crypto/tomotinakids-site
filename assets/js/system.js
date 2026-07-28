(() => {
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  async function loadHealth() {
    const message = byId('systemMessage');
    message.hidden = true;
    const profile = await getMyProfile();
    if (profile?.role !== 'admin') {
      window.location.href = '/portal/day.html';
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error, count } = await window.sb
      .from('portal_client_errors')
      .select('created_at,page,kind,message', { count: 'exact' })
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      byId('healthStatus').textContent = 'Needs attention';
      byId('systemErrors').innerHTML = '<tr><td colspan="4">Monitoring data is unavailable.</td></tr>';
      message.textContent = 'Unable to load system monitoring. Check the Phase 4 migration status.';
      message.dataset.type = 'error';
      message.hidden = false;
      return;
    }

    const rows = data || [];
    byId('errorCount').textContent = String(count || 0);
    byId('lastError').textContent = rows[0] ? new Date(rows[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None';
    byId('healthStatus').textContent = (count || 0) === 0 ? 'Healthy' : 'Review';
    byId('systemErrors').innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(new Date(row.created_at).toLocaleString())}</td>
        <td>${escapeHtml(row.page)}</td>
        <td><span class="status-pill">${escapeHtml(row.kind)}</span></td>
        <td>${escapeHtml(row.message)}</td>
      </tr>`).join('') : '<tr><td colspan="4"><div class="portal-state portal-state-compact"><strong>Everything looks healthy</strong><span>No portal errors were recorded in the last 24 hours.</span></div></td></tr>';
  }

  byId('refreshHealth')?.addEventListener('click', loadHealth);
  loadHealth();
})();
