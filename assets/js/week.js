// assets/js/week.js
(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const profile = await getMyProfile();
  await showAdminNavIfAdmin();

  const programs = await loadMyPrograms();

  document.getElementById("who").textContent = (profile?.full_name || "Teacher");
  document.getElementById("programs").textContent =
    "Programs: " + (programs.length ? programs.join(", ") : "—");

  // Week range: today -> next 7 days
  const today = new Date();
  const from = startOfLocalDay(today);
  const to = addDays(from, 7);

  const { data: sessions, error } = await window.sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location,
      students(full_name),
      session_programs(programs(name))
    `)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    document.getElementById("weekWrap").textContent = error.message;
    return;
  }

  // Group by day
  const byDay = new Map();
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    byDay.set(ymdLocal(d), []);
  }

  (sessions || []).forEach(s => {
    const d = new Date(s.starts_at);
    const key = ymdLocal(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(s);
  });

  let html = `<div class="grid">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    const key = ymdLocal(d);
    const list = byDay.get(key) || [];

    html += `
      <div class="card">
        <div class="h2">${fmtDate(d)}</div>
        ${list.length ? list.map(s => {
          const st = new Date(s.starts_at);
          const en = new Date(s.ends_at);
          const student = s.students?.full_name || "Student";

          const progNames = (s.session_programs || [])
            .map(x => x.programs?.name)
            .filter(Boolean);

          const prog = progNames.length ? ` • ${progNames.join(", ")}` : "";
          const loc = s.location ? ` • ${s.location}` : "";

          return `<div style="margin:8px 0;">
            <a class="session-chip" href="/portal/session.html?session=${encodeURIComponent(s.id)}">
              <strong>${toTimeLabel(st)}–${toTimeLabel(en)}</strong>
              <small> • ${student}${prog}${loc}</small>
            </a>
          </div>`;
        }).join("") : `<div class="muted">No sessions</div>`}
      </div>
    `;
  }
  html += `</div>`;

  document.getElementById("weekWrap").innerHTML = html;
})();
