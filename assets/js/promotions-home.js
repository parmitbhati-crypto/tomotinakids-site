(() => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (!['/', '/index.html'].includes(path)) return;

  const loadScript = (src, marker) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-promotion-loader="${marker}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.promotionLoader = marker;
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });

  const ensureStyles = () => {
    if (document.querySelector('link[data-promotions-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/promotions.css';
    link.dataset.promotionsStyle = 'true';
    document.head.appendChild(link);
  };

  const ensureClient = async () => {
    if (!window.supabase) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0', 'supabase');
    }
    if (!window.ENV_SUPABASE_URL) await loadScript('/assets/js/env.js', 'env');
    if (!window.sb) await loadScript('/assets/js/supabaseClient.js', 'client');
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const safeImageUrl = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };

  const createHomeSection = (rows) => {
    if (!rows.length || document.querySelector('[data-home-promotions]')) return;
    const section = document.createElement('section');
    section.className = 'section home-promotions';
    section.dataset.homePromotions = 'true';
    section.innerHTML = `
      <div class="container">
        <div class="section-title">
          <div><p class="kicker">What's happening</p><h2>Latest workshops, events and announcements</h2><p>Current opportunities from Tomotina Kids.</p></div>
          <a class="btn btn-outline" href="/campaigns.html">View all</a>
        </div>
        <div class="home-promotion-grid">
          ${rows.slice(0, 3).map((item) => {
            const image = safeImageUrl(item.image_url);
            return `<article class="card home-promotion-card">
              ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
              <div class="home-promotion-card-copy">
                <span class="promotion-type">${escapeHtml(item.campaign_type)}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.summary)}</p>
                <a class="btn ${item.featured ? 'btn-primary' : 'btn-outline'}" href="/campaign.html?campaign=${encodeURIComponent(item.slug)}">View details</a>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>`;

    const hero = document.querySelector('.hero-home') || document.querySelector('.hero');
    const trust = document.querySelector('.trust-strip');
    const anchor = trust || hero;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(section, anchor.nextSibling);
    else document.querySelector('main')?.prepend(section);
  };

  const createPopup = (item) => {
    if (!item || document.querySelector('[data-promotion-modal]')) return;
    const seenKey = `tomotina_promotion_seen:${item.id}:${item.updated_at || ''}`;
    try {
      if (localStorage.getItem(seenKey)) return;
    } catch (_) {
      // Continue without persistence when browser storage is unavailable.
    }

    const image = safeImageUrl(item.image_url);
    const modal = document.createElement('div');
    modal.className = 'promotion-modal';
    modal.dataset.promotionModal = 'true';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'promotionModalTitle');
    modal.innerHTML = `<article class="promotion-modal-card${image ? ' has-image' : ''}">
      <button class="promotion-modal-close" type="button" aria-label="Close advertisement">×</button>
      ${image ? `<img class="promotion-modal-image" src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}">` : ''}
      <div class="promotion-modal-copy">
        <span class="promotion-type">${escapeHtml(item.campaign_type)}</span>
        <h2 id="promotionModalTitle">${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary)}</p>
        <div class="promotion-modal-actions">
          <a class="btn btn-primary" href="/campaign.html?campaign=${encodeURIComponent(item.slug)}">View details</a>
          <button class="btn btn-outline" type="button" data-promotion-dismiss>Not now</button>
        </div>
      </div>
    </article>`;

    const dismiss = () => {
      try { localStorage.setItem(seenKey, 'dismissed'); } catch (_) {}
      modal.remove();
      document.body.classList.remove('promotion-modal-open');
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('.promotion-modal-close,[data-promotion-dismiss]')) dismiss();
      if (event.target.closest('a')) {
        try { localStorage.setItem(seenKey, 'opened'); } catch (_) {}
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.contains(modal)) dismiss();
    });

    document.body.appendChild(modal);
    document.body.classList.add('promotion-modal-open');
    modal.querySelector('.promotion-modal-close')?.focus();
    window.tomotinaTrack?.('promotion_popup_view', { campaign_slug: item.slug, campaign_type: item.campaign_type });
  };

  const init = async () => {
    try {
      ensureStyles();
      await ensureClient();
      if (!window.sb) return;
      const { data, error } = await window.sb
        .from('promotions')
        .select('id, slug, campaign_type, title, summary, image_url, featured, updated_at')
        .order('featured', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error || !data?.length) return;
      createHomeSection(data);
      window.setTimeout(() => createPopup(data[0]), 550);
    } catch (error) {
      console.warn('Home promotions could not be loaded:', error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
