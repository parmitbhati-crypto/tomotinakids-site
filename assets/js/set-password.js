(() => {
  const form = document.getElementById("setPasswordForm");
  const message = document.getElementById("passwordMessage");
  const button = form.querySelector('button[type="submit"]');

  let authSessionReady = false;

  const show = (text, type) => {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
  };

  const cleanAuthUrl = () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  };

  async function establishAuthSession() {
    button.disabled = true;

    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.substring(1));

      const code = url.searchParams.get("code");
      const tokenHash =
        url.searchParams.get("token_hash") ||
        hashParams.get("token_hash");
      const rawType =
        url.searchParams.get("type") ||
        hashParams.get("type") ||
        "invite";
      const verificationType = rawType === "recovery" ? "recovery" : "invite";

      /*
       * PKCE flow:
       * /set-password.html?code=...
       */
      if (code) {
        const { error } =
          await window.sb.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }
      }

      /*
       * Tomotina custom email flow. The token hash stays in the browser URL
       * fragment until this deliberate page action verifies it with Supabase.
       */
      if (!code && tokenHash) {
        const { error } = await window.sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType
        });

        if (error) {
          throw error;
        }
      }

      /*
       * Check whether Supabase automatically processed an implicit-flow URL.
       */
      let {
        data: { session },
        error: sessionError
      } = await window.sb.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      /*
       * Backward-compatible fallback for old implicit URLs:
       * #access_token=...&refresh_token=...
       */
      if (!session && window.location.hash) {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const {
            data,
            error
          } = await window.sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            throw error;
          }

          session = data.session;
        }
      }

      if (!session) {
        throw new Error(
          "No authentication session was created from the secure link."
        );
      }

      authSessionReady = true;
      cleanAuthUrl();
      button.disabled = false;
    } catch (error) {
      console.error("Secure-link verification failed:", error);

      show(
        "This secure link could not be verified. Request a new invitation or password reset email.",
        "error"
      );

      button.disabled = true;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authSessionReady) {
      show(
        "The secure link is still being verified or is no longer valid.",
        "error"
      );
      return;
    }

    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(
      formData.get("confirmPassword") || ""
    );

    if (password !== confirmPassword) {
      show("Passwords do not match.", "error");
      return;
    }

    if (
      password.length < 10 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      show(
        "Use at least 10 characters with uppercase, lowercase, a number, and a symbol.",
        "error"
      );
      return;
    }

    button.disabled = true;

    const { error } = await window.sb.auth.updateUser({
      password
    });

    if (error) {
      console.error("Password update failed:", error);

      show(
        `Unable to save the password: ${error.message}`,
        "error"
      );

      button.disabled = false;
      return;
    }

    show(
      "Password saved. Opening your workspace…",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "/portal/app.html";
    }, 800);
  });

  establishAuthSession();
})();
