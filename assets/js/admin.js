// assets/js/admin.js

function qs(id) { return document.getElementById(id); }

/* ===============================
   GLOBAL STATE
================================ */
let isSavingSession = false;

/* ===============================
   UI HELPERS
================================ */
function setMsg(text, type = "info") {
  const el = qs("msg");
  if (!el) return;
  el.className = "msg";
  el.dataset.type = type;
  el.textContent = text || "";
}

function todayYmd() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Store local datetime as UTC ISO
function toLocalDateTimeISO(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
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

/* ===============================
   AUTH
================================ */
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

/* ===============================
   DROPDOWNS
================================ */
async function loadDropdowns() {
  const { data: teachers } = await sb
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .order("full_name");

  qs("teacherSelect").innerHTML = teachers.map(t =>
    `<option value="${t.id}">${t.full_name}</option>`
  ).join("");

  const { data: students } = await sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  qs("studentSelect").innerHTML = students.map(s =>
    `<option value="${s.id}">${s.full_name}</option>`
  ).join("");

  const { data: programs } = await sb
    .from("programs")
    .select("id, name")
    .order("name");

  qs("programSelect").innerHTML = programs.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
}

/* ===============================
   SESSION LIST
================================ */
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
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const { data, error } = await sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location, status,
      students(full_name),
      session_programs(programs(name)),
      session_updates(attendance, progress_score, remarks, updated_at)
    `)
    .eq("teacher_id", teacherId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  if (error) {
    listEl.innerHTML = `<div class="msg" data-type="error">${error.message}</div>`;
    return;
  }

  if (!data.length) {
    listEl.innerHTML = `<div class="msg" data-type="info">No sessions.</div>`;
    return;
  }

  listEl.innerHTML = `<div class="list">${
    data.map(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);
      const student = s.students?.full_name || "Student";

      const programs = (s.session_programs || [])
        .map(x => x.programs?.name)
        .filter(Boolean)
        .join(", ") || "—";

      const latestUpdate = Array.isArray(s.session_updates)
        ? s.session_updates.sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
          )[0]
        : null;

      const updText = latestUpdate
        ? `${latestUpdate.attendance?.toUpperCase() || ""}${
            latestUpdate.progress_score != null ? ` • ${latestUpdate.progress_score}%` : ""
          }${latestUpdate.remarks ? ` • ${latestUpdate.remarks}` : ""}`
        : "No update yet";

      return `
        <a class="list-item"
           href="/portal/admin-session-edit.html?session=${encodeURIComponent(s.id)}">
          <div class="li-main">
            <div class="li-title">${student}</div>
            <div class="li-sub">${fmtTime(st)}–${fmtTime(en)} • ${s.location || "—"}</div>
            <div class="li-meta">
              <span class="badge">Programs: ${programs}</span>
              <span class="status-pill ${statusClass(s.status)}">
                ${(s.status || "scheduled").toUpperCase()}
              </span>
              <span class="badge">${updText}</span>
            </div>
          </div>
        </a>
      `;
    }).join("")
  }</div>`;
}

/* ===============================
   SAVE SESSION (PHASE 3: CONFLICT CHECK)
================================ */
async function saveSession() {
  if (isSavingSession) return;
  isSavingSession = true;

  const btn = qs("btnSave");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const teacherId = qs("teacherSelect").value;
    const studentId = qs("studentSelect").value;
    const dateStr = qs("dateInput").value;
    const startTime = qs("startTime").value;
    const endTime = qs("endTime").value;
    const location = qs("locationInput").value.trim() || null;
    const programIds = selectedMultiValues(qs("programSelect"));

    if (!teacherId || !studentId || !dateStr || !startTime || !endTime) {
      throw new Error("Please fill all required fields.");
    }

    const startsAt = toLocalDateTimeISO(dateStr, startTime);
    const endsAt = toLocalDateTimeISO(dateStr, endTime);

    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("End time must be after start time.");
    }

    /* 🔒 CONFLICT CHECK (Phase 3) */
    const { data: conflicts } = await sb
      .from("sessions")
      .select("id")
      .eq("teacher_id", teacherId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt);

    if (conflicts.length) {
      throw new Error("This teacher already has a session in that time slot.");
    }

    /* INSERT SESSION */
    const { data: inserted, error } = await sb
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

    if (error) throw error;

    if (programIds.length) {
      await sb.from("session_programs").insert(
        programIds.map(pid => ({
          session_id: inserted.id,
          program_id: pid
        }))
      );
    }

    setMsg("Saved ✅", "success");
    clearForm();
    await loadSessionsForTeacherDate();

  } catch (e) {
    setMsg(e.message || "Save failed", "error");
  } finally {
    isSavingSession = false;
    btn.disabled = false;
    btn.textContent = "Save schedule";
  }
}

function clearForm() {
  qs("startTime").value = "";
  qs("endTime").value = "";
  qs("locationInput").value = "";
  Array.from(qs("programSelect").options).forEach(o => o.selected = false);
  setMsg("", "info");
}

/* ===============================
   INIT
================================ */
(async function init() {
  const ok = await requireAdmin();
  if (!ok) return;

  qs("btnLogout").onclick = logout;

  qs("dateInput").value = todayYmd();
  qs("startTime").value = "10:00";
  qs("endTime").value = "10:30";

  await loadDropdowns();
  await loadSessionsForTeacherDate();

  qs("btnSave").onclick = saveSession;
  qs("btnClear").onclick = clearForm;

  qs("teacherSelect").addEventListener("change", loadSessionsForTeacherDate);
  qs("dateInput").addEventListener("change", loadSessionsForTeacherDate);
})();
