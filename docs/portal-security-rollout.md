# Portal security rollout

This rollout is intentionally staged so the first administrator cannot be
locked out while multi-factor authentication is being introduced.

## Stage 1: active now

- Public Supabase email signup is disabled in the production dashboard.
- The `20260728224440_enforce_active_accounts_and_admin_mfa.sql` migration is
  applied.
- Restrictive RLS requires an active admin or teacher profile for every portal
  table and for the student and teacher photo buckets.
- Administrator checks also require an active profile.

## Stage 2: deploy the portal security release

Deploy the branch containing:

- administrator TOTP setup and challenge pages;
- generic login failures;
- 10-character client-side password validation;
- portal `noindex`, `no-store`, clickjacking, MIME-sniffing, referrer, and
  permissions headers;
- optional Cloudflare Turnstile support.

After deployment, sign in as an administrator and complete the authenticator
setup. Store the authenticator recovery information in the centre's approved
password manager.

## Stage 3: enforce administrator MFA in RLS

Only after every administrator has successfully signed in with TOTP, apply:

`supabase/rollouts/enable_admin_mfa_after_enrollment.sql`

Verify that an AAL1 administrator cannot read portal tables and that an AAL2
administrator can. Keep the Supabase owner account available as the emergency
recovery path.

## Stage 4: enable Turnstile

1. Create a managed Turnstile widget restricted to `tomotinakids.com`,
   `www.tomotinakids.com`, and the Cloudflare Pages preview hostname.
2. Configure the widget secret in Supabase Auth CAPTCHA protection.
3. Put only the public site key in `assets/js/env.js`.
4. Deploy the code and Supabase CAPTCHA setting together.
5. Test successful login, failed login, password reset, expiration, and a
   blocked/failed challenge on desktop and mobile.

Do not enable the Supabase CAPTCHA setting before the matching site key is
deployed, because that would reject legitimate login requests.

## Password and leaked-password protection

Production and repository configuration require at least 10 characters with
lowercase, uppercase, digits, and symbols.

Supabase leaked-password protection is unavailable on the current Free plan.
Enable it immediately after upgrading the project to Pro.

## Recovery checks

- Confirm at least two trusted administrators have working MFA before removing
  any recovery access.
- Test deactivating a non-production teacher account and confirm all database
  and photo access stops immediately.
- Review Supabase Auth and database logs after rollout.
- Run Supabase security and performance advisors after every migration.
