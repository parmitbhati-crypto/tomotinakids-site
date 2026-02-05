// assets/js/sessionHistory.js

(async function () {
  const user = await requireAuth();
  if (!user) return;

  await showAdminNavIfAdmin();
  document.getElementById("btnLogout").onclick = logout;

  const studentSelect = document.getElementById("studentSelect");
  const container = document.getElementById("historyContainer");

  if (!studentSelect || !container) {
    console.error("Required DOM elements missing");
    return;
  }

  /* --------------------------------------------------
   * Load students
   * -------------------------------------------------- */
  const { data: students, error: studentErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (studentErr) {
    container.innerHTML =
      `<div class="msg" data-type="error">${studentErr.message}</div>`;
    return;
  }

  studentSelect.innerHTML =
    `<option value="">— Select student —</option>` +
    students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");

  container.innerHTML =
    `<div class="msg" data-type="info">Select a student to view session history.</div>`;

  /* --------------------------------------------------
   * Student selection
   * -------------------------------------------------- */
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;

    if (!studentId) {
      container.innerHTML =
        `<div class="msg" data-type="info">Select a student to view session history.</div>`;
      return;
    }

    container.textContent = "Loading session history…";

    /* --------------------------------------------------
     * Fetch sessions + program + latest session update
     * IMPORTANT: explicit FK for programs
     * -------------------------------------------------- */
    const { data, error } = await window.sb
      .from("sessions")
      .select(`
        id,
        starts_at,
        ends_at,
        teacher:profiles(full_name),
        program:programs!sessions_program_id_fkey(name),
        session_updates (
          attendance,
          progress_score,
          remarks,
          updated_at
        )
      `)
      .eq("student_id", studentId)
      .order("starts_at", { ascending: false })
      .order("updated_at", { foreignTable: "session_updates", ascending: false })
      .limit(1, { foreignTable: "session_updates" });

    if (error) {
      container.innerHTML =
        `<div class="msg" data-type="error">${error.message}</div>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML =
        `<div class="msg" data-type="info">No sessions found.</div>`;
      return;
    }

    /* --------------------------------------------------
     * Render session cards
     * -------------------------------------------------- */
    let html = `<div class="session-history">`;

    data.forEach(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);

      const upd =
        Array.isArray(s.session_updates) && s.session_updates.length
          ? s.session_updates[0]
          : null;

      html += `
        <div class="session-card">
          <div class="session-card-header">
            <div>
              <div class="session-date">${fmtDate(st)}</div>
              <div class="session-time">
                ${toTimeLabel(st)} – ${toTimeLabel(en)}
              </div>
            </div>
          </div>

          <div class="session-meta">
            <span class="badge">👩‍🏫 ${s.teacher?.full_name ?? "—"}</span>
            <span class="badge">📘 ${s.program?.name ?? "No program"}</span>
          </div>

          <div class="session-details">
            <div class="session-detail">
              <strong>Attendance</strong>
              ${upd?.attendance ?? `<span class="session-empty">Not marked</span>`}
            </div>

            <div class="session-detail">
              <strong>Progress</strong>
              ${upd?.progress_score ?? `<span class="session-empty">—</span>`}
            </div>

            <div class="session-detail">
              <strong>Remarks</strong>
              ${upd?.remarks ?? `<span class="session-empty">No remarks</span>`}
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  });
})();
