function qs(id) {
  return document.getElementById(id);
}

(async function init() {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getMyProfile();
  if (profile?.role !== "admin") {
    alert("Admins only");
    location.href = "/portal/day.html";
    return;
  }

  qs("who").textContent = profile.full_name || "Admin";
  qs("btnLogout").onclick = logout;
})();
