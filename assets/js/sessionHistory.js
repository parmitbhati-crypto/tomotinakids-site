// assets/js/sessionHistory.js

(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const studentSelect = document.getElementById("studentSelect");
  const container = document.getElementById("historyContainer");

  // ─────────────────────────────
  // LOAD STUDENTS (ADMIN)
  // ─────────────────────────────
  const { data: students, error: studErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (studErr) {
    container.innerHTML =
      `<div class="msg" data-type="error">${studErr.message}</div>`;
    return;
  }

  studentSelect.innerHTML =
    `<option value="">— Select student —</option>` +
    students.map(s =>
      `<option value="${s.id}">${s.full_name}</option>`
    ).join("");

  // ─────────────────────────────
  // ON STUDENT CHANGE → LOAD HISTORY
  // ─────────────────────────────
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;

    if (!studentId) {
      container.innerHTML = "Select a student to view session history.";
      return;
    }

    container.innerHTML = "Loading session history…";

    const { data, error } = await window.sb
  .from("sessions")
  .select(`
    id,
    starts_at,
    ends_at,
    teacher:profiles(full_name),
    session_updates (
      attendance,
      progress_score,
      remarks
    )
  `)
  .eq("student_id", studentId)
  .order("starts_at", { ascending: false });


    if (error) {
      container.innerHTML =
        `<div class="msg" data-type="error">${error.message}</div>`;
      return;
    }

    if (!sessions || sessions.length === 0) {
      container.innerHTML =
        `<div class="msg" data-type="info">No sessions found for this student.</div>`;
      return;
    }

    // ─────────────────────────────
    // RENDER TABLE
    // ─────────────────────────────
    let html = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Teacher</th>
            <th>Attendance</th>
            <th>Progress</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
    `;

    sessions.forEach(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);
      const upd = (s.session_updates && s.session_updates[0]) || {};

      html += `
        <tr>
          <td>${fmtDate(st)}</td>
          <td>${toTimeLabel(st)}–${toTimeLabel(en)}</td>
          <td>${s.profiles?.full_name || "—"}</td>
          <td>${upd.attendance || "—"}</td>
          <td>${upd.progress_score != null ? upd.progress_score + "%" : "—"}</td>
          <td>${upd.remarks || "—"}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  });
})();
