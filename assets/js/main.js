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

  // Mobile contact bar: hide on scroll down, show on scroll up
  const mcb = document.querySelector('.mobile-contact-bar');
  if (mcb) {
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 140 && y > lastY + 6) {
        mcb.classList.add('is-hidden');
      } else if (y < lastY - 6) {
        mcb.classList.remove('is-hidden');
      }
      lastY = y;
    }, { passive: true });
  }


  // Testimonials slider (home)
  const tRoot = document.querySelector('[data-testimonials]');
  if (tRoot) {
    const track = tRoot.querySelector('[data-testimonials-track]');
    const prev = tRoot.querySelector('[data-t-prev]');
    const next = tRoot.querySelector('[data-t-next]');
    const dotsWrap = tRoot.querySelector('[data-t-dots]');
    const cards = Array.from(track?.children || []);
    let tIdx = 0;
    let tTimer = null;

    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const goTo = (i) => {
      if (!cards.length) return;
      tIdx = (i + cards.length) % cards.length;
      const cardWidth = cards[0].getBoundingClientRect().width + 16; // gap
      track.scrollTo({ left: tIdx * cardWidth, behavior: prefersReduced ? 'auto' : 'smooth' });
      dotsWrap?.querySelectorAll('.t-dot').forEach((d, di) => d.classList.toggle('active', di === tIdx));
    };

    const renderDots = () => {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      cards.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 't-dot' + (i === tIdx ? ' active' : '');
        b.setAttribute('aria-label', `Show testimonial ${i + 1}`);
        b.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(b);
      });
    };

    const start = () => {
      if (cards.length < 2 || prefersReduced) return;
      stop();
      tTimer = window.setInterval(() => goTo(tIdx + 1), 5200);
    };
    const stop = () => {
      if (tTimer) window.clearInterval(tTimer);
      tTimer = null;
    };

    prev?.addEventListener('click', () => goTo(tIdx - 1));
    next?.addEventListener('click', () => goTo(tIdx + 1));

    // pause on hover (desktop)
    tRoot.addEventListener('mouseenter', stop);
    tRoot.addEventListener('mouseleave', start);

    renderDots();
    goTo(0);
    start();
    window.addEventListener('resize', () => goTo(tIdx));
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // FAQ accordion
  const faq = document.querySelector('[data-faq]');
  if (faq) {
    const qs = Array.from(faq.querySelectorAll('.faq-q'));
    const as = Array.from(faq.querySelectorAll('.faq-a'));

    const closeAll = () => {
      qs.forEach(q => q.setAttribute('aria-expanded', 'false'));
      as.forEach(a => a.style.maxHeight = '0px');
    };

    const openAt = (i) => {
      const q = qs[i];
      const a = as[i];
      if (!q || !a) return;
      q.setAttribute('aria-expanded', 'true');
      a.style.maxHeight = a.scrollHeight + 'px';
    };

    // init closed
    closeAll();

    qs.forEach((q, i) => {
      q.addEventListener('click', () => {
        const isOpen = q.getAttribute('aria-expanded') === 'true';
        closeAll();
        if (!isOpen) openAt(i);
      });
    });

    // keep height correct on resize if one is open
    window.addEventListener('resize', () => {
      const openIndex = qs.findIndex(q => q.getAttribute('aria-expanded') === 'true');
      if (openIndex >= 0) openAt(openIndex);
    });
  }
  // Gallery lightbox (simple, dependency-free)
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const imgs = Array.from(gallery.querySelectorAll('img[data-lightbox]'));
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
      <button class="close" type="button" aria-label="Close">×</button>
      <figure>
        <img alt="" />
        <figcaption></figcaption>
      </figure>
    `;
    document.body.appendChild(lb);
    const lbImg = lb.querySelector('img');
    const caption = lb.querySelector('figcaption');
    const closeBtn = lb.querySelector('.close');

    const open = (src, alt) => {
      lbImg.src = src;
      lbImg.alt = alt || '';
      caption.textContent = alt || '';
      lb.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
    };

    const close = () => {
      lb.classList.remove('open');
      document.documentElement.style.overflow = '';
      lbImg.src = '';
    };

    imgs.forEach(img => {
      img.addEventListener('click', () => open(img.src, img.alt));
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img.src, img.alt); }
      });
      img.tabIndex = 0;
    });

    closeBtn.addEventListener('click', close);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
  }


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
