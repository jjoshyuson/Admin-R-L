# POS clock flow implementation
User approved the screenshot-based dialogs and independent attendance.
1. Add separate staff attendance records; PIN-verified RPCs control clock-in, clock-out, and optional active-cashier handover. Keep existing financial sessions/order attribution intact. Read attendance only through verified staff RPCs; no public attendance-table access. Carry forward existing open cashier attendance during upgrade.
2. Add a themed tablet dialog: select staff, numeric PIN keypad, attendance status; explicit clock-in or reviewed clock-out. Optional active cashier selection. Clocking out another staff member never closes the tablet cashier; switching cashier never ends attendance.
3. Preserve shift/date by original attendance clock-in and existing overtime attribution. Retain existing server-side financial session transitions and audited-shift checks. Lock the POS when its active cashier clocks out.
4. Tests use browser fixtures and database rollback transactions; no real clock punches. Build/tests and independent review. No Git push, merge or website deployment.

## Verification and delivery
Implemented the shared-theme POS staff dialog, independent attendance, server PIN verification, exact attendance-ID clock-out, and optional cashier handover. Database migrations 007 and 008 applied. Safe POS staff directory omits PINs and wages.

Passed 11 browser checks, 61 unit tests, TypeScript/Vite production build, and 14 rollback-only database assertions. Synthetic database attendance count is zero. Preserved menu comparison: 89 products and 12 categories unchanged. Independent review found no remaining critical attendance issue. Screenshots use synthetic browser fixtures; no real staff clock punches were performed.

Frontend remains local; no push, merge, or public website deployment. Google authentication remains deferred. Existing legacy cashier endpoints and employee-settings authorization require the later authentication work; this change does not claim complete authentication hardening. Payroll rates remain separate from attendance.
