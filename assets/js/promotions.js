(() => {
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

  const renderFeed = (rows) => {
    const feed = document.querySelector('[data-promotion-feed]');
    if (!feed || !rows.length) return;
    feed.innerHTML = rows.map((item) => `
      <article class="promotion-card card">
        <span class="promotion-type">${escapeHtml(item.campaign_type)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        ${item.audience ? `<p class="promotion-audience">${escapeHtml(item.audience)}</p>` : ''}
        <a class="btn ${item.featured ? 'btn-primary' : 'btn-outline'}" href="campaign.html?campaign=${encodeURIComponent(item.slug)}">View details</a>
      </article>`).join('');
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
    set('[data-promotion-details]', item.details);
    set('[data-promotion-audience]', item.audience);
    set('[data-promotion-location]', item.location);
    document.querySelectorAll('[data-promotion-cta]').forEach((link) => {
      link.textContent = item.cta_label || 'Enquire now';
      link.href = safeUrl(item.cta_url);
    });
    document.title = `${item.title} | Tomotina Kids`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', item.summary);
    window.tomotinaTrack?.('promotion_view', { campaign_slug: item.slug, campaign_type: item.campaign_type });
  };

  const load = async () => {
    if (!window.sb) return;
    const slug = new URLSearchParams(window.location.search).get('campaign');
    const query = window.sb.from('promotions').select('*').order('featured', { ascending: false }).order('starts_at', { ascending: false });
    const { data, error } = slug ? await query.eq('slug', slug).maybeSingle() : await query;
    if (error || !data) return;
    if (slug) hydrateDetail(data);
    else renderFeed(data);
  };
  load();
})();
