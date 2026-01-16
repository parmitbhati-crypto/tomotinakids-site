// assets/js/admin.js
function qs(id) { return document.getElementById(id); }

function setMsg(text) {
  qs("msg").textContent = text || "";
}

function todayYmd() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function toLocalDateTimeISO(dateStr, timeStr) {
  // dateStr = YYYY-MM-DD, timeStr = HH:MM
  // new Date('YYYY-MM-DDTHH:MM') interprets as LOCAL time
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt.toISOString(); // store as UTC timestamptz
}

function selectedMultiValues(selectEl) {
  return Array.from(selectEl.options)
    .filter(o => o.selected)
    .map(o => o.value);
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;

  const profile = await getMyProfile();
  qs("who").textContent = profile?.full_name || "Admin";
  qs("roleBadge").textContent = "Role: " + (profile?.role || "—");

  if (profile?.role !== "admin") {
    alert("Access denied: Admins only.");
    window.location.href = "/portal/day.html";
    return null;
  }
  return { user, profile };
}

async function loadDropdowns() {
  // Teachers
  const { data: teachers, error: tErr } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "teacher")
    .order("full_name", { ascending: true });

  if (tErr) throw new Error(tErr.message);

  const teacherSelect = qs("teacherSelect");
  teacherSelect.innerHTML = (teachers || []).map(t =>
    `<option value="${t.id}">${t.full_name || t.id}</option>`
  ).join("");

  // Students
  const { data: students, error: sErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (sErr) throw new Error(sErr.message);

  const studentSelect = qs("studentSelect");
  studentSelect.innerHTML = (students || []).map(s =>
    `<option value="${s.id}">${s.full_name}</option>`
  ).join("");

  // Programs
  const { data: programs, error: pErr } = await window.sb
    .from("programs")
    .select("id, name")
    .order("name", { ascending: true });

  if (pErr) throw new Error(pErr.message);

  const programSelect = qs("programSelect");
  programSelect.innerHTML = (programs || []).map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
}

async function loadSessionsForTeacherDate() {
  const teacherId = qs("teacherSelect").value;
  const dateStr = qs("dateInput").value;
  const listEl = qs("sessionsList");

  if (!teacherId || !dateStr) {
    listEl.textContent = "—";
    return;
  }

  const from = new Date(`${dateStr}T00:00`);
  const to = new Date(`${dateStr}T23:59`);
  // Better: next day exclusive
  const toEx = new Date(from);
  toEx.setDate(toEx.getDate() + 1);

  // Pull sessions + student + programs via session_programs
  const { data, error } = await window.sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location, status,
      students(full_name),
      session_programs(programs(name))
    `)
    .eq("teacher_id", teacherId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", toEx.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    listEl.textContent = error.message;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<div class="muted">No sessions</div>`;
    return;
  }

  listEl.innerHTML = data.map(s => {
    const st = new Date(s.starts_at);
    const en = new Date(s.ends_at);
    const student = s.students?.full_name || "Student";
    const progs = (s.session_programs || [])
      .map(x => x.programs?.name)
      .filter(Boolean);

    const progText = progs.length ? ` • <small>${progs.join(", ")}</small>` : "";
    const locText = s.location ? ` • <small>${s.location}</small>` : "";

    return `
      <div style="margin:8px 0;">
        <a class="session-chip" href="/portal/session.html?session=${encodeURIComponent(s.id)}">
          <strong>${student}</strong><br/>
          <small>${fmtTime(st)}–${fmtTime(en)}</small>${progText}${locText}
        </a>
      </div>
    `;
  }).join("");
}

async function saveSession() {
  setMsg("");

  const teacherId = qs("teacherSelect").value;
  const studentId = qs("studentSelect").value;
  const dateStr = qs("dateInput").value;
  const startTime = qs("startTime").value;
  const endTime = qs("endTime").value;
  const location = qs("locationInput").value.trim() || null;
  const programIds = selectedMultiValues(qs("programSelect"));

  if (!teacherId || !studentId || !dateStr || !startTime || !endTime) {
    setMsg("Please fill Teacher, Student, Date, Start time, End time.");
    return;
  }

  const startsAt = toLocalDateTimeISO(dateStr, startTime);
  const endsAt = toLocalDateTimeISO(dateStr, endTime);

  if (new Date(endsAt) <= new Date(startsAt)) {
    setMsg("End time must be after start time.");
    return;
  }

  setMsg("Saving...");

  // 1) Insert session
  const { data: inserted, error: insErr } = await window.sb
    .from("sessions")
    .insert([{
      teacher_id: teacherId,
      student_id: studentId,
      starts_at: startsAt,
      ends_at: endsAt,
      location,
      status: "scheduled"
    }])
    .select("id")
    .single();

  if (insErr) {
    setMsg(insErr.message);
    return;
  }

  const sessionId = inserted.id;

  // 2) Insert program tags (if any)
  if (programIds.length) {
    const rows = programIds.map(pid => ({ session_id: sessionId, program_id: pid }));
    const { error: spErr } = await window.sb
      .from("session_programs")
      .insert(rows);

    if (spErr) {
      setMsg("Session saved, but programs failed: " + spErr.message);
      await loadSessionsForTeacherDate();
      return;
    }
  }

  setMsg("Saved ✅");
  await loadSessionsForTeacherDate();
}

function clearFormTimes() {
  qs("startTime").value = "";
  qs("endTime").value = "";
  qs("locationInput").value = "";
  Array.from(qs("programSelect").options).forEach(o => o.selected = false);
  setMsg("");
}

(async function init() {
  await requireAdmin();

  qs("btnLogout").onclick = logout;

  // Defaults
  qs("dateInput").value = todayYmd();
  qs("startTime").value = "10:00";
  qs("endTime").value = "10:30";

  try {
    await loadDropdowns();
    await loadSessionsForTeacherDate();
  } catch (e) {
    alert(e.message);
  }

  qs("btnSave").onclick = saveSession;
  qs("btnClear").onclick = clearFormTimes;

  qs("teacherSelect").addEventListener("change", loadSessionsForTeacherDate);
  qs("dateInput").addEventListener("change", loadSessionsForTeacherDate);
})();
