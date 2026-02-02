// assets/js/auth.js

async function requireAuth() {
  const path = window.location.pathname.replace(/\/+$/, "");

  // Ensure Supabase client exists
  if (!window.sb) {
    console.error("Supabase client not initialized");
    return null;
  }

  const { data: { user }, error } = await window.sb.auth.getUser();

  const isLoginPage = path === "/portal/login";

  // Not logged in → redirect ONLY if not already on login
  if (error || !user) {
    if (!isLoginPage) {
      window.location.href = "/portal/login";
    }
    return null;
  }

  // Logged in → never stay on login page
  if (isLoginPage) {
    window.location.href = "/portal/day";
    return null;
  }

  return user;
}

async function getMyProfile() {
  const user = await requireAuth();
  if (!user) return null;

  const { data, error } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("getMyProfile error:", error);
    return { id: user.id, full_name: "", role: "teacher" };
  }

  return data;
}

async function loadMyPrograms() {
  const user = await requireAuth();
  if (!user) return [];

  const { data, error } = await window.sb
    .from("teacher_programs")
    .select("programs(name)")
    .eq("teacher_id", user.id);

  if (error) {
    console.error("loadMyPrograms error:", error);
    return [];
  }

  return (data || [])
    .map(x => x.programs?.name)
    .filter(Boolean);
}

async function logout() {
  await window.sb.auth.signOut();
  window.location.href = "/portal/login";
}

// Admin link control
// HTML must contain:
// <a id="adminNav" href="/portal/admin" style="display:none;">Admin</a>
async function showAdminNavIfAdmin() {
  const el = document.getElementById("adminNav");
  if (!el) return;

  const profile = await getMyProfile();
  el.style.display = profile?.role === "admin" ? "" : "none";
}

// ───────── Utilities ─────────

function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toTimeLabel(dt) {
  return dt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
