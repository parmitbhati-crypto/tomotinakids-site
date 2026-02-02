// assets/js/sessionHistory.js

(async function () {
  const user = await requireAuth();
  if (!user) return;

  await showAdminNavIfAdmin();
  document.getElementById("btnLogout").onclick = logout;

  const studentSelect = document.getElementById("studentSelect");
  const tableWrap = document.getElementById("sessionTableWrap");

  // -----------------------------
  // Load students
  // -----------------------------
  const { data: students, error: studentErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (studentErr) {
    tableWrap.innerHTML = `<div class="msg" data-type="error">${studentErr.message}</div>`;
    return;
  }

  studentSelect.innerHTML =
    `<option value="">Select student</option>` +
    students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join("");

  // -----------------------------
  // On student selection
  // -----------------------------
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;

    if (!studentId) {
      tableWrap.innerHTML =
        `<div class="msg" data-type="info">Select a student to view history.</div>`;
      return;
    }

    tableWrap.textContent = "Loading session history…";

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
      tableWrap.innerHTML =
        `<div class="msg" data-type="error">${error.message}</div>`;
      return;
    }

    if (!data || data.length === 0) {
      tableWrap.innerHTML =
        `<div class="msg" data-type="info">No sessions found.</div>`;
      return;
    }

    // -----------------------------
    // Render table
    // -----------------------------
    let html = `
      <table class="data-table">
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

    data.forEach(session => {
      const start = new Date(session.starts_at);
      const end = new Date(session.ends_at);
      const upd = session.session_updates?.[0] || {};

      html += `
        <tr>
          <td>${fmtDate(start)}</td>
          <td>${toTimeLabel(start)} – ${toTimeLabel(end)}</td>
          <td>${session.teacher?.full_name ?? "—"}</td>
          <td>${upd.attendance ?? "—"}</td>
          <td>${upd.progress_score ?? "—"}</td>
          <td>${upd.remarks ?? "—"}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    tableWrap.innerHTML = html;
  });

  tableWrap.innerHTML =
    `<div class="msg" data-type="info">Select a student to view history.</div>`;
})();
