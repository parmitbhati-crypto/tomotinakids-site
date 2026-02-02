// assets/js/login.js

function qs(id) {
  return document.getElementById(id);
}

function setMsg(text) {
  const el = qs("msg");
  if (el) el.textContent = text || "";
}

async function ensureClientReady() {
  if (!window.sb) {
    throw new Error(
      "Supabase client not initialized. Check env.js, supabaseClient.js, and Supabase CDN script order."
    );
  }
}

/**
 * If user is already logged in, do NOT stay on login page
 */
async function redirectIfAlreadyLoggedIn() {
  await ensureClientReady();

  const { data: { user } } = await window.sb.auth.getUser();
  if (user) {
    window.location.href = "/portal/day.html";
  }
}

async function doLogin() {
  setMsg("Logging in...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  const password = qs("password").value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  const { error } = await window.sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMsg(error.message);
    return;
  }

  // Successful login
  window.location.href = "/portal/day.html";
}

async function sendReset() {
  setMsg("Sending reset link...");
  await ensureClientReady();

  const email = (qs("email").value || "").trim();
  if (!email) {
    setMsg("Enter your email first.");
    return;
  }

  const redirectTo = `${window.location.origin}/portal/login.html`;

  const { error } = await window.sb.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Reset link sent. Check your email.");
}

(async function init() {
  try {
    await redirectIfAlreadyLoggedIn();
  } catch (e) {
    console.warn(e.message);
  }

  const btnLogin = qs("btnLogin");
  const btnReset = qs("btnReset");

  if (btnLogin) btnLogin.onclick = doLogin;
  if (btnReset) btnReset.onclick = sendReset;

  // Enter key triggers login
  const pwd = qs("password");
  if (pwd) {
    pwd.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }
})();
