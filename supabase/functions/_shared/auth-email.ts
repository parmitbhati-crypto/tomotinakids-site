export type AuthEmailFlow = "invite" | "recovery";

type SendAuthEmailInput = {
  to: string;
  recipientName?: string | null;
  flow: AuthEmailFlow;
  actionLink: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);

const siteOrigin = () =>
  (Deno.env.get("PUBLIC_SITE_URL") || "https://tomotinakids.com").replace(/\/+$/, "");

// Keep the one-time Supabase URL in the fragment so it is not sent to
// Cloudflare/server request logs or included in the HTTP Referer header.
const continueUrl = (actionLink: string, flow: AuthEmailFlow) =>
  `${siteOrigin()}/portal/auth-action.html#flow=${encodeURIComponent(flow)}&confirmation_url=${encodeURIComponent(actionLink)}`;

export async function sendAuthEmail({
  to,
  recipientName,
  flow,
  actionLink,
}: SendAuthEmailInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("AUTH_EMAIL_FROM");
  const replyTo = Deno.env.get("AUTH_EMAIL_REPLY_TO");

  if (!apiKey || !from) {
    throw new Error("Custom email delivery is not configured.");
  }

  const firstName = (recipientName || "there").trim().split(/\s+/)[0] || "there";
  const buttonUrl = continueUrl(actionLink, flow);
  const isInvite = flow === "invite";
  const subject = isInvite
    ? "Set up your Tomotina Kids staff account"
    : "Reset your Tomotina Kids password";
  const heading = isInvite ? "Welcome to Tomotina Kids" : "Reset your password";
  const intro = isInvite
    ? "Your staff profile is ready. Continue to create a secure password for the Tomotina Kids portal."
    : "A password reset was requested for your Tomotina Kids portal account.";
  const buttonLabel = isInvite ? "Create my password" : "Choose a new password";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f8f7;font-family:Arial,Helvetica,sans-serif;color:#173f40">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f8f7;padding:28px 14px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce9e7;border-radius:18px;overflow:hidden">
            <tr><td style="background:#174e4d;padding:24px 28px;color:#ffffff;font-size:20px;font-weight:700">Tomotina Kids</td></tr>
            <tr>
              <td style="padding:30px 28px">
                <p style="margin:0 0 12px;font-size:15px">Hello ${escapeHtml(firstName)},</p>
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#173f40">${heading}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4f6768">${intro}</p>
                <p style="margin:0 0 26px">
                  <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#d9725b;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">${buttonLabel}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7d7e">For security, the email button first opens a Tomotina confirmation page. The one-time Supabase link is used only after you press Continue.</p>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7d7e">If you did not expect this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hello ${firstName},`,
    "",
    heading,
    intro,
    "",
    `${buttonLabel}: ${buttonUrl}`,
    "",
    "If you did not expect this email, you can safely ignore it.",
  ].join("\n");

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Email provider rejected the request (${response.status}): ${responseText.slice(0, 300)}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}
