// assets/js/auth.js
// Central auth + role routing helpers for Tomotina Portal
// Includes lightweight debug logs to quickly identify root-cause issues.

const AUTH_DEBUG = true; // flip to false to silence logs

function authLog(...args) {
  if (AUTH_DEBUG) console.log("[AUTH]", ...args);
}
function authErr(...args) {
  console.error("[AUTH]", ...args);
}

/**
 * Require user to be logged in and enforce role-based routing.
 * Returns the authenticated user (session user) OR null (and may redirect).
 */
async function requireAuth() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const isLoginPage =
    path === "/portal/login.html" || path === "/portal/login" || path === "/portal/login/";

  if (!window.sb) {
    authErr("Supabase client missing (window.sb). Check env.js + supabaseClient.js load order.");
    return null;
  }

  // --- 1) Get session (prevents "sess is not defined" + avoids timing issues) ---
  const { data: sess, error: sessErr } = await window.sb.auth.getSession();
  const session = sess?.session || null;
  const user = session?.user || null;

  authLog("path:", path, "isLoginPage:", isLoginPage);
  authLog("session?", !!session, "user?", !!user);

  // --- 2) If not logged in, redirect to login (unless already there) ---
  if (sessErr || !user) {
    authErr("No session/user", sessErr || "(no error)");
    if (!isLoginPage) {
      window.location.href = "/portal/login.html";
    }
    return null;
  }

  // --- 3) Fetch profile (role) ---
  const { data: profile, error: profileError } = await window.sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  authLog("profile fetched:", profile);

  if (profileError || !profile) {
    authErr("Profile fetch failed", profileError);
    // Keep it non-blocking but safe: redirect to login to re-auth if desired
    // (or just return null to stop page logic)
    return null;
  }

  const role = profile.role;

  // --- 4) Page groups (your current routing rules) ---
  const teacherPages = ["/portal/day.html", "/portal/week.html", "/portal/calendar.html"];

  const adminPages = [
    "/portal/admin-home.html",
    "/portal/admin.html",
    "/portal/admin-session-edit.html",
    "/portal/session-history.html",
    "/portal/registrations.html",
    "/portal/teacher-attendance.html",
    "/portal/teacher-attendance-history.html"
  ];

  const isTeacherPage = teacherPages.includes(path);
  const isAdminPage = adminPages.includes(path);

  authLog("role:", role, "isTeacherPage:", isTeacherPage, "isAdminPage:", isAdminPage);

  // --- 5) Role rules ---
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

  if (!data) {
    authErr("getMyProfile returned null row for user:", user.id);
    return null;
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

// Optional: catch unexpected promise errors globally (helps future debugging)
window.addEventListener("unhandledrejection", (e) => {
  authErr("UNHANDLED PROMISE:", e.reason);
});
window.addEventListener("error", (e) => {
  authErr("GLOBAL ERROR:", e.message, e.filename, e.lineno);
});