import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendAuthEmail } from "../_shared/auth-email.ts";

const allowedOrigins = new Set([
  "https://tomotinakids.com",
  "https://www.tomotinakids.com",
]);

function cors(origin: string | null) {
  const allowed = origin && (allowedOrigins.has(origin) || origin.endsWith(".pages.dev"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://tomotinakids.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

async function verifyTurnstile(token: string, remoteIp: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new Error("Password recovery CAPTCHA is not configured.");
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid email address." }, 400, origin);
    }

    const captchaValid = await verifyTurnstile(
      captchaToken,
      req.headers.get("CF-Connecting-IP") || req.headers.get("x-forwarded-for"),
    );
    if (!captchaValid) {
      return json({ error: "The security check could not be verified. Refresh and try again." }, 400, origin);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    const actionLink = generated?.properties?.action_link;
    let tokenHash = "";
    try {
      tokenHash = actionLink ? new URL(actionLink).searchParams.get("token") || "" : "";
    } catch {
      tokenHash = "";
    }

    if (linkError || !tokenHash) {
      console.warn("Password recovery token was not generated:", linkError?.message || "unknown account");
      return json({ message: "If an account exists for that address, a password reset email has been sent." }, 200, origin);
    }

    try {
      await sendAuthEmail({
        to: email,
        recipientName: generated.user?.user_metadata?.full_name || null,
        flow: "recovery",
        tokenHash,
      });
    } catch (emailError) {
      console.error("Password recovery email failed:", emailError);
      return json({ error: "The password reset email could not be delivered. Please try again later." }, 502, origin);
    }

    return json({ message: "If an account exists for that address, a password reset email has been sent." }, 200, origin);
  } catch (error) {
    console.error("Unexpected password recovery error:", error);
    const configurationError = error instanceof Error && /not configured/i.test(error.message);
    return json({
      error: configurationError
        ? "Password recovery email is not configured yet."
        : "The password reset request could not be completed.",
    }, configurationError ? 503 : 500, origin);
  }
});
