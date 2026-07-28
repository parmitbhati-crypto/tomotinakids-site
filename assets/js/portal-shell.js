// Shared Tomotina portal shell and interaction layer.
(() => {
  const rawPath = window.location.pathname.replace(/\/+$/, '');
  const path = rawPath.startsWith('/portal/') && !rawPath.split('/').pop().includes('.')
    ? `${rawPath}.html`
    : rawPath;
  if (!path.startsWith('/portal') || path.endsWith('/login') || path.endsWith('/login.html')) return;

  const adminPaths = new Set([
    '/portal/admin-home.html', '/portal/admin.html', '/portal/admin-session-edit.html',
    '/portal/session-history.html', '/portal/registrations.html', '/portal/registration-new.html',
    '/portal/registration-details.html', '/portal/teacher-attendance.html',
    '/portal/teacher-attendance-history.html', '/portal/enquiries.html', '/portal/system.html'
  ]);
  const inferredRole = adminPaths.has(path) ? 'admin' : 'teacher';
  const nav = {
    admin: [
      ['Overview', '/portal/admin-home.html', 'home'],
      ['Schedule', '/portal/admin.html', 'calendar'],
      ['Sessions', '/portal/session-history.html', 'sessions'],
      ['Registrations', '/portal/registrations.html', 'students'],
      ['Attendance', '/portal/teacher-attendance.html', 'attendance'],
      ['Enquiries', '/portal/enquiries.html', 'enquiries'],
      ['System health', '/portal/system.html', 'shield']
    ],
    teacher: [
      ['Today', '/portal/day.html', 'today'],
      ['Week', '/portal/week.html', 'week'],
      ['Calendar', '/portal/calendar.html', 'calendar']
    ]
  };
  const icons = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9 20v-6h6v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    sessions: '<path d="M8 3h8M9 3v3h6V3"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="m9 14 2 2 4-5"/>',
    students: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 7h5M18.5 4.5v5"/>',
    attendance: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4M17 2v4M3 9h18m-14 5 2 2 4-4"/>',
    enquiries: '<path d="M4 5h16v12H8l-4 4V5Z"/><path d="M8 9h8M8 13h5"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9.5 4.4-1.7 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-5"/>',
    today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.home}</svg>`;

  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  ready(() => {
    const content = document.querySelector('main.portal-shell, body > .container');
    if (!content || document.querySelector('.portal-app')) return;

    const legacyTopbar = content.querySelector(':scope > .topbar');
    const pageHeader = content.querySelector(':scope > .portal-header');
    if (legacyTopbar) legacyTopbar.classList.add('portal-legacy-header');
    content.classList.remove('portal-shell', 'container');
    content.classList.add('portal-content');

    const title = pageHeader?.querySelector('.portal-title')?.textContent.trim()
      || content.querySelector('.h1, .h2, h1, h2')?.textContent.trim()
      || document.title.split(/[|•]/)[0].trim();
    const currentNav = nav[inferredRole];

    const app = document.createElement('div');
    app.className = 'portal-app';
    app.innerHTML = `
      <button class="portal-scrim" type="button" aria-label="Close navigation"></button>
      <aside class="portal-sidebar" aria-label="${inferredRole === 'admin' ? 'Admin' : 'Teacher'} navigation">
        <a class="portal-brand" href="${inferredRole === 'admin' ? '/portal/admin-home.html' : '/portal/day.html'}">
          <img src="/assets/images/logo.png" alt="Tomotina Kids">
          <span><strong>Tomotina Kids</strong><small>${inferredRole === 'admin' ? 'Admin portal' : 'Teacher portal'}</small></span>
        </a>
        <nav class="portal-nav">
          <p>Workspace</p>
          ${currentNav.map(([label, href, icon]) => `
            <a href="${href}" ${path === href || (href.includes('registrations') && path.includes('registration-')) || (href.includes('admin.html') && path.includes('admin-session-edit')) || (href.includes('teacher-attendance.html') && path.includes('teacher-attendance-history')) ? 'aria-current="page"' : ''}>
              ${svg(icon)}<span>${label}</span>
            </a>`).join('')}
        </nav>
        <div class="portal-sidebar-help">
          <strong>Need help?</strong>
          <span>Contact the centre administrator if information looks incorrect.</span>
        </div>
      </aside>
      <div class="portal-workspace">
        <header class="portal-top-header">
          <div class="portal-heading">
            <button class="portal-menu" type="button" aria-label="Open navigation" aria-expanded="false">${svg('home')}</button>
            <div><span class="portal-eyebrow">${inferredRole === 'admin' ? 'Administration' : 'My workspace'}</span><h1>${title}</h1></div>
          </div>
          <div class="portal-account">
            <div class="portal-popover-wrap">
              <button class="portal-icon-button" id="portalNotifications" type="button" aria-label="Notifications" aria-expanded="false">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
                <span class="portal-notification-dot" hidden></span>
              </button>
              <div class="portal-popover portal-notifications" id="portalNotificationPanel" hidden>
                <strong>Notifications</strong><p>You're all caught up.</p>
              </div>
            </div>
            <div class="portal-popover-wrap">
              <button class="portal-profile-button" id="portalProfile" type="button" aria-expanded="false">
                <span class="portal-avatar" id="portalAvatar">T</span>
                <span class="portal-profile-copy"><strong id="portalProfileName">Team member</strong><small id="portalProfileRole">${inferredRole}</small></span>
                <span aria-hidden="true">⌄</span>
              </button>
              <div class="portal-popover portal-profile-menu" id="portalProfileMenu" hidden>
                <span id="portalProfileEmail"></span>
                <button type="button" id="portalLogout">Sign out</button>
              </div>
            </div>
          </div>
        </header>
      </div>`;

    content.parentNode.insertBefore(app, content);
    app.querySelector('.portal-workspace').appendChild(content);
    document.body.classList.add('portal-ready');

    const menu = app.querySelector('.portal-menu');
    const scrim = app.querySelector('.portal-scrim');
    const toggleNav = (open) => {
      document.body.classList.toggle('portal-nav-open', open);
      menu.setAttribute('aria-expanded', String(open));
    };
    menu.addEventListener('click', () => toggleNav(!document.body.classList.contains('portal-nav-open')));
    scrim.addEventListener('click', () => toggleNav(false));

    const setupPopover = (buttonId, panelId) => {
      const button = app.querySelector(`#${buttonId}`);
      const panel = app.querySelector(`#${panelId}`);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = panel.hidden;
        app.querySelectorAll('.portal-popover').forEach((item) => { item.hidden = true; });
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
      });
    };
    setupPopover('portalNotifications', 'portalNotificationPanel');
    setupPopover('portalProfile', 'portalProfileMenu');
    document.addEventListener('click', () => app.querySelectorAll('.portal-popover').forEach((item) => { item.hidden = true; }));

    app.querySelector('#portalLogout').addEventListener('click', async () => {
      await window.sb?.auth.signOut();
      window.location.href = '/portal/login.html';
    });

    content.querySelectorAll('#msg, .msg').forEach((message) => {
      message.setAttribute('role', 'status');
      message.setAttribute('aria-live', 'polite');
    });
    content.querySelectorAll('.table-wrap').forEach((tableWrap) => {
      tableWrap.setAttribute('tabindex', '0');
      tableWrap.setAttribute('role', 'region');
      tableWrap.setAttribute('aria-label', `${title} data table`);
    });
    content.querySelectorAll('.muted').forEach((state) => {
      if (/loading/i.test(state.textContent)) {
        state.setAttribute('aria-busy', 'true');
        state.setAttribute('aria-live', 'polite');
      }
    });

    hydrateProfile(app, inferredRole);
  });

  async function hydrateProfile(app, inferredRole) {
    if (!window.sb) return;
    const { data: authData } = await window.sb.auth.getUser();
    const user = authData?.user;
    if (!user) return;
    const { data: profile } = await window.sb.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    const name = profile?.full_name || user.email?.split('@')[0] || 'Team member';
    const role = profile?.role || inferredRole;
    app.querySelector('#portalProfileName').textContent = name;
    app.querySelector('#portalProfileRole').textContent = role === 'admin' ? 'Administrator' : 'Teacher';
    app.querySelector('#portalProfileEmail').textContent = user.email || '';
    app.querySelector('#portalAvatar').textContent = name.slice(0, 1).toUpperCase();

    if (role === 'admin') {
      const { count } = await window.sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
      if (count > 0) {
        app.querySelector('.portal-notification-dot').hidden = false;
        app.querySelector('#portalNotificationPanel').innerHTML = `<strong>Notifications</strong><a href="/portal/enquiries.html">${count} new ${count === 1 ? 'enquiry' : 'enquiries'} to review</a>`;
      }
    }
  }
})();
