// assets/js/login.js

function qs(id) {
  return document.getElementById(id);
}

function setMsg(text, type = "info") {
  const el = qs("msg");
  if (el) {
    el.textContent = text || "";
    el.dataset.type = type;
    el.hidden = !text;
  }
}

async function ensureClientReady() {
  if (!window.sb) {
    throw new Error(
      "Supabase client not initialized. Check env.js, supabaseClient.js, and Supabase CDN script order."
    );
  }
}

/**
 * Redirect logged-in users away from login page (ROLE AWARE)
 */
async function redirectIfAlreadyLoggedIn() {
  await ensureClientReady();

  const { data: { user } } = await window.sb.auth.getUser();
  if (!user) return;

  const { data: profile, error } = await window.sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile?.role) return;

  if (profile.role === "admin") {
    window.location.href = "/portal/admin-home.html";
  } else {
    window.location.href = "/portal/day.html";
  }
}

async function doLogin() {
  setMsg("Logging in...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  const password = qs("password").value || "";

  if (!email || !password) {
    setMsg("Enter your email and password.", "error");
    return;
  }

  const { data, error } = await window.sb.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.user) {
    setMsg("We could not sign you in. Check your details and try again.", "error");
    return;
  }
  const { data: sess } = await window.sb.auth.getSession();
console.log("LOGIN DEBUG session:", sess?.session);
console.log("LOGIN DEBUG access_token?", !!sess?.session?.access_token);
console.log("LOGIN DEBUG user id:", data.user.id);

  // 🔑 FETCH ROLE AFTER LOGIN
  const { data: profile, error: profileError } = await window.sb
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

    console.log("LOGIN DEBUG profile:", profile);
console.log("LOGIN DEBUG profileError:", profileError);

  if (profileError || !profile?.role) {
    setMsg("Your account is signed in but has no portal role. Contact the administrator.", "error");
    return;
  }

  // ✅ ROLE-BASED LANDING
  if (profile.role === "admin") {
    window.location.href = "/portal/admin-home.html";
  } else {
    window.location.href = "/portal/day.html";
  }
}

async function sendReset() {
  setMsg("Sending reset link...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  if (!email) {
    setMsg("Enter your email address first.", "error");
    return;
  }

  const redirectTo = `${window.location.origin}/portal/login.html`;

  const { error } = await window.sb.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  if (error) {
    setMsg("We could not send the reset link. Please try again.", "error");
    return;
  }

  setMsg("Reset link sent. Check your email.", "success");
}

(async function init() {
  try {
    await redirectIfAlreadyLoggedIn();
  } catch (e) {
    console.warn(e.message);
  }

  const btnLogin = qs("btnLogin");
  const btnReset = qs("btnReset");
  const form = qs("loginForm");

  if (btnReset) btnReset.onclick = sendReset;
  if (form) form.addEventListener("submit", (event) => {
    event.preventDefault();
    doLogin();
  });

  // Enter key triggers login
  const pwd = qs("password");
  if (pwd) {
    pwd.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }
})();
