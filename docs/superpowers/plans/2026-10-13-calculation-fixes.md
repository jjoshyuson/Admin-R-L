# RNL Calculation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct the reproduced RNL calculations without altering menu data or implementing Google authentication.

**Architecture:** Preserve existing RPC interfaces and fix their database implementations through one versioned migration. Pin client calculations and database behavior with repeatable regression fixtures that roll back all synthetic writes.

**Tech Stack:** React, TypeScript, Vitest, Supabase Postgres.

**Spec:** audit/STATUS.md and user instructions: fix confirmed bugs, defer Google authentication; half orders consume 50% ingredients.

## Global Constraints
- RNL only; preserve 89 products, 12 categories and image objects.
- Asia/Manila shifts begin 08:00 and 20:00; shift/session metadata controls business date, including overtime.
- Defer Google auth and payroll rate changes.
- All database test fixtures roll back to the operational zero baseline.

## Review Focus
- Collections on orders from earlier shifts stay with the collecting shift.
- Voided expenses and orders do not inflate expected collections or expense deductions.
- Recipes with cycles or missing nested references flag incomplete costing.
- Same-day ingredient price changes use a deterministic latest update.
- Fractional peso aggregation agrees with numeric database precision.

### Task 1: Database calculation corrections
**Files:** supabase/migrations/202610130001_rnl_calculation_fixes.sql, audit/database-calculation-regression.sql.
**Interfaces:** preserve calculate_daily_accounting(date), approve_shift_audit(text,date,text,numeric,numeric,text,text,text). Add rnl_business_date(timestamptz,text,uuid) -> date for shared attribution.
- [x] Write and execute rollback assertions for overnight attribution, 50% cost, expense-adjusted net profit, orphan/void collection exclusion and voided expense exclusion; confirm failures on original functions.
- [x] Implement original RPCs with common business-date resolution, portion scaling, deterministic prices and incomplete nested-cost flags. Audit excludes missing/void orders and voided expenses, validates shift identity and counted values.
- [x] Execute rollback assertions; confirm all pass and operational counts remain zero.

### Task 2: Client report consistency
**Files:** src/lib/shiftService.ts, src/lib/shiftService.test.ts.
**Interfaces:** existing exported report and totals signatures remain unchanged.
- [x] Add failing cent-aggregation and void-filter tests.
- [x] Fix integer-cent aggregation and load only nonvoid orders/payment sources.
- [x] Run the complete unit suite, menu-derived audit and build.

### Task 3: Workflow and sync investigation
**Files:** audit/STATUS.md and relevant isolated service/tests after reproduction.
- [x] Reproduce offline retry/reset and attendance races before fixes; preserve stable identifiers and test each fix.
- [x] Review migration and client diff independently, address important findings, verify menu hashes and empty operational tables.

## Execution record

Implemented inline under the user's authorization to fix the confirmed bugs and continue. Review identified offline partial-collection overwrite and retry IDs; both fixed and re-reviewed. Clock-in was made atomic after confirming the close-before-insert failure path. Actual publication inventory exposed missing Realtime source tables, so publication and report/session subscriptions were corrected. Full concurrency and atomic order-plus-payment architecture remain explicitly recorded in audit/STATUS.md as broader follow-up; they are not claimed complete by this batch.
