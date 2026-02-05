function qs(id) { return document.getElementById(id); }

let sessionId = null;
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

function toISO(date, time) {
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
  const { data, error } = await sb
    .from("programs")
    .select("id, name")
    .order("name");

  if (error) throw error;

  qs("programSelect").innerHTML = data.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
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

  const { data, error } = await sb
    .from("sessions")
    .select(`
      id,
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

  currentStatus = data.status || "scheduled";

  qs("studentName").textContent = `Student: ${data.students?.full_name || "—"}`;
  qs("teacherName").textContent = `Teacher: ${data.teacher?.full_name || "—"}`;

  const st = new Date(data.starts_at);
  const en = new Date(data.ends_at);

  qs("dateInput").value = st.toISOString().slice(0, 10);
  qs("startTime").value = st.toISOString().slice(11, 16);
  qs("endTime").value = en.toISOString().slice(11, 16);
  qs("locationInput").value = data.location || "";

  const selected = (data.session_programs || []).map(p => p.program_id);
  Array.from(qs("programSelect").options).forEach(o => {
    o.selected = selected.includes(o.value);
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

  setMsg(`Session is ${status.toUpperCase()} and cannot be edited.`, "info");
}

/* =========================
   Save / Reschedule
========================= */
async function saveChanges(reschedule = false) {
  if (isSaving || currentStatus !== "scheduled") return;
  isSaving = true;

  qs("btnSave").disabled = true;
  qs("btnSave").textContent = "Saving…";

  try {
    const date = qs("dateInput").value;
    const start = qs("startTime").value;
    const end = qs("endTime").value;
    const location = qs("locationInput").value.trim() || null;
    const programs = Array.from(qs("programSelect").selectedOptions).map(o => o.value);

    const startsAt = toISO(date, start);
    const endsAt = toISO(date, end);

    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("End time must be after start time.");
    }

    /* Update session */
    const { error: upErr } = await sb
      .from("sessions")
      .update({
        starts_at: startsAt,
        ends_at: endsAt,
        location,
        status: reschedule ? "scheduled" : currentStatus
      })
      .eq("id", sessionId);

    if (upErr) throw upErr;

    /* Reset programs */
    await sb.from("session_programs").delete().eq("session_id", sessionId);

    if (programs.length) {
      await sb.from("session_programs").insert(
        programs.map(pid => ({
          session_id: sessionId,
          program_id: pid
        }))
      );
    }

    setMsg(reschedule ? "Session rescheduled ✅" : "Session updated ✅", "success");

  } catch (e) {
    setMsg(e.message || "Update failed", "error");
  } finally {
    isSaving = false;
    qs("btnSave").disabled = false;
    qs("btnSave").textContent = "Save Changes";
  }
}

/* =========================
   Cancel Session
========================= */
async function cancelSession() {
  if (currentStatus !== "scheduled") return;

  if (!confirm("Are you sure you want to cancel this session?")) return;

  const { error } = await sb
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
  await requireAdminEdit();

  qs("btnLogout").onclick = logout;
  qs("btnCancel").onclick = () => history.back();

  qs("btnSave").onclick = () => saveChanges(false);
  qs("btnReschedule").onclick = () => saveChanges(true);
  qs("btnCancelSession").onclick = cancelSession;

  await loadPrograms();
  await loadSession();
})();
