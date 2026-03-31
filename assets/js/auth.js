// assets/js/auth.js
// Tomotina Portal Auth + Role Routing (stable, no "sess is not defined")
// Debug logs included (toggle AUTH_DEBUG)

const AUTH_DEBUG = true;

function authLog(...args) {
  if (AUTH_DEBUG) console.log("[AUTH]", ...args);
}
function authErr(...args) {
  console.error("[AUTH]", ...args);
}

/**
 * Require user to be logged in and enforce role-based routing.
 * Returns the authenticated user (session.user) OR null (and may redirect).
 */
async function requireAuth() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const isLoginPage =
    path === "/portal/login.html" || path === "/portal/login" || path === "/portal/login/";

  if (!window.sb) {
    authErr("window.sb missing. Check env.js + supabaseClient.js load order.");
    return null;
  }

  // ✅ Always define sess here (fixes "sess is not defined")
  const { data: sess, error: sessErr } = await window.sb.auth.getSession();
  const session = sess?.session || null;
  const user = session?.user || null;

  authLog("path:", path, "isLoginPage:", isLoginPage);
  authLog("session?", !!session, "user?", !!user);

  // Not logged in
  if (sessErr || !user) {
    authErr("No session/user", sessErr || "(no error)");
    if (!isLoginPage) window.location.href = "/portal/login.html";
    return null;
  }

  // Fetch profile (role)
  const { data: profile, error: profileError } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    authErr("Profile fetch failed", profileError);
    // Don't redirect blindly; just stop page logic.
    return null;
  }

  const role = profile.role;

  // Page groups
  const teacherPages = ["/portal/day.html", "/portal/week.html", "/portal/calendar.html"];

  const adminPages = [
    "/portal/admin-home.html",
    "/portal/admin.html",
    "/portal/admin-session-edit.html",
    "/portal/session-history.html",
    "/portal/registrations.html",
    "/portal/teacher-attendance.html",
    "/portal/teacher-attendance-history.html",
    "/portal/enquiries.html"
  ];

  const isTeacherPage = teacherPages.includes(path);
  const isAdminPage = adminPages.includes(path);

  authLog("role:", role, "isTeacherPage:", isTeacherPage, "isAdminPage:", isAdminPage);

  // Teachers cannot access admin pages
  if (role === "teacher" && isAdminPage) {
    authLog("Teacher attempted admin page. Redirecting to day.html");
    window.location.href = "/portal/day.html";
    return null;
  }

  // Admins should not stay on login page
  if (role === "admin" && isLoginPage) {
    authLog("Admin on login page. Redirecting to admin-home.html");
    window.location.href = "/portal/admin-home.html";
    return null;
  }

  return user;
}

/* ===============================
   PROFILE HELPERS
================================ */

async function getMyProfile() {
  const user = await requireAuth();
  if (!user) return null;

  const { data, error } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    authErr("getMyProfile error:", error);
    alert("getMyProfile error: " + (error.message || JSON.stringify(error)));
    return null;
  }
  return data || null;
}

async function loadMyPrograms() {
  const user = await requireAuth();
  if (!user) return [];

  const { data, error } = await window.sb
    .from("teacher_programs")
    .select("programs(name)")
    .eq("teacher_id", user.id);

  if (error) {
    authErr("loadMyPrograms error:", error);
    return [];
  }

  return (data || [])
    .map((x) => x.programs?.name)
    .filter(Boolean);
}

/* ===============================
   LOGOUT
================================ */

async function logout() {
  try {
    authLog("Signing out...");
    await window.sb.auth.signOut();
  } catch (e) {
    authErr("signOut failed", e);
  } finally {
    window.location.href = "/portal/login.html";
  }
}

/* ===============================
   ADMIN NAV VISIBILITY
================================ */

async function showAdminNavIfAdmin() {
  const el = document.getElementById("adminNav");
  if (!el) return;

  const profile = await getMyProfile();
  el.style.display = profile?.role === "admin" ? "" : "none";
}

/* ===============================
   UTILITIES
================================ */

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

/* ===============================
   GLOBAL ERROR TRAPS (debugging)
================================ */

window.addEventListener("unhandledrejection", (e) => {
  authErr("UNHANDLED PROMISE:", e.reason);
});

window.addEventListener("error", (e) => {
  authErr("GLOBAL ERROR:", e.message, e.filename, e.lineno);
});