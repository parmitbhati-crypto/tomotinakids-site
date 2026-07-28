# Tomotina Codex project instructions

## Project map

- Public website: static HTML files in the repository root.
- Staff portal: static HTML files in `portal/`.
- Shared styles and browser code: `assets/css/` and `assets/js/`.
- Hosting: Cloudflare Pages project `tomotinakids-site`.
- Production domains: `tomotinakids.com` and `www.tomotinakids.com`.
- GitHub repository: `parmitbhati-crypto/tomotinakids-site`.
- Production branch: `main`.
- Database and authentication: Supabase project `denxlcqhztjrdhawoeja`.

## Working rules

1. Inspect `git status` before editing and preserve unrelated user changes.
2. For normal changes, create a branch prefixed with `codex/`.
3. Test website and portal changes locally before proposing deployment.
4. Never commit a Supabase service-role key, database password, access token, or other server secret.
5. The browser may use only the Supabase project URL and publishable/anon key. Authorization must be enforced with Supabase Row Level Security, not only with browser JavaScript.
6. Before changing the database, inspect the existing schema and policies. Use a migration for final schema changes and run Supabase security/performance advisors afterward.
7. Prefer a GitHub pull request and Cloudflare preview deployment for review.
8. Treat merging or pushing to `main` as a production deployment because Cloudflare Pages automatically deploys that branch. Do it only when the user explicitly approves production deployment.
9. After deployment, verify the Cloudflare deployment succeeded and smoke-test both the public website and affected portal pages.

## Validation

- This is currently a static site with no build command.
- Check affected HTML, CSS, and JavaScript for syntax and broken asset paths.
- Verify authentication and role behavior for portal changes.
- Never use real student or staff data in tests or output.
