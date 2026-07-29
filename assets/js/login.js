// assets/js/login.js

function qs(id) {
  return document.getElementById(id);
}
let captchaToken = "";
let turnstileWidgetId;

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

  const { data: access, error } = await window.sb
    .rpc("get_portal_access_state")
    .maybeSingle();

  if (error || !access?.portal_role) return;
  if (access.account_is_active === false) {
    await window.sb.auth.signOut();
    setMsg("Your portal access is inactive. Contact the centre administrator.", "error");
    return;
  }

  if (access.portal_role === "admin") {
    await routeAdminAfterPassword();
  } else if (access.portal_role === "teacher") {
    window.location.href = "/portal/day.html";
  } else {
    await window.sb.auth.signOut();
    setMsg("Your account is awaiting portal approval. Contact the administrator.", "error");
  }
}

async function routeAdminAfterPassword() {
  const { data: assurance } = await window.sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") {
    window.location.href = "/portal/admin-home.html";
    return;
  }
  const { data: factors } = await window.sb.auth.mfa.listFactors();
  const hasVerifiedTotp = (factors?.totp || []).some((factor) => factor.status === "verified");
  window.location.href = hasVerifiedTotp ? "/portal/mfa-challenge.html" : "/portal/mfa-setup.html";
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
  if (window.ENV_TURNSTILE_SITE_KEY && !captchaToken) {
    setMsg("Complete the security check before signing in.", "error");
    return;
  }

  const { data, error } = await window.sb.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined
  });

  if (error || !data?.user) {
    if (window.turnstile && turnstileWidgetId !== undefined) window.turnstile.reset(turnstileWidgetId);
    captchaToken = "";
    setMsg("We could not sign you in. Check your details and try again.", "error");
    return;
  }
  // 🔑 FETCH ROLE AFTER LOGIN
  const { data: access, error: profileError } = await window.sb
    .rpc("get_portal_access_state")
    .maybeSingle();

  if (profileError || !["admin", "teacher"].includes(access?.portal_role)) {
    await window.sb.auth.signOut();
    setMsg("Your account is awaiting portal approval. Contact the administrator.", "error");
    return;
  }
  if (access.account_is_active === false) {
    await window.sb.auth.signOut();
    setMsg("Your portal access is inactive. Contact the centre administrator.", "error");
    return;
  }

  // ✅ ROLE-BASED LANDING
  if (access.portal_role === "admin") {
    await routeAdminAfterPassword();
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

  const redirectTo =
    `${window.location.origin}/portal/set-password.html`;

  const { error } =
    await window.sb.auth.resetPasswordForEmail(email, {
      redirectTo,
      captchaToken: captchaToken || undefined
    });

  if (error) {
    console.error("Password reset error:", error);

    setMsg(
      "We could not send the reset link. Please try again.",
      "error"
    );
    return;
  }

  setMsg("Reset link sent. Check your email.", "success");
}

(async function init() {
  const accountStatus = new URLSearchParams(window.location.search).get("status");
  if (accountStatus === "inactive") {
    setMsg("Your portal access is inactive. Contact the centre administrator.", "error");
  } else if (accountStatus === "pending") {
    setMsg("Your account is awaiting portal approval. Contact the administrator.", "error");
  }
  try {
    await redirectIfAlreadyLoggedIn();
  } catch (e) {
    // Keep sign-in available if the existing-session check is unavailable.
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

window.addEventListener("load", () => {
  if (!window.ENV_TURNSTILE_SITE_KEY || !window.turnstile) return;
  qs("turnstileWrap").hidden = false;
  turnstileWidgetId = window.turnstile.render("#turnstileWidget", {
    sitekey: window.ENV_TURNSTILE_SITE_KEY,
    theme: "light",
    callback: (token) => { captchaToken = token; },
    "expired-callback": () => { captchaToken = ""; },
    "error-callback": () => {
      captchaToken = "";
      setMsg("The security check could not load. Refresh and try again.", "error");
    }
  });
});
