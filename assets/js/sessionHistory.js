// assets/js/sessionHistory.js

(async function () {
  const user = await requireAuth();
  if (!user) return;

  await showAdminNavIfAdmin();

  const studentSelect = document.getElementById("studentSelect");
  const container = document.getElementById("historyContainer");

  if (!studentSelect || !container) {
    window.portalReportError?.("application", "Session history page is missing required controls.");
    return;
  }

  /* -----------------------------
   * Load students
   * ----------------------------- */
  const { data: students, error: studentErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (studentErr) {
    window.portalReportError?.("application", "Unable to load students for session history.");
    container.innerHTML =
      `<div class="msg" data-type="error">Unable to load students. Please try again.</div>`;
    return;
  }

  studentSelect.innerHTML =
    `<option value="">— Select student —</option>` +
    students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");

  container.innerHTML =
    `<div class="msg" data-type="info">Select a student to view session history.</div>`;

  /* -----------------------------
   * Student selection
   * ----------------------------- */
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;
    if (!studentId) {
      container.innerHTML =
        `<div class="msg" data-type="info">Select a student to view session history.</div>`;
      return;
    }

    container.textContent = "Loading session history…";

    /* -----------------------------
     * Fetch sessions
     * ----------------------------- */
    const { data, error } = await window.sb
      .from("sessions")
      .select(`
        id,
        student_id,
        starts_at,
        ends_at,
        teacher:profiles(full_name),
        session_programs(
          programs(name)
        ),
        session_updates(
          attendance,
          progress_score,
          remarks,
          updated_at
        )
      `)
      .eq("student_id", studentId)
      .order("starts_at", { ascending: false });

    if (error) {
      window.portalReportError?.("application", "Unable to load session history.");
      container.innerHTML =
        `<div class="msg" data-type="error">Unable to load session history. Please try again.</div>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML =
        `<div class="msg" data-type="info">No sessions found.</div>`;
      return;
    }

    /* -----------------------------
     * Render cards
     * ----------------------------- */
    let html = `<div class="session-history">`;

    data.forEach((s) => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);

      /* ✅ Normalize session_updates */
      let updates = [];
      if (Array.isArray(s.session_updates)) {
        updates = s.session_updates;
      } else if (s.session_updates && typeof s.session_updates === "object") {
        updates = [s.session_updates];
      }

      const upd = updates.length
        ? updates
            .slice()
            .sort(
              (a, b) =>
                new Date(b.updated_at || 0).getTime() -
                new Date(a.updated_at || 0).getTime()
            )[0]
        : null;

      const programs = (s.session_programs || [])
        .map(p => p.programs?.name)
        .filter(Boolean);

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
            <span class="badge">📘 ${programs.length ? programs.join(", ") : "No program"}</span>
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
