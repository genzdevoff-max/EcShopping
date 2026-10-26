Continue from `FINAL_FEATURE_VERIFICATION_AND_DEPLOYMENT_AUDIT.md`.

I approve proceeding toward commit and Vercel redeployment, **conditional on the following final safety gate**. Do not skip a failed check or report an unverified check as passed.

### 1. Final pre-commit checks
- Read the audit report and inspect the complete Git diff, including untracked files.
- Confirm all 120 server tests and 53 client tests still pass; run the client production build.
- Verify password-reset security: cryptographically secure tokens, hashed token storage, expiry, single-use enforcement, role isolation, rate limiting, non-enumerating responses, and no sensitive values in logs.
- Confirm the production database migration for `password_resets` is safe, repeatable, and compatible with TiDB. Do not reset, truncate, or modify customer/order data.
- Verify admin deletion is enforced server-side and preserves historical order records.
- Check that `.env`, credentials, app passwords, PhonePe secrets, reset tokens, and other sensitive values are not staged.
- Confirm the backend and frontend Vercel environment variable names and frontend API base URL without printing secret values.
- Report any remaining lint warnings and whether they introduce functional or security concerns.

### 2. Deployment gate
If any critical security, migration, configuration, or regression check fails, **STOP**. Do not commit or deploy; report the failure and recommended fix.

If all checks pass:
1. Summarize the exact files and changes to be committed.
2. Create one clearly named commit containing only these feature changes and required tests/docs. Do not include unrelated work.
3. Deploy the backend Vercel project first and verify its deployment succeeds.
4. Deploy the frontend Vercel project and verify its deployment succeeds.
5. Run safe production smoke tests for all three features. Do not send real password-reset emails to customers, delete production products, or make real payments. Use a controlled test account or non-destructive checks.
6. If a critical issue appears, stop further rollout and report rollback options. Do not perform destructive rollback actions without approval.

Do not rotate, replace, or modify production credentials automatically. Flag any exposed credentials for manual rotation.

### 3. Final report
Provide the commit hash, deployment URLs and status, test results, production checks actually completed, checks not completed, and any remaining warnings. Clearly distinguish local verification from production verification.