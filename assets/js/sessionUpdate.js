function getQueryParam(name) {
  return new URLSearchParams(window.location.href).get(name);
}

function setInlineMsg(el, text, type = "info") {
  if (!el) return;
  el.className = "msg";
  el.dataset.type = type;
  el.textContent = text || "";
}

let isSaving = false;
let sessionCompleted = false;

(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const profile = await getMyProfile();
  await showAdminNavIfAdmin();

  const programs = await loadMyPrograms();
  document.getElementById("who").textContent = profile?.full_name || "Teacher";
  document.getElementById("programs").textContent =
    "Programs: " + (programs.length ? programs.join(", ") : "—");

  const sessionId = getQueryParam("session");
  if (!sessionId) {
    document.getElementById("sessionInfo").innerHTML =
      `<div class="msg" data-type="error">Missing session id.</div>`;
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

  if (sessErr) {
    document.getElementById("sessionInfo").innerHTML =
      `<div class="msg" data-type="error">${sessErr.message}</div>`;
    return;
  }

  if (session.teacher_id !== user.id) {
    document.getElementById("sessionInfo").innerHTML =
      `<div class="msg" data-type="error">Access denied.</div>`;
    return;
  }

  sessionCompleted = session.status === "completed" || session.status === "cancelled";

  const st = new Date(session.starts_at);
  const en = new Date(session.ends_at);

  const progNames = (session.session_programs || [])
    .map(x => x.programs?.name)
    .filter(Boolean);

  document.getElementById("sessionInfo").innerHTML = `
    <div><strong>${session.students?.full_name || "Student"}</strong></div>
    <div class="muted">${fmtDate(st)} • ${toTimeLabel(st)}–${toTimeLabel(en)} ${session.location ? "• " + session.location : ""}</div>
    <div class="muted">${progNames.length ? "Programs: " + progNames.join(", ") : ""}</div>
  `;

  /* =========================
     STUDENT SELECT (LOCKED)
  ========================= */
  const { data: students } = await sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  const sel = document.getElementById("studentSelect");
  sel.innerHTML = students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");
  sel.value = session.student_id;
  sel.disabled = true; // teacher should not change student

  /* =========================
     LOAD EXISTING UPDATE
  ========================= */
  const { data: upd } = await sb
    .from("session_updates")
    .select("attendance, progress_score, remarks")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (upd) {
    document.getElementById("attendance").value = upd.attendance || "present";
    document.getElementById("progress").value = upd.progress_score ?? "";
    document.getElementById("remarks").value = upd.remarks ?? "";
  }

  /* =========================
     LOCK UI IF COMPLETED
  ========================= */
  if (sessionCompleted) {
    lockTeacherUI();
    setInlineMsg(
      document.getElementById("msg"),
      `Session is ${session.status.toUpperCase()} and cannot be edited.`,
      "info"
    );
    return;
  }

  /* =========================
     SAVE HANDLER
  ========================= */
  document.getElementById("btnSave").onclick = async () => {
    if (isSaving || sessionCompleted) return;
    isSaving = true;

    const btn = document.getElementById("btnSave");
    btn.disabled = true;
    btn.textContent = "Saving…";

    const msg = document.getElementById("msg");
    setInlineMsg(msg, "Saving…", "info");

    try {
      const payload = {
        session_id: sessionId,
        attendance: document.getElementById("attendance").value,
        progress_score:
          document.getElementById("progress").value === ""
            ? null
            : parseInt(document.getElementById("progress").value, 10),
        remarks: document.getElementById("remarks").value || null,
        updated_by: user.id
      };

      const { error: updErr } = await sb
        .from("session_updates")
        .upsert(payload, { onConflict: "session_id" });

      if (updErr) throw updErr;

      /* ✅ AUTO-COMPLETE SESSION */
      await sb
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", sessionId)
        .eq("status", "scheduled");

      sessionCompleted = true;
      lockTeacherUI();

      setInlineMsg(msg, "Session completed ✅", "success");
      setTimeout(() => {
      window.location.href = "/portal/day.html";
    }, 1500);

    } catch (e) {
      setInlineMsg(msg, e.message || "Save failed", "error");
      btn.disabled = false;
      btn.textContent = "Save";
    } finally {
      isSaving = false;
    }
  };
})();

/* =========================
   LOCK TEACHER UI
========================= */
function lockTeacherUI() {
  [
    "attendance",
    "progress",
    "remarks",
    "btnSave"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  const btn = document.getElementById("btnSave");
  if (btn) btn.textContent = "Completed";
}
