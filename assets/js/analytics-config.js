// Optional external analytics adapter.
// Leave IDs blank until Tomotina approves the relevant Google/Meta accounts.
window.TOMOTINA_ANALYTICS = {
  googleTagId: '',
  metaPixelId: ''
};

(() => {
  const config = window.TOMOTINA_ANALYTICS || {};
  const choiceKey = 'tomotina_analytics_consent';

  const loadProviders = () => {
    if (localStorage.getItem(choiceKey) !== 'granted') return;
    if (config.googleTagId && !window.gtag) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.googleTagId)}`;
      document.head.appendChild(script);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', config.googleTagId, { anonymize_ip: true });
    }
    if (config.metaPixelId && !window.fbq) {
      window.fbq = function () { window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments); };
      window.fbq.queue = [];
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
      window.fbq('init', config.metaPixelId);
      window.fbq('track', 'PageView');
    }
  };

  if (localStorage.getItem(choiceKey)) {
    loadProviders();
    return;
  }

  const banner = document.createElement('aside');
  banner.className = 'consent-banner';
  banner.setAttribute('aria-label', 'Analytics preferences');
  banner.innerHTML = '<div><strong>Your privacy choices</strong><p>Essential site features always work. Optional analytics help us understand which campaigns lead families to useful support.</p></div><div class="consent-actions"><button class="btn btn-outline" type="button" data-consent="denied">Essential only</button><button class="btn btn-primary" type="button" data-consent="granted">Allow analytics</button></div>';
  document.body.appendChild(banner);
  banner.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-consent]')?.dataset.consent;
    if (!choice) return;
    localStorage.setItem(choiceKey, choice);
    banner.remove();
    loadProviders();
  });
})();
