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

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

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
    const fullName = text(body.fullName, 120);
    const email = text(body.email, 254).toLowerCase();
    const designation = text(body.designation, 100);
    const mobile = text(body.mobile, 20);
    const address = text(body.address, 500);
    const employmentType = text(body.employmentType, 20) || "full_time";
    const joiningDate = text(body.joiningDate, 10) || null;
    const aadhaarLast4 = text(body.aadhaarLast4, 4) || null;
    const panLast4 = text(body.panLast4, 4).toUpperCase() || null;
    const active = body.isActive !== false;

    if (!fullName || !designation || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Full name, valid email, and designation are required." }, 400, origin);
    }
    if (aadhaarLast4 && !/^\d{4}$/.test(aadhaarLast4)) {
      return json({ error: "Aadhaar reference must be the final four digits only." }, 400, origin);
    }
    if (panLast4 && !/^[A-Z0-9]{4}$/.test(panLast4)) {
      return json({ error: "PAN reference must be the final four letters/numbers only." }, 400, origin);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name: fullName },
      },
    });

    const actionLink = generated?.properties?.action_link;
    let tokenHash = "";
    try {
      tokenHash = actionLink ? new URL(actionLink).searchParams.get("token") || "" : "";
    } catch {
      tokenHash = "";
    }

    if (linkError || !generated?.user || !tokenHash) {
      const errorMessage = linkError?.message || "";
      const duplicate = /already|registered|exists/i.test(errorMessage);
      console.error("Invite token generation failed:", linkError);
      return json({
        error: duplicate
          ? "A user with this email already exists. Use Resend setup link from Team Directory instead."
          : "The secure invitation link could not be generated.",
      }, duplicate ? 409 : 400, origin);
    }

    const userId = generated.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      role: "teacher",
      specialization: designation,
      is_active: active,
    });
    const { error: detailError } = await admin.from("teacher_profiles").insert({
      user_id: userId,
      email,
      mobile: mobile || null,
      designation,
      address: address || null,
      employment_type: employmentType,
      joining_date: joiningDate,
      aadhaar_last4: aadhaarLast4,
      aadhaar_verified: Boolean(body.aadhaarVerified),
      pan_last4: panLast4,
      pan_verified: Boolean(body.panVerified),
      invitation_status: "invited",
      created_by: authData.user.id,
      updated_by: authData.user.id,
    });

    if (profileError || detailError) {
      console.error("Teacher profile creation failed:", { profileError, detailError });
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "The invitation was rolled back because the staff profile could not be saved." }, 500, origin);
    }

    try {
      await sendAuthEmail({
        to: email,
        recipientName: fullName,
        flow: "invite",
        tokenHash,
      });
    } catch (emailError) {
      console.error("Custom invitation email failed:", emailError);
      await admin.auth.admin.deleteUser(userId);
      return json({
        error: "The profile was rolled back because the invitation email could not be delivered. Check the Resend configuration and try again.",
      }, 502, origin);
    }

    return json({ userId, email, invitationStatus: "invited" }, 201, origin);
  } catch (error) {
    console.error("Unexpected invitation error:", error);
    return json({ error: "Unexpected invitation error." }, 500, origin);
  }
});
