(() => {
  const title = document.getElementById("actionTitle");
  const copy = document.getElementById("actionCopy");
  const message = document.getElementById("actionMessage");
  const button = document.getElementById("continueAction");
  const params = new URLSearchParams(window.location.search);
  const flow = params.get("flow") === "invite" ? "invite" : "recovery";
  const confirmationUrl = params.get("confirmation_url") || "";

  const show = (text, type = "error") => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
  };

  if (flow === "invite") {
    title.textContent = "Create your staff password";
    copy.textContent = "Press Continue to accept your invitation and choose a secure password.";
    button.textContent = "Continue to password setup";
  } else {
    title.textContent = "Reset your password";
    copy.textContent = "Press Continue to verify the reset request and choose a new password.";
    button.textContent = "Continue to reset password";
  }

  let secureUrl;
  try {
    secureUrl = new URL(confirmationUrl);
    const expectedHost = new URL(window.ENV_SUPABASE_URL || "https://invalid.local").host;
    if (!expectedHost || secureUrl.protocol !== "https:" || secureUrl.host !== expectedHost || !secureUrl.pathname.startsWith("/auth/v1/verify")) {
      throw new Error("Unexpected confirmation destination.");
    }
  } catch (error) {
    console.error("Invalid auth action URL:", error);
    button.disabled = true;
    show("This secure link is incomplete or invalid. Request a new invitation or password reset email.");
    return;
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Opening…";
    window.location.assign(secureUrl.href);
  });
})();
