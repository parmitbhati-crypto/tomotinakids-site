(() => {
  const ensureStyles = () => {
    if (document.querySelector('link[data-promotions-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/promotions.css';
    link.dataset.promotionsStyle = 'true';
    document.head.appendChild(link);
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const safeUrl = (value, fallback = '/contact.html#enquiry') => {
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:', 'tel:', 'mailto:'].includes(url.protocol) ? url.href : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const safeImageUrl = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };

  const renderFeed = (rows) => {
    const feed = document.querySelector('[data-promotion-feed]');
    if (!feed || !rows.length) return;
    feed.innerHTML = rows.map((item) => {
      const image = safeImageUrl(item.image_url);
      return `
        <article class="promotion-card card">
          ${image ? `<img class="promotion-card-media" src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
          <span class="promotion-type">${escapeHtml(item.campaign_type)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          ${item.audience ? `<p class="promotion-audience">${escapeHtml(item.audience)}</p>` : ''}
          <a class="btn ${item.featured ? 'btn-primary' : 'btn-outline'}" href="campaign.html?campaign=${encodeURIComponent(item.slug)}">View details</a>
        </article>`;
    }).join('');
  };

  const hydrateDetail = (item) => {
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node && value) node.textContent = value;
    };
    set('[data-promotion-eyebrow]', item.eyebrow || item.campaign_type);
    set('[data-promotion-title]', item.title);
    set('[data-promotion-summary]', item.summary);
    set('[data-promotion-detail-title]', item.title);
    set('[data-promotion-details]', item.details || item.summary);
    set('[data-promotion-audience]', item.audience);
    set('[data-promotion-location]', item.location);
    document.querySelectorAll('[data-promotion-cta]').forEach((link) => {
      link.textContent = item.cta_label || 'Enquire now';
      link.href = safeUrl(item.cta_url);
    });

    const image = safeImageUrl(item.image_url);
    if (image) {
      const proof = document.querySelector('.campaign-proof');
      if (proof && !proof.querySelector('.campaign-feature-image')) {
        const img = document.createElement('img');
        img.className = 'campaign-feature-image';
        img.src = image;
        img.alt = item.title || 'Tomotina Kids advertisement';
        proof.prepend(img);
      }
      document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    }

    document.title = `${item.title} | Tomotina Kids`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', item.summary);
    window.tomotinaTrack?.('promotion_view', { campaign_slug: item.slug, campaign_type: item.campaign_type });
  };

  const load = async () => {
    if (!window.sb) return;
    ensureStyles();
    const slug = new URLSearchParams(window.location.search).get('campaign');
    const query = window.sb.from('promotions').select('*').order('featured', { ascending: false }).order('updated_at', { ascending: false });
    const { data, error } = slug ? await query.eq('slug', slug).maybeSingle() : await query;
    if (error || !data) return;
    if (slug) hydrateDetail(data);
    else renderFeed(data);
  };

  load();
})();
