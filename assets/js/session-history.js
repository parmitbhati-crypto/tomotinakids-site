(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("btnLogout").onclick = logout;

  const profile = await getMyProfile();
  if (profile?.role !== "admin") {
    alert("Access denied");
    window.location.href = "/portal/day.html";
    return;
  }

  const studentSelect = document.getElementById("studentSelect");
  const container = document.getElementById("historyContainer");

  // Load students
  const { data: students, error: studErr } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (studErr) {
    container.textContent = studErr.message;
    return;
  }

  studentSelect.innerHTML += students
    .map(s => `<option value="${s.id}">${s.full_name}</option>`)
    .join("");

  studentSelect.onchange = async () => {
    const studentId = studentSelect.value;
    if (!studentId) {
      container.textContent = "Select a student to view session history.";
      return;
    }

    container.textContent = "Loading sessions…";

    const { data, error } = await window.sb
      .from("sessions")
      .select(`
        id,
        starts_at,
        ends_at,
        location,
        profiles(full_name),
        session_updates(attendance, progress_score, remarks),
        session_programs(programs(name))
      `)
      .eq("student_id", studentId)
      .order("starts_at", { ascending: false });

    if (error) {
      container.textContent = error.message;
      return;
    }

    if (!data || !data.length) {
      container.innerHTML = `<div class="msg">No session history found.</div>`;
      return;
    }

    container.innerHTML = data.map(s => {
      const st = new Date(s.starts_at);
      const en = new Date(s.ends_at);

      const programs = (s.session_programs || [])
        .map(p => p.programs?.name)
        .filter(Boolean)
        .join(", ");

      const upd = s.session_updates?.[0];

      return `
        <div class="card" style="margin-bottom:12px;">
          <div><strong>${fmtDate(st)}</strong> • ${toTimeLabel(st)} – ${toTimeLabel(en)}</div>
          <div class="muted">Teacher: ${s.profiles?.full_name || "—"}</div>
          <div class="muted">Programs: ${programs || "—"}</div>
          <div class="muted">Attendance: ${upd?.attendance || "—"}</div>
          <div class="muted">Progress: ${upd?.progress_score ?? "—"}%</div>
          <div class="muted">Remarks: ${upd?.remarks || "—"}</div>
        </div>
      `;
    }).join("");
  };
})();
