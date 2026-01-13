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
})();
