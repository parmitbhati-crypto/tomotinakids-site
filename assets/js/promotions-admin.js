(() => {
  const form = document.getElementById('promotionForm');
  const list = document.getElementById('promotionList');
  const message = document.getElementById('promotionMessage');
  let rows = [];

  const show = (text, type = 'info') => {
    message.hidden = !text;
    message.textContent = text;
    message.dataset.type = type;
  };
  const clean = (value) => value === '' ? null : value;
  const dateForInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  const render = () => {
    if (!rows.length) {
      list.innerHTML = '<div class="portal-empty">No promotions yet. Use the form to create the first one.</div>';
      return;
    }
    list.innerHTML = rows.map((item) => `<article class="promotion-admin-item"><div><span class="status-pill ${item.published ? 'is-published' : ''}">${item.published ? 'Published' : 'Draft'}</span><small>${escapeHtml(item.campaign_type)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><a href="/campaign.html?campaign=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener">Preview landing page</a></div><div class="promotion-admin-actions"><button class="btn" data-edit="${item.id}" type="button">Edit</button><button class="btn danger" data-delete="${item.id}" type="button">Delete</button></div></article>`).join('');
  };

  const load = async () => {
    const { data, error } = await window.sb.from('promotions').select('*').order('updated_at', { ascending: false });
    if (error) {
      show('Promotions are unavailable until the Phase 5 database migration is deployed.', 'error');
      list.innerHTML = '<div class="portal-empty">Database setup required.</div>';
      return;
    }
    rows = data || [];
    render();
  };

  const reset = () => {
    form.reset();
    form.elements.id.value = '';
    form.elements.location.value = 'Tomotina Kids, Sector 40, Gurugram';
    form.elements.cta_label.value = 'Enquire now';
    form.elements.cta_url.value = '/contact.html#enquiry';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const id = values.id;
    delete values.id;
    values.published = form.elements.published.checked;
    values.featured = form.elements.featured.checked;
    values.starts_at = clean(values.starts_at);
    values.ends_at = clean(values.ends_at);
    values.image_url = clean(values.image_url);
    const query = id ? window.sb.from('promotions').update(values).eq('id', id) : window.sb.from('promotions').insert(values);
    const { error } = await query;
    if (error) return show(error.message, 'error');
    show(id ? 'Promotion updated.' : 'Promotion created.', 'success');
    reset();
    await load();
  });

  list.addEventListener('click', async (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (editId) {
      const item = rows.find((row) => row.id === editId);
      if (!item) return;
      Object.entries(item).forEach(([key, value]) => {
        if (!form.elements[key] || ['published', 'featured'].includes(key)) return;
        form.elements[key].value = ['starts_at', 'ends_at'].includes(key) ? dateForInput(value) : (value ?? '');
      });
      form.elements.published.checked = item.published;
      form.elements.featured.checked = item.featured;
      form.scrollIntoView({ behavior: 'smooth' });
    }
    if (deleteId && window.confirm('Delete this promotion? This cannot be undone.')) {
      const { error } = await window.sb.from('promotions').delete().eq('id', deleteId);
      if (error) return show(error.message, 'error');
      show('Promotion deleted.', 'success');
      await load();
    }
  });

  document.getElementById('resetPromotion').addEventListener('click', reset);
  document.getElementById('refreshPromotions').addEventListener('click', load);
  requireAuth().then((user) => user && load());
})();
