(async function () {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getMyProfile();
  if (profile?.role !== "admin") {
    window.location.href = "/portal/day.html";
    return;
  }

  document.getElementById("btnLogout").onclick = logout;

  const body = document.getElementById("historyBody");

  const { data, error } = await sb
    .from("session_updates")
    .select(`
      notes,
      created_at,
      students(full_name),
      profiles(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="5">Error loading data</td></tr>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="muted">No session history yet</td></tr>`;
    return;
  }

  body.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.students?.full_name || "-"}</td>
      <td>${row.profiles?.full_name || "-"}</td>
      <td>${new Date(row.created_at).toLocaleDateString()}</td>
      <td>${new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${row.notes || "-"}</td>
    `;

    body.appendChild(tr);
  });
})();
