(() => {
  const form = document.getElementById('promotionForm');
  const list = document.getElementById('promotionList');
  const message = document.getElementById('promotionMessage');
  const preview = document.getElementById('promotionImagePreview');
  const previewImage = preview.querySelector('img');
  const removeImageButton = document.getElementById('removePromotionImage');
  const imageInput = form.elements.image_file;
  const imageUrlInput = form.elements.image_url;
  const bucket = 'promotion-images';
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maxImageBytes = 5 * 1024 * 1024;
  let rows = [];
  let previewObjectUrl = '';
  let removeExistingImage = false;

  const show = (text, type = 'info') => {
    message.hidden = !text;
    message.textContent = text;
    message.dataset.type = type;
  };

  const clean = (value) => value === '' ? null : value;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const dateForInput = (value) => value ? new Date(new Date(value).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16) : '';
  const istInputToIso = (value) => value ? new Date(`${value}:00+05:30`).toISOString() : null;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
  const labelForType = (value = '') => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Promotion';
  const slugify = (value = '') => value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'promotion';

  const storagePathFromUrl = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const index = url.pathname.indexOf(marker);
      return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : '';
    } catch (_) {
      return '';
    }
  };

  const clearObjectPreview = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
  };

  const setPreview = (url) => {
    clearObjectPreview();
    if (!url) {
      preview.hidden = true;
      previewImage.removeAttribute('src');
      return;
    }
    previewImage.src = url;
    preview.hidden = false;
  };

  const setFilePreview = (file) => {
    clearObjectPreview();
    if (!file) return setPreview(imageUrlInput.value);
    previewObjectUrl = URL.createObjectURL(file);
    previewImage.src = previewObjectUrl;
    preview.hidden = false;
  };

  const validateImage = (file) => {
    if (!allowedTypes.has(file.type)) throw new Error('Upload a JPG, PNG, or WebP image.');
    if (file.size > maxImageBytes) throw new Error('The photo must be 5 MB or smaller.');
  };

  const uploadImage = async (file) => {
    validateImage(file);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const folder = new Date().getUTCFullYear();
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await window.sb.storage.from(bucket).upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    const { data } = window.sb.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const removeStoredImage = async (url) => {
    const path = storagePathFromUrl(url);
    if (!path) return;
    const { error } = await window.sb.storage.from(bucket).remove([path]);
    if (error) console.warn('Unable to remove old promotion image:', error);
  };

  const formatEndDate = (value) => {
    if (!value) return 'No end date';
    return `${new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value))} IST`;
  };

  const render = () => {
    if (!rows.length) {
      list.innerHTML = '<div class="portal-empty">No advertisements yet. Use the form to create the first one.</div>';
      return;
    }

    list.innerHTML = rows.map((item) => {
      const image = item.image_url
        ? `<img class="promotion-admin-thumb" src="${escapeHtml(item.image_url)}" alt="">`
        : '<div class="promotion-admin-thumb is-empty">No photo</div>';
      return `<article class="promotion-admin-item">
        <div class="promotion-admin-main">
          ${image}
          <div class="promotion-admin-copy">
            <div><span class="status-pill ${item.published ? 'is-published' : ''}">${item.published ? 'Published' : 'Draft'}</span><small>${escapeHtml(item.campaign_type)}</small></div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.summary)}</p>
            <div class="promotion-admin-meta"><span>Ends: ${escapeHtml(formatEndDate(item.ends_at))}</span><span>URL: /campaign.html?campaign=${escapeHtml(item.slug)}</span></div>
            <a href="/campaign.html?campaign=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener">Preview landing page</a>
          </div>
        </div>
        <div class="promotion-admin-actions"><button class="btn" data-edit="${item.id}" type="button">Edit</button><button class="btn danger" data-delete="${item.id}" type="button">Delete</button></div>
      </article>`;
    }).join('');
  };

  const load = async () => {
    const { data, error } = await window.sb.from('promotions').select('*').order('updated_at', { ascending: false });
    if (error) {
      show('Advertisements could not be loaded. Please refresh and try again.', 'error');
      list.innerHTML = '<div class="portal-empty">Unable to load advertisements.</div>';
      return;
    }
    rows = data || [];
    render();
  };

  const reset = () => {
    form.reset();
    form.elements.id.value = '';
    form.elements.slug.value = '';
    form.elements.image_url.value = '';
    form.elements.location.value = 'Tomotina Kids, Sector 40, Gurugram';
    removeExistingImage = false;
    clearObjectPreview();
    setPreview('');
    show('');
  };

  const saveValues = async (values, id) => {
    if (id) return window.sb.from('promotions').update(values).eq('id', id);
    return window.sb.from('promotions').insert(values);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    show('');

    const submitButton = form.querySelector('[type="submit"]');
    const id = form.elements.id.value;
    const existing = rows.find((row) => row.id === id);
    const file = imageInput.files?.[0] || null;
    let uploadedUrl = '';

    submitButton.disabled = true;
    submitButton.textContent = file ? 'Uploading and saving…' : 'Saving…';

    try {
      if (file) uploadedUrl = await uploadImage(file);

      const title = form.elements.title.value.trim();
      const campaignType = form.elements.campaign_type.value;
      const published = form.elements.published.checked;
      const originalSlug = form.elements.slug.value.trim();
      const values = {
        campaign_type: campaignType,
        slug: originalSlug || slugify(title),
        eyebrow: labelForType(campaignType),
        title,
        summary: form.elements.summary.value.trim(),
        details: form.elements.details.value.trim(),
        audience: '',
        location: form.elements.location.value.trim() || 'Tomotina Kids, Sector 40, Gurugram',
        starts_at: null,
        ends_at: istInputToIso(form.elements.ends_at.value),
        cta_label: 'Enquire now',
        cta_url: '/contact.html#enquiry',
        image_url: uploadedUrl || (removeExistingImage ? null : clean(imageUrlInput.value)),
        published,
        featured: published
      };

      if (!values.ends_at) throw new Error('Choose the advertising end date and time.');
      if (new Date(values.ends_at).getTime() <= Date.now()) throw new Error('The advertising end date must be in the future.');

      let { error } = await saveValues(values, id);
      if (error?.code === '23505' && !id) {
        values.slug = `${slugify(title)}-${Date.now().toString(36).slice(-5)}`;
        ({ error } = await saveValues(values, id));
      }
      if (error) throw error;

      if (existing?.image_url && existing.image_url !== values.image_url) {
        await removeStoredImage(existing.image_url);
      }

      const successMessage = id ? 'Advertisement updated.' : 'Advertisement created.';
      reset();
      show(successMessage, 'success');
      await load();
    } catch (error) {
      if (uploadedUrl) await removeStoredImage(uploadedUrl);
      console.error('Promotion save failed:', error);
      show(error?.message || 'The advertisement could not be saved.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save advertisement';
    }
  });

  list.addEventListener('click', async (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;

    if (editId) {
      const item = rows.find((row) => row.id === editId);
      if (!item) return;
      form.elements.id.value = item.id;
      form.elements.slug.value = item.slug || '';
      form.elements.image_url.value = item.image_url || '';
      form.elements.campaign_type.value = item.campaign_type || 'event';
      form.elements.title.value = item.title || '';
      form.elements.summary.value = item.summary || '';
      form.elements.details.value = item.details || '';
      form.elements.location.value = item.location || 'Tomotina Kids, Sector 40, Gurugram';
      form.elements.ends_at.value = dateForInput(item.ends_at);
      form.elements.published.checked = Boolean(item.published);
      imageInput.value = '';
      removeExistingImage = false;
      setPreview(item.image_url || '');
      show('Editing this advertisement. Save when your changes are complete.', 'info');
      form.scrollIntoView({ behavior: 'smooth' });
    }

    if (deleteId && window.confirm('Delete this advertisement? This cannot be undone.')) {
      const item = rows.find((row) => row.id === deleteId);
      const { error } = await window.sb.from('promotions').delete().eq('id', deleteId);
      if (error) return show(error.message, 'error');
      if (item?.image_url) await removeStoredImage(item.image_url);
      show('Advertisement deleted.', 'success');
      await load();
    }
  });

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0] || null;
    if (!file) return setPreview(imageUrlInput.value);
    try {
      validateImage(file);
      removeExistingImage = false;
      setFilePreview(file);
      show('Photo selected. It will upload when you save the advertisement.', 'info');
    } catch (error) {
      imageInput.value = '';
      show(error.message, 'error');
    }
  });

  removeImageButton.addEventListener('click', () => {
    imageInput.value = '';
    imageUrlInput.value = '';
    removeExistingImage = true;
    setPreview('');
    show('The photo will be removed when you save the advertisement.', 'info');
  });

  document.getElementById('resetPromotion').addEventListener('click', reset);
  document.getElementById('refreshPromotions').addEventListener('click', load);
  requireAuth().then((user) => user && load());
})();
