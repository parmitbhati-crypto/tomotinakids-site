function qs(id) { 
  return document.getElementById(id); 
}

let sessionId = null;
let teacherId = null;
let isSaving = false;
let currentStatus = "scheduled";

/* =========================
   Helpers
========================= */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setMsg(text, type = "info") {
  const el = qs("msg");
  el.textContent = text || "";
  el.className = "msg";
  el.dataset.type = type;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDateInput(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatLocalTimeInput(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toISO(date, time) {
  // Interprets date+time in the browser's local timezone, then stores as ISO UTC
  return new Date(`${date}T${time}:00`).toISOString();
}

/* =========================
   Auth
========================= */
async function requireAdminEdit() {
  const user = await requireAuth();
  if (!user) return null;

  const profile = await getMyProfile();
  if (profile?.role !== "admin") {
    alert("Admins only");
    location.href = "/portal/admin-home.html";
    return null;
  }
  return profile;
}

/* =========================
   Load Programs
========================= */
async function loadPrograms() {
  const { data, error } = await window.sb
    .from("programs")
    .select("id, name")
    .order("name");

  if (error) throw error;

  qs("programSelect").innerHTML = (data || []).map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
}

/* =========================
   Conflict Check
========================= */
async function hasTeacherConflict(newStartsAt, newEndsAt) {
  if (!teacherId) return false;

  const { data, error } = await window.sb
    .from("sessions")
    .select("id")
    .eq("teacher_id", teacherId)
    .neq("id", sessionId)
    .neq("status", "cancelled")
    .lt("starts_at", newEndsAt)
    .gt("ends_at", newStartsAt);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0;
}

/* =========================
   Load Session
========================= */
async function loadSession() {
  sessionId = getParam("session");
  if (!sessionId) {
    alert("Missing session ID");
    location.href = "/portal/admin.html";
    return;
  }

  const { data, error } = await window.sb
    .from("sessions")
    .select(`
      id,
      teacher_id,
      starts_at,
      ends_at,
      location,
      status,
      students(full_name),
      teacher:profiles(full_name),
      session_programs(program_id)
    `)
    .eq("id", sessionId)
    .single();

  if (error) throw error;

  teacherId = data.teacher_id;
  currentStatus = data.status || "scheduled";

  qs("studentName").textContent = `Student: ${data.students?.full_name || "—"}`;
  qs("teacherName").textContent = `Teacher: ${data.teacher?.full_name || "—"}`;

  const st = new Date(data.starts_at);
  const en = new Date(data.ends_at);

  // Use LOCAL time for date/time inputs — not UTC ISO slices
  qs("dateInput").value = formatLocalDateInput(st);
  qs("startTime").value = formatLocalTimeInput(st);
  qs("endTime").value = formatLocalTimeInput(en);
  qs("locationInput").value = data.location || "";

  const selected = (data.session_programs || []).map(p => String(p.program_id));
  Array.from(qs("programSelect").options).forEach(o => {
    o.selected = selected.includes(String(o.value));
  });

  /* 🔒 LOCK IF COMPLETED OR CANCELLED */
  if (currentStatus !== "scheduled") {
    lockEditing(currentStatus);
  }
}

function lockEditing(status) {
  [
    "dateInput",
    "startTime",
    "endTime",
    "locationInput",
    "programSelect",
    "btnSave",
    "btnReschedule"
  ].forEach(id => {
    const el = qs(id);
    if (el) el.disabled = true;
  });

  setMsg(`Session is ${String(status).toUpperCase()} and cannot be edited.`, "info");
}

/* =========================
   Save / Reschedule
========================= */
async function saveChanges(reschedule = false) {
  if (isSaving || currentStatus !== "scheduled") return;

  const btn = reschedule ? qs("btnReschedule") : qs("btnSave");

  isSaving = true;
  qs("btnSave").disabled = true;
  qs("btnReschedule").disabled = true;

  if (btn) {
    btn.textContent = reschedule ? "Rescheduling…" : "Saving…";
  }

  try {
    const date = qs("dateInput").value;
    const start = qs("startTime").value;
    const end = qs("endTime").value;
    const location = qs("locationInput").value.trim() || null;
    const programs = Array.from(qs("programSelect").selectedOptions).map(o => o.value);

    if (!date || !start || !end) {
      throw new Error("Date, start time, and end time are required.");
    }

    const startsAt = toISO(date, start);
    const endsAt = toISO(date, end);

    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("End time must be after start time.");
    }

    const conflictExists = await hasTeacherConflict(startsAt, endsAt);
    if (conflictExists) {
      throw new Error("This teacher already has another session that overlaps with the selected time.");
    }

    /* Update session */
    const { error: upErr } = await window.sb
      .from("sessions")
      .update({
        starts_at: startsAt,
        ends_at: endsAt,
        location,
        status: currentStatus
      })
      .eq("id", sessionId);

    if (upErr) throw upErr;

    /* Reset programs */
    const { error: delErr } = await window.sb
      .from("session_programs")
      .delete()
      .eq("session_id", sessionId);

    if (delErr) throw delErr;

    if (programs.length) {
      const { error: insErr } = await window.sb
        .from("session_programs")
        .insert(
          programs.map(pid => ({
            session_id: sessionId,
            program_id: pid
          }))
        );

      if (insErr) throw insErr;
    }

    setMsg(reschedule ? "Session rescheduled successfully ✅" : "Session updated successfully ✅", "success");

  } catch (e) {
    setMsg(e.message || "Update failed", "error");
  } finally {
    isSaving = false;

    qs("btnSave").disabled = false;
    qs("btnReschedule").disabled = false;

    qs("btnSave").textContent = "Save Changes";
    qs("btnReschedule").textContent = "Reschedule";
  }
}

/* =========================
   Cancel Session
========================= */
async function cancelSession() {
  if (currentStatus !== "scheduled") return;

  if (!confirm("Are you sure you want to cancel this session?")) return;

  const { error } = await window.sb
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);

  if (error) {
    setMsg("Failed to cancel session", "error");
    return;
  }

  currentStatus = "cancelled";
  lockEditing("cancelled");
  setMsg("Session cancelled ❌", "success");
}

/* =========================
   Init
========================= */
(async function init() {
  const profile = await requireAdminEdit();
  if (!profile) return;

  qs("btnCancel").onclick = () => history.back();
  qs("btnSave").onclick = () => saveChanges(false);
  qs("btnReschedule").onclick = () => saveChanges(true);
  qs("btnCancelSession").onclick = cancelSession;

  await loadPrograms();
  await loadSession();
})();