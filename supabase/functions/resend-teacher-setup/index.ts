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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") || "";
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Authentication required." }, 401, origin);

    const { data: caller } = await callerClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (caller?.role !== "admin" || caller.is_active === false) {
      return json({ error: "Administrator access required." }, 403, origin);
    }

    const body = await req.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "A valid teacher account is required." }, 400, origin);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: teacher, error: teacherError } = await admin
      .from("profiles")
      .select("id, full_name, role, is_active, teacher_profiles(email, invitation_status)")
      .eq("id", userId)
      .maybeSingle();

    const details = teacher?.teacher_profiles;
    const email = details?.email;
    if (teacherError || teacher?.role !== "teacher" || !email) {
      return json({ error: "Teacher profile could not be found." }, 404, origin);
    }
    if (teacher.is_active === false) {
      return json({ error: "Reactivate the teacher before sending a setup link." }, 400, origin);
    }

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
      console.error("Teacher recovery token generation failed:", linkError);
      return json({ error: "A new setup link could not be generated." }, 400, origin);
    }

    try {
      await sendAuthEmail({
        to: email,
        recipientName: teacher.full_name,
        flow: "recovery",
        tokenHash,
      });
    } catch (emailError) {
      console.error("Teacher setup email failed:", emailError);
      return json({ error: "The setup email could not be delivered. Check the Resend configuration and try again." }, 502, origin);
    }

    return json({ message: `A new password setup link was sent to ${email}.` }, 200, origin);
  } catch (error) {
    console.error("Unexpected resend setup error:", error);
    return json({ error: "Unexpected setup-link error." }, 500, origin);
  }
});
