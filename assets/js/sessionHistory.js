// assets/js/sessionHistory.js

(async function () {
  // --- Auth & setup ---
  const user = await requireAuth();
  if (!user) return;

  await showAdminNavIfAdmin();
  document.getElementById("btnLogout").onclick = logout;

  const studentSelect = document.getElementById("studentSelect");
  const tableWrap = document.getElementById("sessionTableWrap");

  // --- Load students for dropdown ---
  const { data: students, error: studentErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (studentErr) {
    tableWrap.innerHTML =
      `<div class="msg" data-type="error">${studentErr.message}</div>`;
    return;
  }

  studentSelect.innerHTML =
    `<option value="">Select student</option>` +
    students.map(s =>
      `<option value="${s.id}">${s.full_name}</option>`
    ).join("");

  // --- On student change ---
  studentSelect.onchange = async function () {
    const studentId = this.value;
    if (!studentId) {
      tableWrap.innerHTML =
        `<div class="msg" data-type="info">Select a student to view history.</div>`;
      return;
    }

    tableWrap.innerHTML = "Loading session history…";

    // --- CORE QUERY (FIXED JOIN) ---
    const { data: sessions, error } = await window.sb
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

    if (!sessions || sessions.length === 0) {
      tableWrap.innerHTML =
        `<div class="msg" data-type="info">No sessions found.</div>`;
      return;
    }

    // --- Build table ---
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

    sessions.forEach(s => {
      const start = new Date(s.starts_at);
      const end = new Date(s.ends_at);

      // session_updates is an array (0 or 1 row)
      const upd = s.session_updates?.[0];

      const attendance = upd?.attendance ?? "—";
      const progress = upd?.progress_score ?? "—";
      const remarks = upd?.remarks ?? "—";

      html += `
        <tr>
          <td>${fmtDate(start)}</td>
          <td>${toTimeLabel(start)} – ${toTimeLabel(end)}</td>
          <td>${s.teacher?.full_name ?? "—"}</td>
          <td>${attendance}</td>
          <td>${progress}</td>
          <td>${remarks}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    tableWrap.innerHTML = html;
  };

  // Initial message
  tableWrap.innerHTML =
    `<div class="msg" data-type="info">Select a student to view history.</div>`;
})();
