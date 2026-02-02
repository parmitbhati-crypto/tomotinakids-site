// assets/js/sessionHistory.js

document.addEventListener("DOMContentLoaded", async () => {
  // Ensure user is authenticated and admin
  const user = await requireAuth();
  if (!user) return;

  const profile = await getMyProfile();
  if (!profile || profile.role !== "admin") {
    console.warn("Not an admin");
    return;
  }

  const studentSelect = document.getElementById("studentSelect");
  const historyContainer = document.getElementById("historyContainer");

  if (!studentSelect || !historyContainer) {
    console.error("Missing DOM elements");
    return;
  }

  // ─────────────────────────────
  // LOAD STUDENTS (ADMIN)
  // ─────────────────────────────
  const { data: students, error } = await window.sb
    .from("students")
    .select("id, full_name")
    .order("full_name");

  if (error) {
    console.error("Failed to load students:", error);
    historyContainer.textContent = "Failed to load students.";
    return;
  }

  // Populate dropdown
  students.forEach(student => {
    const opt = document.createElement("option");
    opt.value = student.id;
    opt.textContent = student.full_name;
    studentSelect.appendChild(opt);
  });

  // ─────────────────────────────
  // STUDENT CHANGE HANDLER
  // ─────────────────────────────
  studentSelect.addEventListener("change", async () => {
    const studentId = studentSelect.value;

    if (!studentId) {
      historyContainer.textContent =
        "Select a student to view session history.";
      return;
    }

    historyContainer.textContent = "Loading session history...";

    // 🔹 We will implement this query next
    // For now just placeholder
    historyContainer.innerHTML = `
      <div class="muted">
        Session history will appear here for selected student.
      </div>
    `;
  });
});
