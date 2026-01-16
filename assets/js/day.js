// assets/js/day.js
(async function () {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getMyProfile();
  const programs = await loadMyPrograms();

  document.getElementById("who").textContent =
    (profile?.full_name ? profile.full_name : "Teacher") + " • " + fmtDate(new Date());

  document.getElementById("programs").textContent =
    "Programs: " + (programs.length ? programs.join(", ") : "—");

  document.getElementById("btnLogout").onclick = logout;

  // Day range (local)
  const today = new Date();
  const from = startOfLocalDay(today);
  const to = addDays(from, 1);

  // Fetch sessions for today (teacher only; RLS enforces)
  const { data: sessions, error } = await window.sb
  .from("sessions")
  .select("id, starts_at, ends_at, location, students(full_name), session_programs(programs(name))")

    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    document.getElementById("dayTableWrap").textContent = error.message;
    return;
  }

  // Build 30-min slots from 08:00 to 18:00 (change if needed)
  const startHour = 10, endHour = 19;
  const slots = [];
  const dayBase = new Date(from);

  for (let h = startHour; h < endHour; h++) {
    slots.push(new Date(dayBase.getFullYear(), dayBase.getMonth(), dayBase.getDate(), h, 0));
    slots.push(new Date(dayBase.getFullYear(), dayBase.getMonth(), dayBase.getDate(), h, 30));
  }

  // Group sessions into slots (if session overlaps slot start)
  const slotMap = new Map(); // key = slot ISO, value = list
  slots.forEach(s => slotMap.set(s.toISOString(), []));

  (sessions || []).forEach(s => {
    const st = new Date(s.starts_at);
    // find nearest slot <= st by rounding down to 30 mins
    const rounded = new Date(st);
    rounded.setMinutes(st.getMinutes() < 30 ? 0 : 30, 0, 0);
    const key = rounded.toISOString();
    if (!slotMap.has(key)) slotMap.set(key, []);
    slotMap.get(key).push(s);
  });

  // Render table
  const todayLabel = fmtDate(today);
  let html = `
    <table class="day-table">
      <thead>
        <tr>
          <th class="slot-time">Time</th>
          <th>${todayLabel}</th>
        </tr>
      </thead>
      <tbody>
  `;

  slots.forEach(slot => {
    const key = slot.toISOString();
    const list = slotMap.get(key) || [];
    html += `<tr>
      <td class="slot-time">${toTimeLabel(slot)}</td>
      <td>
        ${list.length ? list.map(s => {
          const st = new Date(s.starts_at);
          const en = new Date(s.ends_at);
          const student = s.students?.full_name || "Student";
         const progNames = (s.session_programs || [])
  .map(x => x.programs?.name)
  .filter(Boolean);

const prog = progNames.length ? ` • <small>${progNames.join(", ")}</small>` : "";

          const loc = s.location ? ` • <small>${s.location}</small>` : "";
          return `<a class="session-chip" href="/portal/session.html?session=${encodeURIComponent(s.id)}">
            <strong>${student}</strong><br/>
            <small>${toTimeLabel(st)}–${toTimeLabel(en)}</small>${prog}${loc}
          </a>`;
        }).join("") : `<span class="muted">—</span>`}
      </td>
    </tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("dayTableWrap").innerHTML = html;
})();
