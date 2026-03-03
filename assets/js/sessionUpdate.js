// assets/js/sessionUpdate.js

/* =========================
   Helpers
========================= */
function getSessionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session") || params.get("session_id") || params.get("id");
}

function setInlineMsg(el, text, type = "info") {
  if (!el) return;
  el.className = "msg";
  el.dataset.type = type;
  el.textContent = text || "";
}

function byId(id) {
  return document.getElementById(id);
}

let isSaving = false;
let sessionCompleted = false;

/* =========================
   MAIN
========================= */
(async function () {
  const user = await requireAuth();
  if (!user) return;

  // ✅ Always use window.sb
  const sb = window.sb;
  if (!sb) {
    alert("Supabase client not initialized (window.sb missing).");
    return;
  }

  // Bind logout only if button exists on this page
  const btnLogout = byId("btnLogout");
  if (btnLogout) btnLogout.onclick = logout;

  const profile = await getMyProfile();
  await showAdminNavIfAdmin();

  const programs = await loadMyPrograms();

  // These elements may not exist on every page—guard them
  const whoEl = byId("who");
  if (whoEl) whoEl.textContent = profile?.full_name || "Teacher";

  const programsEl = byId("programs");
  if (programsEl) {
    programsEl.textContent = "Programs: " + (programs.length ? programs.join(", ") : "—");
  }

  /* =========================
     SESSION ID
  ========================= */
  const sessionId = getSessionIdFromUrl();
  console.log("📌 Session ID from URL:", sessionId);

  const sessionInfoEl = byId("sessionInfo");
  if (!sessionId) {
    if (sessionInfoEl) {
      sessionInfoEl.innerHTML = `<div class="msg" data-type="error">Missing session id.</div>`;
    } else {
      alert("Missing session id.");
    }
    return;
  }

  /* =========================
     LOAD SESSION
  ========================= */
  const { data: session, error: sessErr } = await sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location, student_id, teacher_id, status,
      students(full_name),
      session_programs(programs(name))
    `)
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    const msg = sessErr?.message || "Session not found";
    if (sessionInfoEl) sessionInfoEl.innerHTML = `<div class="msg" data-type="error">${msg}</div>`;
    else alert(msg);
    return;
  }

  // Teacher can only open their own session
  if (session.teacher_id !== user.id) {
    const msg = "Access denied.";
    if (sessionInfoEl) sessionInfoEl.innerHTML = `<div class="msg" data-type="error">${msg}</div>`;
    else alert(msg);
    return;
  }

  sessionCompleted = session.status === "completed" || session.status === "cancelled";

  const st = new Date(session.starts_at);
  const en = new Date(session.ends_at);

  const progNames = (session.session_programs || [])
    .map(x => x.programs?.name)
    .filter(Boolean);

  if (sessionInfoEl) {
    sessionInfoEl.innerHTML = `
      <div><strong>${session.students?.full_name || "Student"}</strong></div>
      <div class="muted">
        ${fmtDate(st)} • ${toTimeLabel(st)}–${toTimeLabel(en)}
        ${session.location ? "• " + session.location : ""}
      </div>
      <div class="muted">
        ${progNames.length ? "Programs: " + progNames.join(", ") : ""}
      </div>
    `;
  }

  /* =========================
     STUDENT SELECT (LOCKED)
  ========================= */
  const { data: students, error: studentsErr } = await sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (studentsErr) {
    const msgEl = byId("msg");
    setInlineMsg(msgEl, "Students load failed: " + studentsErr.message, "error");
    return;
  }

  const sel = byId("studentSelect");
  if (sel) {
    sel.innerHTML = (students || [])
      .map(s => `<option value="${s.id}">${s.full_name}</option>`)
      .join("");
    sel.value = session.student_id;
    sel.disabled = true;
  }

  /* =========================
     LOAD EXISTING UPDATE
  ========================= */
  const { data: upd, error: updLoadErr } = await sb
    .from("session_updates")
    .select("attendance, progress_score, remarks")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (updLoadErr) {
    const msgEl = byId("msg");
    setInlineMsg(msgEl, "Session update load failed: " + updLoadErr.message, "error");
    return;
  }

  if (upd) {
    const attendanceEl = byId("attendance");
    const progressEl = byId("progress");
    const remarksEl = byId("remarks");

    if (attendanceEl) attendanceEl.value = upd.attendance || "present";
    if (progressEl) progressEl.value = upd.progress_score ?? "";
    if (remarksEl) remarksEl.value = upd.remarks ?? "";
  }

  /* =========================
     LOCK IF COMPLETED
  ========================= */
  if (sessionCompleted) {
    lockTeacherUI();
    setInlineMsg(
      byId("msg"),
      `Session is ${(session.status || "").toUpperCase()} and cannot be edited.`,
      "info"
    );
    return;
  }

  /* =========================
     SAVE HANDLER
  ========================= */
  const btnSave = byId("btnSave");
  if (!btnSave) return;

  btnSave.onclick = async () => {
    if (isSaving || sessionCompleted) return;
    isSaving = true;

    btnSave.disabled = true;
    btnSave.textContent = "Saving…";

    const msg = byId("msg");
    setInlineMsg(msg, "Saving…", "info");

    try {
      const attendanceVal = byId("attendance")?.value;
      const progressVal = byId("progress")?.value;
      const remarksVal = byId("remarks")?.value;

      const payload = {
        session_id: sessionId,
        attendance: attendanceVal,
        progress_score: progressVal === "" ? null : parseInt(progressVal, 10),
        remarks: remarksVal || null,
        updated_by: user.id
      };

      const { error: updErr } = await sb
        .from("session_updates")
        .upsert(payload, { onConflict: "session_id" });

      if (updErr) throw updErr;

      // ✅ Auto-complete session
      const { error: sessUpErr } = await sb
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", sessionId)
        .eq("status", "scheduled");

      if (sessUpErr) throw sessUpErr;

      sessionCompleted = true;
      lockTeacherUI();
      setInlineMsg(msg, "Session completed ✅", "success");

      setTimeout(() => {
        window.location.href = "/portal/day.html";
      }, 1500);

    } catch (e) {
      setInlineMsg(msg, e.message || "Save failed", "error");
      btnSave.disabled = false;
      btnSave.textContent = "Save";
    } finally {
      isSaving = false;
    }
  };
})();

/* =========================
   LOCK UI
========================= */
function lockTeacherUI() {
  ["attendance", "progress", "remarks", "btnSave"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  const btn = document.getElementById("btnSave");
  if (btn) btn.textContent = "Completed";
}