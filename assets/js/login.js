// assets/js/login.js

(async function () {
  if (!window.sb) return;

  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      alert("Email and password are required");
      return;
    }

    const { data, error } = await window.sb.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data?.user) {
      alert(error?.message || "Login failed");
      return;
    }

    // 🔑 Fetch role AFTER login
    const { data: profile, error: profileError } = await window.sb
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.role) {
      console.error("Profile fetch failed", profileError);
      alert("Unable to determine user role");
      return;
    }

    // ✅ ROLE-BASED LANDING PAGE
    if (profile.role === "admin") {
      window.location.href = "/portal/admin.html";
    } else {
      window.location.href = "/portal/day.html";
    }
  });
})();
