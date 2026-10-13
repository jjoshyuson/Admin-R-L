# RNL regression evidence

- `database-calculation-regression.sql`: current deployed calculation checks; expect every boolean in ROLLBACK_REGRESSION_RESULTS to be true.
- `database-stress-regression.sql`: 10,000 menu-derived orders/collections; expect order count10000 and all boolean checks true in ROLLBACK_STRESS_RESULTS. The deliberate exception rolls back all records and settings changes.
- `deployed-calculation-probe.sql`: historical pre-fix reproduction, retained as evidence; use the current regressions for verification.
- `rnl-calculation-audit.test.ts`: uses the protected menu backup. Run `VITE_SUPABASE_URL='' VITE_SUPABASE_ANON_KEY='' npx vitest run --config audit/vitest.config.mjs`.
- `verify-preserved-menu.mjs`: run from the app root with its ignored `.env.local` and optional `RNL_MENU_BACKUP=/absolute/backup/path`. Prints counts/hash comparison, never credentials.
- `tests/rnl-readonly-regression.spec.ts`: run `npx playwright test tests/rnl-readonly-regression.spec.ts --output=/tmp/rnl-readonly-results`. It blocks browser database mutations. Use an output directory outside tracked `output/playwright` to preserve historical screenshots.

Database fixtures require owner SQL access and are not browser RPC calls. They deliberately report results as SQL exceptions so the database remains unchanged. Do not remove their final exception and commit fixture records. Backup files contain private settings and belong outside Git.
