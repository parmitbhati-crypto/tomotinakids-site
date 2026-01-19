// assets/js/calendar.js
let viewDate = new Date();

function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEndExclusive(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }

function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

async function fetchMonthSessions(from, to) {
  const { data, error } = await window.sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location,
      students(full_name),
      session_programs(programs(name))
    `)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

function buildDayMap(sessions) {
  const map = new Map(); // ymd -> sessions
  sessions.forEach(s => {
    const d = new Date(s.starts_at);
    const key = ymdLocal(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  return map;
}

function firstGridDay(monthFirst) {
  // Sunday-start grid
  const day = monthFirst.getDay(); // 0=Sun
  const start = new Date(monthFirst);
  start.setDate(monthFirst.getDate() - day);
  return start;
}

async function renderCalendar() {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const profile = await getMyProfile();
  await showAdminNavIfAdmin();

  const programs = await loadMyPrograms();
  document.getElementById("who").textContent = (profile?.full_name || "Teacher");
  document.getElementById("programs").textContent =
    "Programs: " + (programs.length ? programs.join(", ") : "—");

  const ms = monthStart(viewDate);
  const me = monthEndExclusive(viewDate);
  document.getElementById("monthTitle").textContent = monthLabel(viewDate);

  const sessions = await fetchMonthSessions(ms, me);
  const dayMap = buildDayMap(sessions);

  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";

  const start = firstGridDay(ms);
  const todayKey = ymdLocal(new Date());

  // 6 rows * 7 days = 42 cells
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const key = ymdLocal(d);
    const inMonth = d.getMonth() === ms.getMonth();
    const list = dayMap.get(key) || [];

    const cell = document.createElement("div");
    cell.className = "cal-cell" + (key === todayKey ? " today" : "");
    cell.style.opacity = inMonth ? "1" : "0.45";

    cell.innerHTML = `
      <div class="d">${d.getDate()}</div>
      <div class="cal-items">
        ${list.slice(0,3).map(s => `<div class="cal-item">${s.students?.full_name || "Student"}</div>`).join("")}
        ${list.length > 3 ? `<div class="cal-item">+${list.length - 3} more</div>` : ""}
      </div>
    `;

    cell.onclick = () => showDayDetails(d, list);
    grid.appendChild(cell);
  }

  // Default select today if in month
  const today = new Date();
  if (today.getMonth() === ms.getMonth() && today.getFullYear() === ms.getFullYear()) {
    const key = ymdLocal(today);
    showDayDetails(today, dayMap.get(key) || []);
  } else {
    document.getElementById("dayTitle").textContent = "Select a date";
    document.getElementById("dayList").textContent = "—";
  }
}

function showDayDetails(dateObj, list) {
  document.getElementById("dayTitle").textContent = fmtDate(dateObj);

  if (!list.length) {
    document.getElementById("dayList").innerHTML = `<div class="muted">No sessions</div>`;
    return;
  }

  const html = list.map(s => {
    const st = new Date(s.starts_at);
    const en = new Date(s.ends_at);
    const name = s.students?.full_name || "Student";

    const progNames = (s.session_programs || [])
      .map(x => x.programs?.name)
      .filter(Boolean);

    const progText = progNames.length ? ` • <small>${progNames.join(", ")}</small>` : "";
    const locText = s.location ? ` • <small>${s.location}</small>` : "";

    return `
      <div style="margin:8px 0;">
        <a class="session-chip" href="/portal/session.html?session=${encodeURIComponent(s.id)}">
          <strong>${toTimeLabel(st)}–${toTimeLabel(en)}</strong>
          <small> • ${name}</small>${progText}${locText}
        </a>
      </div>
    `;
  }).join("");

  document.getElementById("dayList").innerHTML = html;
}

document.getElementById("prevBtn").onclick = () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  renderCalendar().catch(e => alert(e.message));
};
document.getElementById("nextBtn").onclick = () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  renderCalendar().catch(e => alert(e.message));
};
document.getElementById("todayBtn").onclick = () => {
  viewDate = new Date();
  renderCalendar().catch(e => alert(e.message));
};

renderCalendar().catch(e => alert(e.message));
