# Teacher onboarding operations

The admin portal uses **Team Directory** and **Invite Team Member**. Invitations are sent by the `invite-teacher` Supabase Edge Function; the service-role key remains server-side.

## Release sequence

1. Apply `20260728210417_teacher_onboarding.sql`.
2. Deploy `invite-teacher` with JWT verification enabled.
3. Add `https://tomotinakids.com/portal/set-password.html` to Supabase Auth redirect URLs.
4. Confirm the Auth site URL is `https://tomotinakids.com`.
5. Configure custom SMTP in Supabase Auth before inviting real staff, then send a test to a controlled non-staff address.
6. Deploy the portal preview and test create, email receipt, password setup, teacher login, program access, photo, deactivation, and reactivation.

## Privacy and recovery

- The portal stores only the final four Aadhaar/PAN characters and verification flags. Never enter full government ID numbers.
- Teacher photos are in the private `teacher-photos` bucket and are displayed through one-hour signed URLs.
- Deactivation does not delete the Auth user or historical sessions. Reactivation restores access.
- If program assignment or photo upload fails after an invitation succeeds, the teacher remains in Team Directory so the admin can identify and correct the incomplete profile.
- Supabase Auth invitation expiry and delivery depend on the project's Auth/SMTP settings.
