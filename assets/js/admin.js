// assets/js/admin.js

function qs(id) { return document.getElementById(id); }

function setMsg(text, type = "info") {
  const el = qs("msg");
  if (!el) return;
  el.classList.add("msg");
  el.dataset.type = type;
  el.textContent = text || "";
}

function todayYmd() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Stores a local datetime (picked by user) as an ISO instant.
// Works well when DB column is timestamptz (UTC stored, local shown later).
function toLocalDateTimeISO(dateStr, timeStr) {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return dt.toISOString();
}

function selectedMultiValues(selectEl) {
  return Array.from(selectEl.options)
    .filter(o => o.selected)
    .map(o => o.value);
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("complete")) return "completed";
  if (s.includes("cancel")) return "cancelled";
  return "scheduled";
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
  const { data: teachers, error: tErr } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "teacher")
    .order("full_name", { ascending: true });

  if (tErr) throw new Error(tErr.message);

  qs("teacherSelect").innerHTML = (teachers || []).map(t =>
    `<option value="${t.id}">${t.full_name || t.id}</option>`
  ).join("");

  const { data: students, error: sErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (sErr) throw new Error(sErr.message);

  qs("studentSelect").innerHTML = (students || []).map(s =>
    `<option value="${s.id}">${s.full_name}</option>`
  ).join("");

  const { data: programs, error: pErr } = await window.sb
    .from("programs")
    .select("id, name")
    .order("name", { ascending: true });

  if (pErr) throw new Error(pErr.message);

  qs("programSelect").innerHTML = (programs || []).map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
}

function renderSkeletonList(count = 4) {
  return `<div class="list">
    ${Array.from({ length: count }).map(() => `<div class="skeleton"></div>`).join("")}
  </div>`;
}

async function loadSessionsForTeacherDate() {
  const teacherId = qs("teacherSelect").value;
  const dateStr = qs("dateInput").value;
  const listEl = qs("sessionsList");

  if (!teacherId || !dateStr) {
    listEl.textContent = "—";
    return;
  }

  listEl.innerHTML = renderSkeletonList(4);

  const from = new Date(`${dateStr}T00:00:00`);
  const toEx = new Date(from);
  toEx.setDate(toEx.getDate() + 1);

  const { data, error } = await window.sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location, status,
      students(full_name),
      session_programs(programs(name)),
      session_updates(attendance, progress_score, remarks, updated_at)
    `)
    .eq("teacher_id", teacherId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", toEx.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    listEl.innerHTML = `<div class="msg" data-type="error">${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<div class="msg" data-type="info">No sessions for this date.</div>`;
    return;
  }

  listEl.innerHTML = `<div class="list">${
    data.map(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);
      const student = s.students?.full_name || "Student";

      const progs = (s.session_programs || [])
        .map(x => x.programs?.name)
        .filter(Boolean);

      const progText = progs.length ? progs.join(", ") : "—";
      const locText = s.location ? s.location : "—";

      // session_updates can be an array; pick latest by updated_at
      let upd = s.session_updates;
      if (Array.isArray(upd)) {
        upd = upd.slice().sort((a, b) => {
          const ad = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bd = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bd - ad;
        })[0] || null;
      }

      const updText = upd
        ? `${String(upd.attendance || "").toUpperCase()}${(upd.progress_score ?? null) !== null ? ` • ${upd.progress_score}%` : ""}${upd.remarks ? ` • ${upd.remarks}` : ""}`
        : "No update yet";

      const sClass = statusClass(s.status);

      return `
        <a class="list-item" href="/portal/session.html?session=${encodeURIComponent(s.id)}">
          <div class="li-main">
            <div class="li-title">${student}</div>
            <div class="li-sub">${fmtTime(st)}–${fmtTime(en)} • Location: ${locText}</div>
            <div class="li-meta">
              <span class="badge">Programs: ${progText}</span>
              <span class="status-pill ${sClass}">${(s.status || "scheduled").toUpperCase()}</span>
              <span class="badge">${updText}</span>
            </div>
          </div>
        </a>
      `;
    }).join("")
  }</div>`;
}

async function saveSession() {
  setMsg("", "info");

  const teacherId = qs("teacherSelect").value;
  const studentId = qs("studentSelect").value;
  const dateStr = qs("dateInput").value;
  const startTime = qs("startTime").value;
  const endTime = qs("endTime").value;
  const location = qs("locationInput").value.trim() || null;
  const programIds = selectedMultiValues(qs("programSelect"));

  if (!teacherId || !studentId || !dateStr || !startTime || !endTime) {
    setMsg("Please fill Teacher, Student, Date, Start time, End time.", "error");
    return;
  }

  const startsAt = toLocalDateTimeISO(dateStr, startTime);
  const endsAt = toLocalDateTimeISO(dateStr, endTime);

  if (new Date(endsAt) <= new Date(startsAt)) {
    setMsg("End time must be after start time.", "error");
    return;
  }

  setMsg("Saving…", "info");

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
    setMsg(insErr.message, "error");
    return;
  }

  const sessionId = inserted.id;

  if (programIds.length) {
    const rows = programIds.map(pid => ({ session_id: sessionId, program_id: pid }));
    const { error: spErr } = await window.sb.from("session_programs").insert(rows);

    if (spErr) {
      setMsg("Session saved, but programs failed: " + spErr.message, "error");
      await loadSessionsForTeacherDate();
      return;
    }
  }

  setMsg("Saved ✅", "success");
  await loadSessionsForTeacherDate();
}

function clearForm() {
  qs("startTime").value = "";
  qs("endTime").value = "";
  qs("locationInput").value = "";
  Array.from(qs("programSelect").options).forEach(o => o.selected = false);
  setMsg("", "info");
}

(async function init() {
  const ok = await requireAdmin();
  if (!ok) return;

  qs("btnLogout").onclick = logout;

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
  qs("btnClear").onclick = clearForm;

  qs("teacherSelect").addEventListener("change", loadSessionsForTeacherDate);
  qs("dateInput").addEventListener("change", loadSessionsForTeacherDate);
})();
