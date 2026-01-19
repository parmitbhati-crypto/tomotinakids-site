// assets/js/sessionUpdate.js
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const profile = await getMyProfile();
  await showAdminNavIfAdmin();

  const programs = await loadMyPrograms();
  document.getElementById("who").textContent = (profile?.full_name || "Teacher");
  document.getElementById("programs").textContent =
    "Programs: " + (programs.length ? programs.join(", ") : "—");

  const sessionId = getQueryParam("session");
  if (!sessionId) {
    document.getElementById("sessionInfo").textContent = "Missing session id.";
    return;
  }

  // Load session
  const { data: session, error: sessErr } = await window.sb
    .from("sessions")
    .select(`
      id, starts_at, ends_at, location, student_id,
      students(full_name),
      session_programs(programs(name))
    `)
    .eq("id", sessionId)
    .single();

  if (sessErr) {
    document.getElementById("sessionInfo").textContent = sessErr.message;
    return;
  }

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

  // Students dropdown
  const { data: students, error: studErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (studErr) {
    alert(studErr.message);
    return;
  }

  const sel = document.getElementById("studentSelect");
  sel.innerHTML = (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");
  sel.value = session.student_id;

  // Existing update
  const { data: upd, error: updErr } = await window.sb
    .from("session_updates")
    .select("attendance, progress_score, remarks")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!updErr && upd) {
    document.getElementById("attendance").value = upd.attendance || "present";
    document.getElementById("progress").value = (upd.progress_score ?? "");
    document.getElementById("remarks").value = (upd.remarks ?? "");
  }

  document.getElementById("btnSave").onclick = async () => {
    const msg = document.getElementById("msg");
    msg.textContent = "Saving...";

    const payload = {
      session_id: sessionId,
      attendance: document.getElementById("attendance").value,
      progress_score: document.getElementById("progress").value === "" ? null : parseInt(document.getElementById("progress").value, 10),
      remarks: document.getElementById("remarks").value || null,
      updated_by: user.id
    };

    const { error } = await window.sb
      .from("session_updates")
      .upsert(payload, { onConflict: "session_id" });

    msg.textContent = error ? error.message : "Saved ✅";
  };
})();
