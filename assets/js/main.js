// Tomotina Kids - site interactions

// Privacy-aware campaign attribution and conversion hooks.
// Events stay in the browser unless a future analytics provider consumes dataLayer.
(() => {
  const params = new URLSearchParams(window.location.search);
  const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const campaign = Object.fromEntries(campaignKeys.map((key) => [key, params.get(key)]).filter(([, value]) => value));
  if (Object.keys(campaign).length) sessionStorage.setItem('tomotina_campaign', JSON.stringify(campaign));
  window.dataLayer = window.dataLayer || [];
  window.tomotinaTrack = (event, details = {}) => {
    const stored = JSON.parse(sessionStorage.getItem('tomotina_campaign') || '{}');
    window.dataLayer.push({ event, ...stored, ...details });
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('tel:')) window.tomotinaTrack('phone_click');
    if (href.includes('wa.me')) window.tomotinaTrack('whatsapp_click');
    if (href.includes('contact.html') || href.startsWith('#enquiry')) window.tomotinaTrack('enquiry_cta_click');
  });
})();

(function () {
  document.documentElement.classList.add('js');

  const hamburger = document.querySelector('[data-hamburger]');
  const mobilePanel = document.querySelector('[data-mobile-panel]');

  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobilePanel.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    mobilePanel.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobilePanel.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const current = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('?')[0];
    if (href === current) link.classList.add('active');
  });

  // Consistent legal and accessibility navigation across legacy footers.
  document.querySelectorAll('footer .footer-bottom').forEach((footerBottom) => {
    if (footerBottom.querySelector('.legal-links')) return;
    const links = document.createElement('span');
    links.className = 'legal-links';
    links.innerHTML = '<a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="accessibility.html">Accessibility</a>';
    footerBottom.appendChild(links);
  });

  // Add audience, process and enquiry paths to every program card.
  const programAudience = {
    'Special Education': 'Children needing individualized academic and learning support',
    'School Readiness Program': 'Children preparing to enter a classroom environment',
    'NIOS Support': 'Students who benefit from a flexible education pathway',
    'Speech & Language Therapy': 'Children with speech, language, listening, or social communication needs',
    'Oral Placement Therapy (OPT)': 'Children with speech-motor or feeding-related challenges',
    'Applied Behavior Analysis (ABA)': 'Children building communication, attention, play, and daily living skills',
    'Activities of Daily Living (ADL)': 'Children developing everyday self-care and independence',
    'Occupational Therapy': 'Children with sensory, movement, attention, play, or self-care needs',
    'Sports Program': 'Children building coordination, fitness, teamwork, and confidence',
    'Art Program': 'Children who benefit from creative, sensory, and fine-motor expression',
    'Music Program': 'Children building listening, rhythm, communication, and social engagement',
    'Dance & Movement Therapy (DMT)': 'Children who connect and regulate through movement and non-verbal expression'
  };
  document.querySelectorAll('.program-card .program-body').forEach((body) => {
    const heading = body.querySelector('h3');
    const audience = programAudience[heading?.textContent.trim()];
    if (!audience || body.querySelector('.program-fit')) return;
    const name = heading.textContent.trim();
    const fit = document.createElement('div');
    fit.className = 'program-fit';
    fit.innerHTML = `<strong>Best suited for</strong><span>${audience}</span><small>Process: consultation → individualized plan → sessions → family feedback</small><a class="program-enquire" href="contact.html?program=${encodeURIComponent(name)}#enquiry">Ask about this program →</a>`;
    body.appendChild(fit);
  });

  // Hero carousel
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
      if (!slides.length) return;
      idx = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dotsWrap?.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (slides.length < 2) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stop();
      timer = window.setInterval(() => goTo(idx + 1), 4500);
    };

    renderDots();
    goTo(0);
    start();

    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // Reveal animation
  const revealEls = Array.from(
    document.querySelectorAll('.card, .hero-card, .hero-side, .cta-wrap, .trust-item, .img-premium')
  );
  revealEls.forEach((el) => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach((el) => io.observe(el));
  }

  // Mobile contact bar
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

  // Testimonials slider
  const tRoot = document.querySelector('[data-testimonials]');
  if (tRoot) {
    const track = tRoot.querySelector('[data-testimonials-track]');
    const prev = tRoot.querySelector('[data-t-prev]');
    const next = tRoot.querySelector('[data-t-next]');
    const dotsWrap = tRoot.querySelector('[data-t-dots]');
    const cards = Array.from(track?.children || []);
    let tIdx = 0;
    let tTimer = null;

    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const goTo = (i) => {
      if (!cards.length) return;
      tIdx = (i + cards.length) % cards.length;
      const left = cards[tIdx].offsetLeft;
      track.scrollTo({ left, behavior: prefersReduced ? 'auto' : 'smooth' });
      dotsWrap?.querySelectorAll('.t-dot').forEach((d, di) => {
        d.classList.toggle('active', di === tIdx);
      });
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

    const stop = () => {
      if (tTimer) window.clearInterval(tTimer);
      tTimer = null;
    };

    const start = () => {
      if (cards.length < 2 || prefersReduced) return;
      stop();
      tTimer = window.setInterval(() => goTo(tIdx + 1), 5200);
    };

    prev?.addEventListener('click', () => goTo(tIdx - 1));
    next?.addEventListener('click', () => goTo(tIdx + 1));
    tRoot.addEventListener('mouseenter', stop);
    tRoot.addEventListener('mouseleave', start);

    renderDots();
    goTo(0);
    start();
    window.addEventListener('resize', () => goTo(tIdx));
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // FAQ
  const faq = document.querySelector('[data-faq]');
  if (faq) {
    const qs = Array.from(faq.querySelectorAll('.faq-q'));
    const as = Array.from(faq.querySelectorAll('.faq-a'));

    const closeAll = () => {
      qs.forEach((q) => q.setAttribute('aria-expanded', 'false'));
      as.forEach((a) => (a.style.maxHeight = '0px'));
    };

    const openAt = (i) => {
      const q = qs[i];
      const a = as[i];
      if (!q || !a) return;
      q.setAttribute('aria-expanded', 'true');
      a.style.maxHeight = a.scrollHeight + 'px';
    };

    closeAll();

    qs.forEach((q, i) => {
      q.addEventListener('click', () => {
        const isOpen = q.getAttribute('aria-expanded') === 'true';
        closeAll();
        if (!isOpen) openAt(i);
      });
    });

    window.addEventListener('resize', () => {
      const openIndex = qs.findIndex((q) => q.getAttribute('aria-expanded') === 'true');
      if (openIndex >= 0) openAt(openIndex);
    });
  }
})();

// Enquiry form submit
(() => {
  const form = document.querySelector('[data-enquiry-form]');
  if (!form) return;

  const submitBtn = form.querySelector('[data-enquiry-submit]');
  const statusEl = form.querySelector('[data-enquiry-status]');
  const requestedProgram = new URLSearchParams(window.location.search).get('program');
  let isSubmitting = false;

  if (requestedProgram && form.elements.message && !form.elements.message.value.trim()) {
    form.elements.message.value = `I would like to enquire about ${requestedProgram}.`;
  }

  function setStatus(message, type = 'info') {
    if (!statusEl) return;

    statusEl.hidden = !message;
    statusEl.textContent = message || '';

    statusEl.style.borderColor =
      type === 'error' ? 'rgba(180,35,24,.24)' :
      type === 'success' ? 'rgba(2,122,72,.24)' :
      'rgba(227,234,244,.95)';

    statusEl.style.background =
      type === 'error' ? 'rgba(180,35,24,.06)' :
      type === 'success' ? 'rgba(2,122,72,.08)' :
      'rgba(255,255,255,.72)';

    statusEl.style.color =
      type === 'error' ? '#b42318' :
      type === 'success' ? '#027a48' :
      'inherit';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const name = form.elements.name?.value.trim() || '';
    const phone = form.elements.phone?.value.trim() || '';
    const email = form.elements.email?.value.trim() || '';
    const childName = form.elements.child_name?.value.trim() || '';
    const childAge = form.elements.child_age?.value.trim() || '';
    const message = form.elements.message?.value.trim() || '';
    const consent = form.elements.consent;

    if (!name || !phone || !childName || !message || (consent && !consent.checked)) {
      setStatus('Please fill all required fields.', 'error');
      return;
    }

    if (!window.sb) {
      setStatus('Form is temporarily unavailable. Please try again shortly.', 'error');
      return;
    }

    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }
    setStatus('');

    try {
      const { error } = await window.sb
        .from('enquiries')
        .insert([{
          parent_name: name,
          phone,
          email: email || null,
          child_name: childName || null,
          child_age: childAge || null,
          message,
          status: 'new',
          source: 'website_home_form'
        }]);

      if (error) throw error;

      form.reset();
      window.tomotinaTrack?.('enquiry_submitted', { form: window.location.pathname });
      setStatus('Thanks! Your enquiry has been submitted successfully.', 'success');
    } catch (err) {
      setStatus(err?.message || 'Something went wrong while sending your enquiry. Please try again.', 'error');
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Enquiry';
      }
    }
  });
})();
