# Tomotina security and reliability runbook

This runbook covers the Supabase project `denxlcqhztjrdhawoeja` and the portal hosted through Cloudflare Pages.

## Access model

| Role | Permitted access |
|---|---|
| Public visitor | Submit a constrained website enquiry only. |
| Pending account | Read its own profile long enough to receive an approval message; no portal records. |
| Teacher | Own profile, program catalogue, own program assignments, assigned sessions, students attached to those sessions, related session updates, own attendance, and signed links for assigned student photos. |
| Administrator | Manage schedules, programs, students, registrations, enquiries, teacher program assignments, attendance, and private student photos. |
| Service role | Server-side emergency/maintenance access only. It must never appear in browser code. |

Authorization is enforced by database grants and RLS. Browser navigation is only an additional usability control.

## Release procedure

The migration and portal code must be released together because the `student-photos` bucket changes from public URLs to private signed URLs.

1. Confirm the latest downloadable or restorable database backup in **Supabase Dashboard → Database → Backups**.
2. Record the current Cloudflare production deployment and Git commit.
3. Apply `supabase/migrations/20260728191912_harden_portal_access.sql`.
4. Run `supabase/tests/phase4_security_checks.sql`.
5. Deploy the matching website commit.
6. Test with one administrator and one teacher:
   - Administrator can manage registrations, schedules, attendance, and enquiries.
   - Teacher sees only assigned students and sessions.
   - A private student photo loads for an authorized administrator.
   - A signed-out request cannot read any portal table.
7. Run Supabase security and performance advisors and resolve new findings.

Do not apply only half of this release.

## Backup policy

- Confirm automatic daily backups are active every Monday.
- For a paid production project, decide whether the recovery-point objective requires Point-in-Time Recovery. Enabling PITR is a billing decision and must be approved by the project owner.
- Take a logical schema-and-data export before high-risk migrations and store it encrypted outside the project.
- Supabase database backups do **not** restore deleted Storage objects. Maintain a separate protected copy of the `student-photos` bucket.
- Quarterly, perform a restore drill into a separate non-production project and record the duration and result.

Never commit a database password, access token, service-role key, or backup containing family information.

## Monitoring

- Administrators can review sanitized browser errors at `/portal/system.html`.
- Review Supabase **Logs Explorer** for Auth, API, Storage, and Postgres errors.
- Review Supabase security and performance advisors monthly and after every migration.
- Subscribe the operations mailbox or team channel to Supabase status updates.
- On supported plans, configure a log drain to the approved monitoring provider with an explicit retention policy.

Client monitoring stores only timestamp, authenticated actor ID, page path, error type, and a sanitized message. It deliberately excludes form values, query results, stack traces, emails, UUIDs in messages, and student information.

## Audit review

Sensitive database changes create metadata-only entries in `private.audit_log`. The table records actor, table, row identifier, operation, timestamp, and changed field names. It does not duplicate record contents.

Example administrator review from the SQL editor:

```sql
select occurred_at, actor_id, table_name, row_id, operation, changed_fields
from private.audit_log
where occurred_at >= now() - interval '30 days'
order by occurred_at desc
limit 500;
```

Retain audit entries according to the centre's approved data-retention policy. Do not delete audit records during an active investigation.

## Incident response

1. Contain: disable the affected account, revoke active sessions, and rotate any exposed secret.
2. Preserve: export relevant audit, Auth, API, Storage, and Postgres logs.
3. Assess: identify affected tables, objects, users, and time window without copying unnecessary child data.
4. Recover: prefer a forward fix. If data integrity is compromised, restore to a separate project first, validate, and schedule production downtime before a final restore.
5. Verify: run the Phase 4 security checks, advisors, and role-based smoke tests.
6. Document: record timeline, cause, impact, recovery steps, and prevention work.

## Recovery targets

The project owner should approve:

- Recovery Point Objective (maximum acceptable data loss)
- Recovery Time Objective (maximum acceptable downtime)
- Backup retention period
- Storage-object backup destination
- Monitoring and incident-notification recipients

Until those values are approved, daily backup availability should not be treated as a complete disaster-recovery plan.
