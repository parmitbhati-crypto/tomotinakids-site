// Tomotina Kids - basic site interactions

(function () {
  const hamburger = document.querySelector('[data-hamburger]');
  const mobilePanel = document.querySelector('[data-mobile-panel]');

  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobilePanel.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    // Close mobile menu when clicking a link
    mobilePanel.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobilePanel.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Active nav link based on current page
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path) link.classList.add('active');
  });

  // Hero carousel (auto + dots)
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const track = carousel.querySelector('[data-carousel-track]');
    const dotsWrap = carousel.querySelector('[data-carousel-dots]');
    const slides = Array.from(track?.children || []);
    let idx = 0;
    let timer = null;

    const renderDots = () => {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      slides.forEach((_, i) => {
        const b = document.createElement('button');
        b.className = 'dot' + (i === idx ? ' active' : '');
        b.type = 'button';
        b.setAttribute('aria-label', `Show slide ${i + 1}`);
        b.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(b);
      });
    };

    const goTo = (next) => {
      idx = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dotsWrap?.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    };

    const start = () => {
      if (slides.length < 2) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stop();
      timer = window.setInterval(() => goTo(idx + 1), 4200);
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    renderDots();
    goTo(0);
    start();
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // Scroll reveal (subtle premium motion)
  const revealEls = Array.from(document.querySelectorAll('.card, .hero-card, .hero-side, .cta-wrap, .page-hero'));
  revealEls.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(el => io.observe(el));
})();


// Enquiry form (UI-only for now; Supabase logging will be added later)
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form || !form.matches('[data-enquiry-form]')) return;
  e.preventDefault();
  const success = form.querySelector('.form-success');
  if (success) {
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alert('Thanks! We will get back to you shortly.');
  }
  form.reset();
});
