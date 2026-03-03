// assets/js/admin.js
// Admin Scheduler page
// Includes debug logs to make issues obvious.

const ADMIN_DEBUG = true;
function aLog(...args) { if (ADMIN_DEBUG) console.log("[ADMIN]", ...args); }
function aErr(...args) { console.error("[ADMIN]", ...args); }

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
  aLog("MSG:", type, text);
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
  aLog("requireAdmin() start");
  const user = await requireAuth();
  if (!user) {
    aLog("requireAuth returned null (redirect likely happened)");
    return null;
  }

  const profile = await getMyProfile();
  aLog("profile:", profile);

  const whoEl = qs("who");
  const roleEl = qs("roleBadge");
  if (whoEl) whoEl.textContent = profile?.full_name || "Admin";
  if (roleEl) roleEl.textContent = "Role: " + (profile?.role || "—");

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
  aLog("loadDropdowns() start");

  const teacherEl = qs("teacherSelect");
  const studentEl = qs("studentSelect");
  const programEl = qs("programSelect");

  if (!teacherEl || !studentEl || !programEl) {
    aErr("Dropdown elements missing in DOM", { teacherEl, studentEl, programEl });
    setMsg("Dropdown elements missing in DOM. Check admin.html IDs.", "error");
    return;
  }

  // Teachers
  const { data: teachers, error: tErr } = await window.sb
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .order("full_name");

  aLog("teachers result:", { count: teachers?.length, tErr });

  if (tErr) {
    setMsg("Teacher list failed: " + tErr.message, "error");
    teacherEl.innerHTML = `<option value="">—</option>`;
    return;
  }

  teacherEl.innerHTML =
    `<option value="">— Select teacher —</option>` +
    (teachers || []).map(t => `<option value="${t.id}">${t.full_name}</option>`).join("");

  // Students
  const { data: students, error: sErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  aLog("students result:", { count: students?.length, sErr });

  if (sErr) {
    setMsg("Student list failed: " + sErr.message, "error");
    studentEl.innerHTML = `<option value="">—</option>`;
    return;
  }

  studentEl.innerHTML =
    `<option value="">— Select student —</option>` +
    (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");

  // Programs
  const { data: programs, error: pErr } = await window.sb
    .from("programs")
    .select("id, name")
    .order("name");

  aLog("programs result:", { count: programs?.length, pErr });

  if (pErr) {
    setMsg("Programs failed: " + pErr.message, "error");
    programEl.innerHTML = ``;
    return;
  }

  programEl.innerHTML = (programs || [])
    .map(p => `<option value="${p.id}">${p.name}</option>`)
    .join("");

  aLog("loadDropdowns() done");
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
  const teacherId = qs("teacherSelect")?.value;
  const dateStr = qs("dateInput")?.value;
  const listEl = qs("sessionsList");

  aLog("loadSessionsForTeacherDate()", { teacherId, dateStr });

  if (!listEl) {
    aErr("sessionsList element missing");
    return;
  }

  if (!teacherId || !dateStr) {
    listEl.textContent = "—";
    return;
  }

  listEl.innerHTML = renderSkeletonList(4);

  const from = new Date(`${dateStr}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

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
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  aLog("sessions query:", { count: data?.length, error });

  if (error) {
    listEl.innerHTML = `<div class="msg" data-type="error">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
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
        ? s.session_updates.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
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
   SAVE SESSION
================================ */
async function saveSession() {
  if (isSavingSession) return;
  isSavingSession = true;

  const btn = qs("btnSave");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }

  try {
    const teacherId = qs("teacherSelect")?.value;
    const studentId = qs("studentSelect")?.value;
    const dateStr = qs("dateInput")?.value;
    const startTime = qs("startTime")?.value;
    const endTime = qs("endTime")?.value;
    const location = qs("locationInput")?.value.trim() || null;
    const programIds = selectedMultiValues(qs("programSelect"));

    aLog("saveSession inputs", { teacherId, studentId, dateStr, startTime, endTime, programIds });

    if (!teacherId || !studentId || !dateStr || !startTime || !endTime) {
      throw new Error("Please fill all required fields.");
    }

    const startsAt = toLocalDateTimeISO(dateStr, startTime);
    const endsAt = toLocalDateTimeISO(dateStr, endTime);

    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("End time must be after start time.");
    }

    // Conflict check
    const { data: conflicts, error: cErr } = await window.sb
      .from("sessions")
      .select("id")
      .eq("teacher_id", teacherId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt);

    aLog("conflicts:", { conflictsCount: conflicts?.length, cErr });

    if (cErr) throw cErr;
    if (conflicts?.length) throw new Error("This teacher already has a session in that time slot.");

    // Insert session
    const { data: inserted, error } = await window.sb
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
      const { error: spErr } = await window.sb.from("session_programs").insert(
        programIds.map(pid => ({ session_id: inserted.id, program_id: pid }))
      );
      if (spErr) throw spErr;
    }

    setMsg("Saved ✅", "success");
    clearForm();
    await loadSessionsForTeacherDate();

  } catch (e) {
    aErr("saveSession failed:", e);
    setMsg(e.message || "Save failed", "error");
  } finally {
    isSavingSession = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save schedule";
    }
  }
}

function clearForm() {
  if (qs("startTime")) qs("startTime").value = "";
  if (qs("endTime")) qs("endTime").value = "";
  if (qs("locationInput")) qs("locationInput").value = "";
  const prog = qs("programSelect");
  if (prog) Array.from(prog.options).forEach(o => (o.selected = false));
  setMsg("", "info");
}

/* ===============================
   INIT
================================ */
(async function init() {
  aLog("ADMIN init start");

  try {
    const ok = await requireAdmin();
    if (!ok) return;

    if (qs("dateInput")) qs("dateInput").value = todayYmd();
    if (qs("startTime")) qs("startTime").value = "10:00";
    if (qs("endTime")) qs("endTime").value = "10:30";

    await loadDropdowns();
    await loadSessionsForTeacherDate();

    const btnSave = qs("btnSave");
    const btnClear = qs("btnClear");
    if (btnSave) btnSave.onclick = saveSession;
    if (btnClear) btnClear.onclick = clearForm;

    const teacherSel = qs("teacherSelect");
    const dateIn = qs("dateInput");
    if (teacherSel) teacherSel.addEventListener("change", loadSessionsForTeacherDate);
    if (dateIn) dateIn.addEventListener("change", loadSessionsForTeacherDate);

    aLog("ADMIN init done");
  } catch (e) {
    aErr("ADMIN init error:", e);
    setMsg(e.message || "Admin page error", "error");
  }
})();