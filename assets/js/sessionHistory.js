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

  // -----------------------------
  // Load students
  // -----------------------------
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

  // -----------------------------
  // Student selection
  // -----------------------------
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;

    if (!studentId) {
      container.innerHTML =
        `<div class="msg" data-type="info">Select a student to view session history.</div>`;
      return;
    }

    container.textContent = "Loading session history…";

    const { data, error } = await window.sb
      .from("sessions")
      .select(`
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

    if (!data || data.length === 0) {
      container.innerHTML =
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

    data.forEach(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);
      const upd = s.session_updates?.[0] || {};

      html += `
        <tr>
          <td>${fmtDate(st)}</td>
          <td>${toTimeLabel(st)} – ${toTimeLabel(en)}</td>
          <td>${s.teacher?.full_name ?? "—"}</td>
          <td>${upd.attendance ?? "—"}</td>
          <td>${upd.progress_score ?? "—"}</td>
          <td>${upd.remarks ?? "—"}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  });
})();
