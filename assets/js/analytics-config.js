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

  if (!localStorage.getItem(choiceKey)) {
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
  } else {
    loadProviders();
  }

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (['/', '/index.html'].includes(path) && !document.querySelector('script[data-home-promotions-loader]')) {
    const script = document.createElement('script');
    script.src = '/assets/js/promotions-home.js';
    script.dataset.homePromotionsLoader = 'true';
    document.body.appendChild(script);
  }
})();

// Free assessment conversion flow.
(() => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isPortal = path.includes('/portal/');
  const isThankYouPage = path === '/thankyou' || path === '/thankyou.html';
  if (isPortal || isThankYouPage) return;

  // Redirect only after the existing Supabase form handler reports success.
  document.querySelectorAll('[data-enquiry-status]').forEach((statusEl) => {
    const observer = new MutationObserver(() => {
      const message = (statusEl.textContent || '').trim().toLowerCase();
      if (message.includes('submitted successfully')) {
        window.location.assign('/thankyou');
      }
    });
    observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
  });

  const popupKey = 'tomotina_free_assessment_popup_seen';
  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(popupKey) === '1';
  } catch (_) {
    // The popup can still work when session storage is unavailable.
  }
  if (alreadySeen) return;

  const style = document.createElement('style');
  style.textContent = `
    .assessment-modal-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(20,38,34,.62);backdrop-filter:blur(5px);animation:assessmentFade .22s ease-out}
    .assessment-modal{position:relative;width:min(560px,100%);background:#fff;border-radius:26px;padding:34px;box-shadow:0 28px 90px rgba(0,0,0,.24);text-align:center;border:1px solid rgba(15,118,110,.14)}
    .assessment-modal-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:#e8f4ef;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
    .assessment-modal h2{margin:16px 0 10px;font-family:'Newsreader',serif;font-size:clamp(30px,5vw,42px);line-height:1.05;color:#20342f}
    .assessment-modal p{margin:0 auto;color:#667771;line-height:1.65;max-width:450px;font-size:16px}
    .assessment-modal-actions{margin-top:24px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
    .assessment-modal-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:#f1f4f2;color:#40524d;font-size:22px;cursor:pointer}
    .assessment-modal-close:focus-visible,.assessment-modal a:focus-visible{outline:3px solid rgba(15,118,110,.35);outline-offset:3px}
    @keyframes assessmentFade{from{opacity:0}to{opacity:1}}
    @media(max-width:560px){.assessment-modal{padding:30px 22px 24px}.assessment-modal-actions{flex-direction:column}.assessment-modal-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);

  let popup = null;
  const closePopup = () => {
    if (!popup) return;
    popup.remove();
    popup = null;
    document.body.style.overflow = '';
    try { sessionStorage.setItem(popupKey, '1'); } catch (_) {}
  };

  window.setTimeout(() => {
    if (document.querySelector('[data-assessment-modal]')) return;

    popup = document.createElement('div');
    popup.className = 'assessment-modal-backdrop';
    popup.dataset.assessmentModal = 'true';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-labelledby', 'assessment-modal-title');
    popup.innerHTML = `
      <div class="assessment-modal">
        <button class="assessment-modal-close" type="button" aria-label="Close assessment invitation">×</button>
        <span class="assessment-modal-badge">Free consultation</span>
        <h2 id="assessment-modal-title">Book a Free Assessment with Our Teacher</h2>
        <p>Speak with our team for personalized guidance and counselling. Tell us about your child and we’ll help you understand the most suitable next step.</p>
        <div class="assessment-modal-actions">
          <a class="btn btn-primary" href="/contact.html#enquiry" data-assessment-book>Book Free Assessment</a>
          <a class="btn btn-outline" href="/programs.html">Explore Programs</a>
        </div>
      </div>`;

    document.body.appendChild(popup);
    document.body.style.overflow = 'hidden';
    popup.querySelector('.assessment-modal-close')?.focus();

    popup.querySelector('.assessment-modal-close')?.addEventListener('click', closePopup);
    popup.addEventListener('click', (event) => {
      if (event.target === popup) closePopup();
    });
    popup.querySelector('[data-assessment-book]')?.addEventListener('click', () => {
      try { sessionStorage.setItem(popupKey, '1'); } catch (_) {}
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && popup) closePopup();
    }, { once: true });
  }, 10000);
})();
