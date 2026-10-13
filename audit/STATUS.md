# RNL bug-fix report — 13 October 2026

Scope: RNL admin and shared tablet POS. Google authentication, backend identity/role setup, and payroll rate changes are deferred by the user. QRK's separate project is untouched. Approved financial shifts remain Asia/Manila 08:00–20:00 and 20:00–08:00, anchored to clock-in. Half portions consume 50% of ingredients.

## Fixed and verified

| Problem | Fix | Evidence |
|---|---|---|
| Overnight orders landed on calendar date, not shift business date | Resolve date from originating session/shift, falling back to the saved first-shift boundary | Database regressions pass; late session clock-out stays on the original date |
| Half orders cost a full recipe | Scale ingredient quantities by 0.5 | Database half-portion regression and 10,000-order batch pass |
| Net profit excluded expenses | Deduct active PAY_OUT expenses, excluding void reversals | Database profit regression and batch pass |
| Audit counted orphan and voided-order payments | Require an existing, nonvoid source order in backend and client reports | Database and client report regressions pass |
| Voided expenses reduced expected cash | Exclude expenses with their linked void reversal | Database audit regression passes |
| Floating-point artifacts affected variance and totals | Aggregate and subtract integer cents; reuse in audit UI | Client regressions pass |
| Cyclic or missing nested recipes silently understated cost | Mark the calculation incomplete instead of presenting it as fully costed | Both database regressions pass |
| Backlog acknowledgement used table labels | Match the unique device order ID | Offline regression passes |
| Multiple offline partial payments overwrote earlier collections | Persist each collection with its staff/session context; acknowledge each separately | Two-collection and later-snapshot replay regressions pass |
| Retry generated another payment-event ID | Persist stable collection IDs and original timestamps | Idempotent replay regressions pass |
| React deferred state updater could omit payment persistence | Calculate the payment snapshot synchronously before updating state/persisting | Reviewed along with collection replay; build passes |
| Failed clock-in could close the previous session | Atomic server-side session switch, serialized per device and financial shift | Four database assertions pass: retry identity, failed-switch preservation, previous-session closure, one open session |
| Reset partially deleted data when a later delete lacked permissions | One invoker transaction; verify rows cleared and throw on permission failure | Anonymous-role failure leaves seeded orders/requests intact; owner reset clears them in the rollback test |
| Reset could erase the real menu | Remove the menu-clear reset action; reject menu deletion through operational reset API | Reset tests pass; preserved-menu hashes match |
| Stale offline orders could repopulate a reset | Persist reset timestamp, quarantine stale local backlog, reject pre-reset order writes at the database | Database reset protection changes from false before fix to true after fix |
| Live updates missed menu/expenses and reconnect changes | Publish source tables, reconcile on subscribe/reconnect, serialize refreshes, subscribe to payment events/voids/sessions/audits | Publication inventory checked; refresh tests and tablet reconnect check pass |
| POS retained a deleted shift session after reset | Reconcile session and reset/settings changes live | Independent review confirms reset/session gap addressed |

## Validation

- 55 standard unit tests pass.
- 10 additional real-menu calculation audit tests pass, including 10,000 cart lines against integer cents.
- 9 database calculation assertions pass. Fixtures intentionally raise an exception after reporting results so every write rolls back.
- 10,000 synthetic database orders and 10,000 collections: exact sales, half-portion costs, expense-adjusted profit, cash audit, and duplicate-event replay checks pass. One measured run took 1,585 ms. This is a single-transaction batch benchmark, not a multi-client concurrency benchmark.
- Atomic clock-in and reset/permission rollback probes pass.
- Two read-only Playwright checks pass: tablet real-menu load/search/reconnect and phone admin rendering, with database writes blocked in the browser tests.
- TypeScript and production build pass. Independent review found no remaining important issue in this patch.

## Protected baseline and applied changes

Backup: `/home/joshy/Documents/ChatGPT/RNL/backups/menu-and-reset-2026-10-12T15-51-38-337Z`.

89 products and 12 categories match original raw-row hashes, preserving all fields/options/stock. Sixty referenced images were backed up; no storage objects were modified. All 18 operational tables remain empty after tests. The six RNL QRK import receipts were backed up and cleared during the authorized original reset because they referred to discarded RNL orders. QRK's separate database/source was not changed.

Database migrations 202610130001–202610130006 are applied to RNL project `jlhejqrvufylfodsreit`. Frontend changes remain in the local `codex/rnl-admin-pos-design` branch; no web application deployment or GitHub push was performed.

## Remaining broader work

- Configure Google app identities and backend role policies when the user is ready. The atomic reset intentionally respects existing permissions and can reject a browser reset until those permissions are configured; it does not bypass them.
- Define payroll base hours and overtime rate explicitly. Attendance/financial-shift attribution is separate from pay calculation.
- Complete the broader architecture work: atomic order-plus-payment writes, conflict/version handling, and multi-client concurrency tests.
- Full synthetic workflow coverage for approvals, all payment modes, inventory, payroll and physical printer behavior remains beyond this bug-fix batch. The read-only browser checks do not prove those flows end to end.

## Definition of done for the remaining refactor

Approved admin identity and persistent restricted tablet access; server-verified staff PINs; clock-in anchored attendance with agreed payroll rates; atomic/idempotent financial writes; reliable reconnect and conflict handling; menu-derived full workflow fixtures with repeatable cleanup; concurrency and actual printer verification; backend role checks; passing build/tests and independent review before deployment.
