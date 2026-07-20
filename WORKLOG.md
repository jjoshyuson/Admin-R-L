# Admin Web Worklog

## Current Status

- Step 1 complete: blank mobile shell scaffolded, runnable, and build-verified.
- Dashboard UI implemented from Gemini-provided mobile reference.
- Inventory module in progress with separate overview, configuration, and purchase-modal states.

## Required Rule For Every Future Feature

- Ask the user which area/tab is in scope.
- Ask the user which screenshots or screens are the reference.
- Wait for those inputs before implementing.

## Feature Queue

- Menu
- Dashboard
- Inventory
- Daily Log
- Recipes
- Finance
- Sync
- Order History
- Settings / menu settings

## Verification Template

### Feature

- Area:
- Reference screens received:
- Android baseline reviewed:
- Implemented:
- Screenshot captured:
- Gemini review complete:
- Revisions applied:
- Accepted:

### Feature

- Area: Dashboard
- Reference screens received: Gemini_Generated_Image_eb5ifheb5ifheb5i.png
- Android baseline reviewed: Yes, dashboard-related models and sections in `adminapp`
- Implemented: Static mobile dashboard shell with visual sections mapped to the reference
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Inventory
- Reference screens received: Gemini_Generated_Image_yqbz1wyqbz1wyqbz.png
- Android baseline reviewed: Yes, inventory and purchase-log related admin flows were checked
- Implemented: Separate InventoryOverviewScreen, InventoryConfigurationScreen, LogPurchasedIngredientsModal, and Fix Count modal using mock state
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Product Management / Menu Settings
- Reference screens received: Menu Settings list, Category Management, Edit Menu Item modal
- Android baseline reviewed: No explicit Android menu settings mapping in this step; implemented as web-first management flow inside Settings / More
- Implemented: MenuSettingsScreen, CategoryManagementScreen, reusable ProductEditModal, live search/filter/edit/reorder/delete flows
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Order History / Recipes / Logs
- Reference screens received: mobile order history, recipes, and logs references plus unified SaaS redesign direction
- Android baseline reviewed: No explicit Android module mapping in this step; implemented as unified web system across existing routes and tab shell
- Implemented: shared card system, standardized headers/filters/badges, OrderHistoryScreen under More, RecipesScreen under More, and LogsScreen under Daily Log
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Finance
- Reference screens received: Gemini_Generated_Image_j69ciaj69ciaj69c.png
- Android baseline reviewed: No explicit Android finance module mapping in this step; implemented under existing Settings / More finance routes only
- Implemented: CashOverviewScreen, CashDrawerStatusScreen, BillsPayablesScreen, ProfitInsightsScreen, updated Finance labels in Settings / More, and formula validation for totals/differences/margins
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Finance / Cash Control
- Reference screens received: cash control behavior spec in thread
- Android baseline reviewed: No explicit Android cash-control mapping in this step; existing Finance route updated in place under Settings / More
- Implemented: Cash Control account cards, Transfer/Adjust/Cash Pull actions, audit logs, log detail modal, validation guards, and in-code movement logging
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Full Admin functional data integration
- Reference screens received: Android admin app baseline plus existing admin-web screens
- Android baseline reviewed: Yes, `AdminRepository.kt`, `SupabaseAdminOrderService.kt`, shared finance/menu models, and local Supabase SQL contracts
- Implemented: Supabase web client foundation, typed admin API and mappers, shared admin data provider, feature hooks (`useDashboardData`, `useOrdersSync`, `useMenuCatalog`, `useRecipesAccounting`, `useFinanceData`, `useInventoryState`), live dashboard/order/menu/recipe/log/finance/payables wiring, optimistic menu and finance mutations, reset flow wiring, sync detail screen, and mapper tests
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: More > Sync Data & Logs
- Reference screens received: Android admin app sync screen baseline, current admin-web More flow, and user instruction that the screen is for troubleshooting
- Android baseline reviewed: Yes, sync-related repository/service behavior already mirrored into the shared web data layer
- Implemented: live sync troubleshooting panel with Supabase connection state, last successful refresh timestamp, dataset row counters, refresh action, recent sync activity feed, and empty/error guidance when nothing is syncing
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Admin Web repo setup documentation
- Reference screens received: None, documentation task only
- Android baseline reviewed: Not applicable
- Implemented: step-by-step GitHub, Git initialization, Supabase env, deployment, and troubleshooting guide for `admin-web`
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Admin Web local Supabase config fallback
- Reference screens received: None, local environment wiring task only
- Android baseline reviewed: Yes, reused the existing `local.properties` Supabase values already used by the Android project
- Implemented: corrected local setup to keep `admin-web` standalone by creating `admin-web/.env.local` from the existing local Supabase values instead of reading `../local.properties` at runtime
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: PWA installability / home-screen support
- Reference screens received: None, infrastructure task only
- Android baseline reviewed: Not applicable
- Implemented: Vite-safe `manifest.webmanifest`, 192x192 and 512x512 PNG app icons, iOS touch icon and standalone meta tags, HTTPS-safe service-worker registration in `main.tsx`, and a conservative service worker for installability/offline shell fallback
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: More > Sync Data & Logs diagnostics correction
- Reference screens received: user-provided screenshot of the current sync screen
- Android baseline reviewed: Yes, compared expected sync/accounting behavior against `AdminRepository.kt` and local Supabase SQL contracts
- Implemented: removed misleading sync-status fallback counts from the troubleshooting panel, made refresh completion update direct in the shared data provider, added a `Seed Test Sync Data` troubleshooting action that populates orders/accounting/recipes/finance rows in Supabase for local admin-web verification, rewired both the Sync screen Refresh button and the middle navbar Sync button to execute live data refresh instead of navigation-only behavior, verified the seed path produces live rows plus a successful `calculate_daily_accounting(...)` result, and fixed a confirmed `React.StrictMode` mounted-flag bug in `AdminDataContext` that was preventing completed Supabase fetches from ever updating the UI during local development
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Feature

- Area: Dashboard / Daily Log / Order History / Recipes / POS-only mode functional repair
- Reference screens received: user instruction to mirror Android adminapp behavior for the web admin, with the Android admin app as the functional baseline and the existing admin-web screens as the current UI shell
- Android baseline reviewed: Yes, `AdminRepository.kt`, `AdminModels.kt`, and `AdminApp.kt` were rechecked for `DashboardMetricsPeriod`, order void/history behavior, recipe profit/detail behavior, daily log copy-forward behavior, and POS-only mode gating
- Implemented: removed dead mock fallbacks from dashboard/order-history/recipes/daily-log paths, wired the dashboard Today/WTD/MTD buttons to real filtered calculations, replaced the dead sales-range button with a live range selector (Today, Last 7 Days, Week to Date, Month to Date, All Time), made the dashboard breakdown and top-products sections recalculate from live non-voided Supabase orders, enforced POS-only tab/route hiding with persisted mode behavior, added a Daily Log `+` flow that copies the latest ingredient-price structure into a new dated draft and saves it back through Supabase plus `calculate_daily_accounting`, made Order History rows clickable with a detailed order sheet and confirmed void-authority write flow, and added a live recipe editor sheet with ingredient-catalog validation, recalculated cost/profit snapshot fields, and Supabase-backed save behavior
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Validation

- Files touched: `admin-web/src/App.tsx`, `admin-web/src/style.css`
- Build: `npm run build` passed
- Tests: `npm test -- --runInBand` passed
- Manual code verification completed for:
- dashboard range buttons update the computed metric cards
- sales-range selector updates chart data, sales breakdown, and top products
- Daily Log `+` opens a copied draft and saves ingredient price rows through the existing accounting API
- Order History cards open detail and use the existing `order_voids` authority path instead of deleting orders
- recipe editor recalculates totals from live ingredient logs and saves through `saveRecipeSet`
- POS-only mode hides inventory/daily-log routes and admin-heavy More entries while keeping the mode switch available
- Remaining limitations:
- screenshot verification and Gemini review are still pending
- order details can only show fields currently present in the web `orders` schema; discounts, change, modifiers, and cashier name are displayed as unavailable when the raw row does not provide them
- recipe cost calculations currently require matching units on recipe lines and ingredient price logs; unit conversion fallbacks are flagged but not automatically converted

### Feature

- Area: More > Menu Settings and Recipes separation
- Reference screens received: user-provided recipe editor screenshot used as a light reference, plus the existing admin-web shell and Android admin app behavior as the functional baseline
- Android baseline reviewed: Yes, menu sync and recipe ownership behavior were checked against `AdminModels.kt`, `SupabaseAdminOrderService.kt`, and related adminapp flows
- Implemented: fixed the menu sync path to persist shared menu data back to Supabase with full create/update/deactivate behavior, added `halfOrderPrice` support in the shared menu product payload with a legacy fallback when the column is unavailable, made Menu Settings available in both Full Admin and POS Only, added a floating add-menu button with a clean menu/product form, moved recipe ownership so sellable products are created in Menu Settings while Recipes links costing to existing menu items, changed the Recipes plus action to create prep products only, constrained recipe ingredient choices to Daily Log ingredients plus prep products, added clear Daily Log empty-state guidance, and removed stale UI assumptions that kept these screens from using the same live data source
- Screenshot captured: No
- Gemini review complete: No
- Revisions applied: No
- Accepted: No

### Validation

- Files touched: `admin-web/src/App.tsx`, `admin-web/src/style.css`, `admin-web/src/lib/adminApi.ts`, `admin-web/src/lib/adminTypes.ts`
- Build: `npm run build` passed
- Tests: `npm test` passed
- Manual code verification completed for:
- Menu Settings now uses the live shared menu dataset and exposes the add-menu flow in both Full Admin and POS Only
- menu save/delete now go through the Supabase sync path with error handling and legacy `half_order_price` fallback logging
- Recipe screen now separates menu-linked recipes from prep products and only offers ingredient selection from Daily Log derived options
- prep products can be selected as recipe inputs without making the recipe tab the creation point for sellable products
- Remaining limitations:
- screenshot verification and Gemini review are still pending
- inventory sync, inventory dashboard repair, and Android reset/test-data tools were not part of this scoped pass and still need separate implementation

## Stabilization Debug Pass (2026-05-03)

### Attempt 1

- What was broken: Menu Settings read live Supabase data but web create/update/delete did not persist; menu and recipe cards showed broken image placeholders; the floating `+` button lived in scroll flow instead of staying fixed; category persistence still had unhandled async save paths that could surface as runtime failures.
- Suspected cause: `saveMenuCatalog(...)` was posting unsupported `half_order_price` data and uppercase status values into the `products` table, product rows were returning literal `"null"` image strings, fallback art data URIs were being treated as persisted image paths, and category reorder/save/delete calls were firing `void persistMenuCatalog(...)` without error handling.
- Files changed: `src/App.tsx`, `src/style.css`, `src/lib/adminApi.ts`
- Command run: `npm run build`; `npm test`; inline Playwright audit scripts against `http://127.0.0.1:4173`
- Test result: reproduced failed Supabase writes before the fix, confirmed post-fix create/edit/delete returned successful Supabase mutations, and cleared browser console/page errors in the repaired flow
- Screenshot filename: `debug-screenshots/01-menu-settings-load.png`, `debug-screenshots/02-menu-add-modal.png`, `debug-screenshots/03-menu-after-save.png`, `debug-screenshots/04-menu-after-edit.png`, `debug-screenshots/05-menu-after-delete.png`
- Remaining issue if any: current Supabase `products` schema in this environment has no `half_order_price` or `half_price` column, so half-order values are validated in the UI but cannot persist until the backend schema adds a supported column

### Attempt 2

- What was broken: Daily Log needed revalidation, Recipe tab buttons needed click verification, Add Prep Product needed a non-crashing path, and the hosted-style build path still needed a blank-page check around the Menu `+` flow.
- Suspected cause: the core tab wiring was already present, but the previous runtime failures in shared menu persistence and image rendering were contaminating adjacent flows and making the app feel unstable.
- Files changed: `src/App.tsx`, `tests/smoke.spec.ts`, `playwright.config.ts`, `package.json`
- Command run: `npm run test:smoke`; inline Playwright production sanity script against `http://127.0.0.1:4174`
- Test result: Daily Log opened, Recipes opened, Create Recipe opened, Add Prep Product opened, tablet/mobile layout screenshots rendered cleanly, and the production preview run reported `CONSOLE_ERRORS=0` and `PAGE_ERRORS=0`
- Screenshot filename: `debug-screenshots/06-daily-log.png`, `debug-screenshots/07-recipe-tab-load.png`, `debug-screenshots/08-recipe-editor.png`, `debug-screenshots/09-prep-product-modal.png`, `debug-screenshots/10-mobile-menu-settings.png`, `debug-screenshots/11-tablet-menu-settings.png`, `debug-screenshots/12-tablet-recipes.png`
- Remaining issue if any: Recipes still correctly shows the Daily Log empty state in this dataset because there are no ingredient price logs yet; this is intentional and no longer crashes

### Attempt 3

- What was broken: there was no repeatable browser regression suite for the critical admin flows.
- Suspected cause: validation had been manual-only, so menu CRUD, tab navigation, and responsive layout regressions were easy to reintroduce.
- Files changed: `playwright.config.ts`, `tests/smoke.spec.ts`, `package.json`
- Command run: `npm run test:smoke`
- Test result: 3 Playwright smoke tests passed covering menu CRUD with refresh persistence, Daily Log and Recipes navigation/modal flows, and tablet-width rendering
- Screenshot filename: same numbered files above are now generated by the smoke suite as part of the validation loop
- Remaining issue if any: screenshot review by Gemini is still pending because no external Gemini pass was run in this stabilization session

### Attempt 4

- What was broken: the web UI still exposed half-order pricing even when the live Supabase `products` schema had no supported half-price column, so the form implied persistence that the backend could not honor.
- Suspected cause: the schema probe in `adminApi.ts` only affected write payload shaping; the capability was never surfaced to React state, the editor still rendered `Half Order Price`, and the smoke test assumed that field always existed.
- Files changed: `src/lib/adminApi.ts`, `src/hooks/AdminDataContext.tsx`, `src/hooks/useMenuCatalog.ts`, `src/App.tsx`, `tests/smoke.spec.ts`, `vitest.config.ts`
- Command run: `npm run build`; `npm test`; `npm run test:smoke`
- Test result: all three commands passed after exposing `halfOrderPriceSupported` through the data context, hiding the unsupported editor field behind a visible schema warning, constraining save behavior to default price only when unsupported, and making the Playwright smoke test branch on actual UI capability instead of assuming the field exists.
- Screenshot filename: `debug-screenshots/02-menu-add-modal.png`, `debug-screenshots/07-recipe-tab-load.png`
- Remaining issue if any: half-order pricing still cannot persist until the backend schema adds `half_order_price` or `half_price`; the app now states that limitation explicitly instead of failing silently

### Attempt 5

- What was broken: half-order pricing existed in the Android admin domain models but there was still no checked-in Supabase schema patch to add that field to `public.products`, so the backend contract remained incomplete.
- Suspected cause: the web and Android apps evolved a `halfOrderPrice` concept in the UI/domain layer, but the published Supabase setup files only covered finance, daily accounting, split payments, and policies.
- Files changed: `..\SUPABASE_MENU_HALF_PRICE.sql`, `GITHUB_SUPABASE_SETUP.md`
- Command run: `npm run build`
- Test result: build still passed after adding a dedicated SQL patch file and documenting it in the setup guide; no app-code regression was introduced.
- Screenshot filename: none
- Remaining issue if any: the SQL patch is checked in locally but still needs to be executed in the live Supabase project before half-order pricing becomes persistable end to end

### Attempt 6

- What was broken: hosted users could hit an application-error screen with `Cannot read properties of null (reading 'useMemo')`, which matched a stale bundle / cache mismatch symptom instead of a stable local code-path crash.
- Suspected cause: `src/main.tsx` registered `public/sw.js` automatically on HTTPS hosts, and that service worker cached scripts/styles indefinitely under `ooh-admin-*` keys, making it possible to serve mismatched assets after deploys.
- Files changed: `src/main.tsx`
- Command run: `npm run build`; `npm run test:smoke`
- Test result: build passed and all 3 Playwright smoke tests still passed after disabling service-worker registration by default and unregistering/clearing old `ooh-admin-*` caches on load.
- Screenshot filename: existing smoke screenshots regenerated during `npm run test:smoke`
- Remaining issue if any: if a hosted environment explicitly needs offline/PWA behavior later, service-worker registration should be re-enabled intentionally with versioned cache invalidation instead of the previous always-on caching behavior

### Attempt 7

- What was broken: the Menu Settings `+` button crashed on the phone/network path with `crypto.randomUUID is not a function`.
- Suspected cause: the create flow for new menu items, recipes, and several seeded records called `crypto.randomUUID()` directly, but that API is not available in every mobile browser/runtime even when `window.crypto` exists.
- Files changed: `src/lib/randomId.ts`, `src/App.tsx`, `src/lib/adminApi.ts`
- Command run: `npm run build`; `npm run test:smoke`
- Test result: build passed, Playwright smoke tests stayed green, and all direct `crypto.randomUUID()` usages were removed in favor of a shared compatible helper with `randomUUID`, `getRandomValues`, and timestamp/random fallbacks.
- Screenshot filename: existing smoke screenshots regenerated during `npm run test:smoke`
- Remaining issue if any: the phone should be retested against the current dev server or next deploy, but this specific `crypto.randomUUID` crash path is now fixed in code

### Attempt 8

- What was broken: Daily Log records could not be reopened from the list, the Daily Log editor had no `Add Ingredient` action, Reset Data did not expose the Android-style action list, and the browser validation loop surfaced repeated React duplicate-key console errors in Menu Settings.
- Suspected cause: the web Daily Log list rendered saved records as passive cards instead of buttons, the editor only exposed copied rows with no manual add path, the reset flow was still using a single confirmation modal instead of discrete actions, and category names from Supabase were being used directly as React keys without deduping repeated labels.
- Files changed: `src/App.tsx`, `src/style.css`, `src/lib/adminApi.ts`, `tests/smoke.spec.ts`
- Command run: `npm run build`; `npm run test:smoke`
- Test result: build passed; Playwright smoke tests passed 4/4 after adding Daily Log reopen/add-ingredient coverage, Reset Data action coverage, and deduping category option/chip rendering to clear the console error gate.
- Screenshot filename: `debug-screenshots/06-daily-log.png`, `debug-screenshots/07-recipe-tab-load.png`, `debug-screenshots/08-recipe-editor.png`, `debug-screenshots/11-tablet-menu-settings.png`, `debug-screenshots/12-tablet-recipes.png`
- Remaining issue if any: the smoke suite validates the presence and non-crashing behavior of reset actions, but it intentionally does not execute destructive resets against the live Supabase dataset.

### Attempt 9

- What was broken: the bottom navigation looked cramped on mobile, and Add Menu save needed extra hardening because the phone flow was being reported as non-responsive even though desktop/browser automation could save successfully.
- Suspected cause: the bottom-nav item sizing was too tight for the current icon/text mix, and the Add Menu sheet relied on a footer `onClick` button instead of a real form submit path, which is more fragile on mobile tap/keyboard flows. The menu save path also did not explicitly ensure a missing selected category was added before persisting.
- Files changed: `src/App.tsx`, `src/style.css`
- Command run: `npm run build`; `npm run test:smoke`
- Test result: build passed; Playwright smoke tests passed 4/4 after converting the Add Menu sheet to a real form submit, adding a safe fallback for missing categories before persistence, refreshing the menu catalog after save, and increasing bottom-nav spacing/icon-label sizing.
- Screenshot filename: `debug-screenshots/01-menu-settings-load.png`, `debug-screenshots/02-menu-add-modal.png`, `debug-screenshots/10-mobile-menu-settings.png`
- Remaining issue if any: this pass validates the save flow and layout in automated browser runs, but the hosted/phone environment should still be refreshed to pick up the latest bundle before retesting taps manually.

### Attempt 10

- What was broken: adding menu items still behaved inconsistently when category state in Supabase was dirty, category chips could appear duplicated, and deleting a category could reassign products into a non-existent placeholder bucket, which made the category state look corrupted across admin surfaces.
- Suspected cause: the web layer was treating category IDs as disposable local IDs instead of reconciling them against existing Supabase category identities by name. That allowed duplicate category rows to be minted for the same label, and category deletion used the string `Uncategorized` without ensuring that category actually existed before reassigning products.
- Files changed: `src/App.tsx`
- Command run: `npm run build`; `npm run test:smoke`
- Test result: build passed; Playwright smoke tests passed 4/4 after canonicalizing categories by normalized name, reusing existing cloud category IDs during menu persistence, deduping incoming remote category rows for UI state, and creating/using a real fallback category during delete reassignments.
- Screenshot filename: existing smoke screenshots regenerated during `npm run test:smoke`
- Remaining issue if any: this pass repairs the web category identity logic, but any already-created duplicate category rows in Supabase from older buggy sessions may still need one cleanup pass if they remain inactive clutter in the backend.

### Attempt 11

- What was broken: Order History showed full order IDs in the list, Category Settings had no category icon customization, Cash Control could crash with `Invalid time value`, and Cash Overview did not expose the Bank / GCash account balance.
- Suspected cause: the order list reused the raw `deviceOrderId`, category metadata only tracked name/order/description, Cash Control formatted placeholder activity text as a real date, and the GCash account balance was not separated from daily digital-payment sales in the overview.
- Files changed: `src/App.tsx`, `src/style.css`, `src/lib/mappers.ts`
- Command run: `npm run build`; `npm test`; `npm run test:smoke`; targeted Playwright check for Cash Control and Cash Overview
- Test result: build passed; unit tests passed 3/3; Playwright smoke tests passed 4/4; targeted browser run opened Cash Control without page errors and confirmed Cash Overview shows `GCash Balance`.
- Screenshot filename: `debug-screenshots/13-cash-control.png`, `debug-screenshots/14-cash-overview-gcash.png`
- Remaining issue if any: category icon choices are stored locally in admin-web browser storage because the current Supabase category schema does not include an icon column.

### Attempt 12

- What was broken: Cash Overview treated `Digital` and `GCash Balance` as separate visible lines even though the user expects one GCash line, and the headline total still read like physical cash-on-hand instead of cash-plus-GCash sales intake.
- Suspected cause: the previous repair added a separate GCash balance field instead of renaming the existing digital-payment line and recalculating the overview total around Tablet 1 + Tablet 2 cash sales plus GCash.
- Files changed: `src/App.tsx`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:4175/`
- Test result: build passed; unit tests passed 3/3; targeted browser run confirmed `GCash` is visible, `GCash Balance` is gone, `Cash + GCash Total` is visible, and there were no page or console errors.
- Screenshot filename: `debug-screenshots/15-cash-overview-gcash-label.png`
- Remaining issue if any: none for this Cash Overview label/calculation correction.

### Attempt 13

- What was broken: the category icon setting used a native text dropdown, which made the icon customization feel like selecting labels instead of choosing icons.
- Suspected cause: the first icon pass reused a simple `<select>` for speed instead of a visual icon picker.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:4175/`
- Test result: build passed; unit tests passed 3/3; targeted browser run confirmed the category editor has no native select, shows the icon picker grid, exposes 7 icon choices, and has no page or console errors.
- Screenshot filename: `debug-screenshots/16-category-icon-picker.png`
- Remaining issue if any: none for the picker UI shape; the icon choices still persist locally until the Supabase category schema gets an icon column.

### Attempt 14

- What was broken: the visual icon picker still looked too sparse and generic because it only exposed 7 small monochrome choices.
- Suspected cause: the icon picker was a quick replacement for the dropdown, not a complete category icon tray.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:4175/`
- Test result: build passed; unit tests passed 3/3; targeted browser run confirmed the picker has no native select, shows 22 icon choices, and has no page or console errors.
- Screenshot filename: `debug-screenshots/17-category-icon-picker-expanded.png`
- Remaining issue if any: none for the expanded picker; icon values still persist locally until the Supabase category schema gets an icon column.

### Attempt 15

- What was broken: there was no flexible Operating screen for sales totals over a custom date range, Order History still displayed a static non-functional date range control, and Cash Overview was labeled like sales intake instead of current cash availability.
- Suspected cause: the existing dashboard sales trend logic was period-based, not user-entered date-range based, and Order History kept a placeholder date range button from the static UI pass.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright checks against `http://127.0.0.1:4175/`
- Test result: build passed; unit tests passed 3/3; browser checks confirmed the new `Sales Range` Operating row opens, Sales Range has two date inputs and totals cash + GCash correctly, Order History now has two working date inputs, and Cash Overview labels the headline as `Total Cash Available` with the Main Safe included in the total row.
- Screenshot filename: `debug-screenshots/19-sales-range-screen.png`, `debug-screenshots/20-order-history-date-range.png`, `debug-screenshots/22-sales-range-total-fixed.png`, `debug-screenshots/23-cash-overview-current-cash.png`
- Remaining issue if any: none for this scoped sales-range and date-filter pass.

### Attempt 16

- What was broken: Dashboard Sales Trend and Financial Summary were mixing payment definitions. Split-payment rows could make cash include GCash, and Financial Summary labels such as `Today Cash` were reading the dashboard chart range instead of the selected metrics period.
- Suspected cause: dashboard calculations used raw `order.total`, `cashAmount`, and `gcashAmount` in different places, while the live order data can store GCash separately and still keep cash-like collected fields populated.
- Files changed: `src/App.tsx`, `src/lib/mappers.ts`, `src/lib/mappers.test.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:4175/`
- Test result: build passed; unit tests passed 4/4 including a split-payment regression; browser check confirmed the Financial Summary now reads from the selected metrics period and no page or console errors occurred.
- Screenshot filename: `debug-screenshots/26-dashboard-financial-summary-period-fixed.png`
- Remaining issue if any: none for the dashboard split-payment and period-summary correction.

### Attempt 17

- What was broken: inventory changes appeared to remain in `Pending Sync`, and purchase/fix-count updates could fail silently instead of proving that `inventory_items` was written to Supabase.
- Suspected cause: `useInventoryState` only wrote inventory updates through a fire-and-forget effect, swallowed Supabase errors, and the Inventory screen set `isSynced` to false after local changes without any success path to set it back to true. Fix-count history could also race ahead of the inventory item upsert.
- Files changed: `src/hooks/useInventoryState.ts`, `src/App.tsx`, `tests/smoke.spec.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npx playwright test --grep "inventory purchase log syncs" --reporter=line`; `npm run test:smoke -- --reporter=line`
- Test result: build passed; unit tests passed 4/4; focused inventory browser test passed and confirmed a successful Supabase `inventory_items` mutation; full Playwright smoke suite passed 5/5 after making the existing recipes smoke test handle an empty menu catalog.
- Screenshot filename: `debug-screenshots/27-inventory-before-purchase-sync.png`, `debug-screenshots/28-inventory-after-purchase-sync.png`
- Remaining issue if any: none for the inventory purchase/configuration/fix-count sync status path; the live Supabase project still needs the `SUPABASE_INVENTORY.sql` tables/policies installed for new environments.

### Attempt 18

- What was broken: Menu Settings showed no real menu even though Supabase still had products; Supabase showed the PANSIT category and products marked `is_active = false`. Half-order pricing still showed as unavailable.
- Suspected cause: `saveMenuCatalog(...)` deactivated every existing category/product missing from the current web payload. A save from an incomplete web payload could therefore hide real cloud rows without the user pressing delete. Half-order pricing was unavailable because the live `products` table still has no `half_order_price` or `half_price` column.
- Files changed: `src/lib/adminApi.ts`, `src/App.tsx`, `WORKLOG.md`
- Supabase repair applied: reactivated the real `PANSIT` category and 7 real PANSIT products; kept smoke-test menu rows inactive.
- Command run: live Supabase row-count checks; `npm run build`; `npm test`; `npm run test:smoke -- --reporter=line`
- Test result: build passed; unit tests passed 4/4; Playwright smoke suite passed 5/5 with explicit product/category deactivation paths.
- Screenshot filename: existing smoke screenshots regenerated during the smoke suite.
- Remaining issue if any: half-order pricing still requires running `SUPABASE_MENU_HALF_PRICE.sql` in Supabase SQL editor or applying the equivalent database migration with owner/service-role credentials.

### Attempt 19

- What was broken: Recipes still used the header `+` as the Add Prep Product entry point, while the requested shape was a bell icon in that position and a Menu Settings-style widget for prep creation. The Menu Settings floating `+` also sat slightly too low near the bottom navigation.
- Suspected cause: the previous Recipes split kept the old header add action and only added a secondary prep button inside the Prep Products section instead of promoting prep creation into its own top widget.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm run test:smoke -- --reporter=line`
- Test result: build passed; Playwright smoke suite passed 5/5 after replacing the Recipes header `+` with a clickable bell that scrolls to menu recipe links, adding an Add Prep Product widget below the recipe filters, removing the duplicate prep section button, and raising the floating Menu Settings add button.
- Screenshot filename: `debug-screenshots/07-recipe-tab-load.png`, `debug-screenshots/09-prep-product-modal.png`, `debug-screenshots/11-tablet-menu-settings.png`, `debug-screenshots/12-tablet-recipes.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 20

- What was broken: the sellable menu item recipe-link list still appeared inline on the Recipes page, but the requested layout was for that list to live behind the bell icon.
- Suspected cause: Attempt 19 changed the header icon but left the existing menu-link section in page flow instead of moving it into the bell interaction.
- Files changed: `src/App.tsx`, `src/style.css`, `tests/smoke.spec.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npx playwright test --grep "daily log and recipes" --reporter=line`
- Test result: build passed; focused Playwright smoke passed after moving the menu recipe-link cards into a bell-opened bottom sheet and updating the recipe smoke test to open the bell before selecting Create Recipe / Manage Recipe.
- Screenshot filename: `debug-screenshots/07-recipe-tab-load.png`, `debug-screenshots/08-recipe-editor.png`, `debug-screenshots/09-prep-product-modal.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 21

- What was broken: the Recipes bell did not show the pending recipe count, recipe category chips were still static and omitted live categories such as PANSIT, and half-price support could remain hidden after adding the Supabase column.
- Suspected cause: the bell icon only exposed the count in its aria label, recipe chips used an old hard-coded list, and the half-price schema check inferred support from a sample product row instead of probing the column directly.
- Files changed: `src/App.tsx`, `src/style.css`, `src/lib/adminApi.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npx playwright test --grep "daily log and recipes" --reporter=line`
- Test result: build passed; focused Playwright smoke passed. The recipe screenshot now shows a numeric bell badge, dynamic category chips including PANSIT, and no half-price unavailable warning when the Supabase schema exposes `half_order_price` or `half_price`.
- Screenshot filename: `debug-screenshots/07-recipe-tab-load.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 22

- What was broken: Daily Log allowed duplicate today drafts, new logs did not copy the previous day, missing dates were invisible, Daily Log categories were not Supabase-backed, and free-text ingredient units made recipe costing impossible to convert reliably.
- Suspected cause: the Daily Log flow was still app-local and treated ingredient unit text as display data instead of structured costing data.
- Files changed: `src/App.tsx`, `src/style.css`, `src/lib/adminApi.ts`, `src/lib/adminTypes.ts`, `src/hooks/AdminDataContext.tsx`, `src/hooks/useRecipesAccounting.ts`, `tests/smoke.spec.ts`, `WORKLOG.md`, plus `../SUPABASE_DAILY_LOG_FAILSAFE.sql`.
- Command run: `npm run build`; `npm test`; `npm run test:smoke -- --reporter=line --workers=1`
- Test result: build passed; unit tests passed 4/4; Playwright smoke passed 5/5 after adding the duplicate-day shake/highlight guard, previous-log copy behavior, missing-log bell, Daily Log category settings, fixed modal layout, fixed unit dropdowns, and kg/g/lb/oz/L/mL conversion for recipe costing.
- Screenshot filename: existing smoke screenshots regenerated during the smoke suite.
- Remaining issue if any: Supabase environments still need `SUPABASE_DAILY_LOG_FAILSAFE.sql` applied before category/settings persistence is fully backed by the database; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 23

- What was broken: Reset Data > Clear Inventory deleted Supabase inventory rows and counts, but then immediately rewrote the existing ingredient list with zero on-hand values. The inventory screen also fell back to seeded/sample ingredients whenever the list became empty, so inventory never looked truly cleared.
- Suspected cause: the reset handler used a zero-count local map after deletion, and `useInventoryState` could not distinguish an intentionally empty inventory from a first-run workspace that should be derived from Daily Log / Recipes.
- Files changed: `src/App.tsx`, `src/hooks/useInventoryState.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npx playwright test --grep "reset data modal" --reporter=line`
- Test result: build passed; unit tests passed 4/4; focused reset modal smoke passed after Clear Inventory was changed to empty the inventory list, preserve that cleared state locally, and render an explicit empty inventory state instead of zeroed ingredient cards.
- Screenshot filename: none
- Remaining issue if any: the smoke suite still does not execute destructive reset actions against the live Supabase dataset; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 24

- What was broken: the app shell and shared UI surfaces still felt cramped and phone-emulator-like on larger screens, with inconsistent card/control polish across the admin tabs.
- Suspected cause: the UI was still using a narrow fixed mobile shell and older per-component visual styles instead of a shared production polish layer for cards, inputs, navigation, focus states, desktop width, and mobile wrapping.
- Files changed: `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npm run test:smoke -- --reporter=line --workers=1`; targeted Playwright browser pass against `http://127.0.0.1:5173/`
- Test result: build passed; unit tests passed 4/4; Playwright smoke suite passed 5/5; targeted browser pass opened Dashboard, Inventory, Daily Log, More, Sync Data & Logs, Order History, Sales Range, Menu Settings, Recipes & Cost Management, Cash Overview, Cash Control, Bills & Payables, and Profit Insights with no console or page errors.
- Screenshot filename: `debug-screenshots/ui-polish-before-dashboard.png`, `debug-screenshots/ui-polish-before-inventory.png`, `debug-screenshots/ui-polish-before-daily-log.png`, `debug-screenshots/ui-polish-before-more.png`, `debug-screenshots/ui-polish-after-dashboard.png`, `debug-screenshots/ui-polish-after-inventory.png`, `debug-screenshots/ui-polish-after-daily-log.png`, `debug-screenshots/ui-polish-after-more.png`, `debug-screenshots/ui-polish-after-order-history.png`, `debug-screenshots/ui-polish-after-sales-range.png`, `debug-screenshots/ui-polish-after-menu-settings.png`, `debug-screenshots/ui-polish-after-recipes-cost-management.png`, `debug-screenshots/ui-polish-after-cash-overview.png`, `debug-screenshots/ui-polish-after-cash-control.png`, `debug-screenshots/ui-polish-after-bills-payables.png`, `debug-screenshots/ui-polish-after-profit-insights.png`, `debug-screenshots/ui-polish-after-desktop-dashboard.png`, `debug-screenshots/ui-polish-after-desktop-more.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session; destructive reset actions were intentionally not executed during UI validation.

### Attempt 25

- What was broken: POS Settings still had a Profile tab with a hard-coded cashier, and Admin Web had no place to manage employees, daily rates, or which employees can work as cashiers.
- Suspected cause: cashier identity was static UI text in POS instead of being driven by an admin-managed employee setting.
- Files changed: `src/App.tsx`, `src/style.css`, `src/pos/PosApp.tsx`, `src/pos/pos.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npm run test:smoke -- --reporter=line --workers=1`; targeted Playwright browser flow against `http://127.0.0.1:5173/` and `/pos.html`
- Test result: build passed; unit tests passed 13/13; Playwright smoke suite passed 5/5; targeted browser flow added an employee from Admin Employee Management, verified the employee setting was stored, opened POS Web with an empty shift, selected the cashier, and confirmed the POS Settings Profile tab is removed with no page or console errors.
- Screenshot filename: `debug-screenshots/admin-employee-management-empty.png`, `debug-screenshots/admin-employee-management-added.png`, `debug-screenshots/pos-employee-select-empty-shift.png`, `debug-screenshots/pos-employee-selected-shift.png`, `debug-screenshots/pos-settings-profile-removed.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 26

- What was broken: the POS Edit Order approval modal still let the POS approve its own edit request, which defeated the admin-control requirement.
- Suspected cause: the approval was implemented as local component state instead of a cloud-backed request that Admin Web must approve.
- Files changed: `src/App.tsx`, `src/style.css`, `src/pos/PosApp.tsx`, `src/lib/adminTypes.ts`, `src/lib/orderEditRequests.ts`, `GITHUB_SUPABASE_SETUP.md`, `WORKLOG.md`, plus `..\SUPABASE_ORDER_EDIT_REQUESTS.sql`.
- Command run: `npm run build`; `npm test`; targeted Playwright browser checks against `http://127.0.0.1:5174/pos.html` and `http://127.0.0.1:5174/`.
- Test result: build passed; unit tests passed 13/13; POS edit request modal showed no local approve button and stated that Admin Web approval is required. The live Supabase project reported the missing `order_edit_requests` table as expected until the new SQL patch is applied.
- Screenshot filename: `output/playwright/pos-edit-request-pending.png`, `output/playwright/pos-edit-request-after-sync.png`, `output/playwright/admin-no-edit-request-popup.png`.
- Remaining issue if any: run `SUPABASE_ORDER_EDIT_REQUESTS.sql` in the live Supabase project before the cross-device Admin Web popup can be verified end to end; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 27

- What was broken: after the SQL patch was applied, pending edit-order request rows existed in Supabase but Admin Web still did not show an obvious approval surface.
- Suspected cause: relying only on a floating toast made the approval too easy to miss and the initial render path was not surfacing it in the normal More screen content.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: direct Supabase pending-row check; `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:5174/`.
- Test result: build passed; unit tests passed 13/13; browser check confirmed `PENDING ADMIN REQUESTS` is visible on Admin Web Settings / More, the live pending order ID appears, and `Yes, Approve` buttons render with no console or page errors.
- Screenshot filename: `output/playwright/admin-pending-requests-section.png`
- Remaining issue if any: deploy/reload the Admin Web bundle the user is viewing so the new visible More-screen approval section is available there; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 28

- What was broken: the Admin Web approval UI looked like a page widget/toast and showed the full cloud device order ID instead of the simplified POS-style order reference.
- Suspected cause: the approval surface was rendered both inline and as a bottom toast, and Admin Web used a generic last-characters formatter instead of the POS order reference formatter.
- Files changed: `src/App.tsx`, `src/style.css`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:5174/`.
- Test result: build passed; unit tests passed 13/13; browser check confirmed the approval appears as a centered modal, shows `Edit Order #0716-0002`, and no longer displays the full `TABLET-...` ID.
- Screenshot filename: `output/playwright/admin-edit-request-centered-modal.png`
- Remaining issue if any: deploy/reload the Admin Web bundle the user is viewing so the centered modal replaces the old widget/toast; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 29

- What was broken: Menu Settings showed a `Meals` category chip even though the live `Meals` category had no active menu items, making the category look bugged/empty.
- Suspected cause: Menu Settings built filter chips from active category rows instead of from categories that actually have active visible menu items. The live Supabase data also contains duplicate `Meals` rows and only hidden/inactive smoke-test products under Meals.
- Files changed: `src/App.tsx`, `WORKLOG.md`
- Command run: live Supabase category/product grouping check; `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:5174/`.
- Test result: build passed; unit tests passed 13/13; browser check confirmed Menu Settings chips are now `All`, `PANSIT`, `ULAM`, and `Uncategorized`, with no empty `Meals` chip, and active products still render correctly.
- Screenshot filename: `output/playwright/menu-settings-meals-before.png`, `output/playwright/menu-settings-meals-fixed.png`
- Remaining issue if any: the duplicate/empty `Meals` category row still exists in Supabase for Category Settings cleanup; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 30

- What was broken: adding a product to `Meals` saved it back under `Uncategorized`, while `ULAM` and `PANSIT` saved correctly.
- Suspected cause: after hiding empty menu chips, `persistMenuCatalog(...)` only built category IDs from the currently visible category list. Because `Meals` was empty and no longer visible, a new `Meals` item had no category ID during persistence and fell back to the first available category path.
- Files changed: `src/App.tsx`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright/Supabase save check against `http://127.0.0.1:5174/`.
- Test result: build passed; unit tests passed 13/13; adding a temporary `Meals Save Check ...` item persisted to the active `Meals` category ID `3261f126-b1c2-4bae-a716-3e002130525a` instead of `Uncategorized`; the temporary test product was hidden after verification.
- Screenshot filename: `output/playwright/menu-settings-meals-save-check.png`
- Remaining issue if any: duplicate inactive `Meals` category rows and hidden smoke-test products remain in Supabase cleanup history, but active `Meals` saves now use the correct category; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 31

- What was broken: Send to Kitchen note modal icons looked inconsistent, with a mix of Lucide icons, text symbols, CSS-drawn shirt shapes, and wrong icon choices.
- Suspected cause: the modal used plain text `x` / `!`, `List` for tables, `Eye` for the Glasses option, and CSS pseudo-elements to draw shirt icons instead of using one SVG icon system.
- Files changed: `src/pos/PosApp.tsx`, `src/pos/pos.css`, `WORKLOG.md`
- Command run: modal icon source scan; `npm run build`; `npm test`; targeted Playwright check against `http://127.0.0.1:5174/pos.html`.
- Test result: build passed; unit tests passed 13/13; browser check opened Send to Kitchen, confirmed the modal contains SVG icons and no `<i>` pseudo-icon elements, and reported no console or page errors.
- Screenshot filename: `output/playwright/send-to-kitchen-icons-fixed.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 32

- What was broken: POS Web had a category-level kitchen toggle in Settings > Menu List, but it was only UI state and did not persist or affect kitchen ticket printing.
- Suspected cause: orders did not carry menu category names through the POS order model / `items_json`, and the kitchen-ticket print path always printed every order item.
- Files changed: `src/pos/PosApp.tsx`, `src/lib/adminTypes.ts`, `src/lib/adminApi.ts`, `src/lib/mappers.ts`, `src/lib/pos/posTypes.ts`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright browser check against `http://127.0.0.1:5175/pos.html`.
- Test result: build passed; unit tests passed 18/18; browser check confirmed POS Settings > Menu List renders the category kitchen print toggle with no page or console errors.
- Screenshot filename: `output/playwright/pos-kitchen-category-print-setting.png`
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session; the browser check hid the no-shift overlay with injected test CSS so the settings screen could be inspected without opening a shift.

### Attempt 33

- What was broken: tapping Send to Kitchen saved/synced the order but did not automatically print the kitchen ticket.
- Suspected cause: the Send to Kitchen save path updated local/Supabase order state only; printing was only reachable from Order History.
- Files changed: `src/pos/PosApp.tsx`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`
- Test result: build passed; unit tests passed 18/18 after adding automatic kitchen-ticket printing for new orders, edited orders, and add-order sends. Add-order sends print only the newly added kitchen lines so existing items are not duplicated on the kitchen printer.
- Screenshot filename: not applicable; no UI layout changed in this pass.
- Remaining issue if any: Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 34

- What was broken: printed mixed Dine In / Take Out orders could rely on a `MIXED` header instead of showing the service mode on each item line, especially through the Android Bluetooth printer.
- Suspected cause: browser print used a separate service-mode detail line only in some modes, while the native ESC/POS printer printed only the order-level `serviceMode` header.
- Files changed: `src/lib/pos/printService.ts`, `android/app/src/main/java/com/ooh/pos/printing/BluetoothEscPosPrinter.java`, `public/downloads/ooh-pos-tablet-debug.apk`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npx cap sync android`; Android `assembleDebug` with Android Studio JBR as `JAVA_HOME`
- Test result: build passed; unit tests passed 18/18; Android debug APK built successfully after printing each mixed-order item as `Qty x Item - Dine In/Take Out` and changing the mixed header label to `Per-item mode`.
- Screenshot filename: not applicable; print text formatting/native output changed, not a screen layout.
- Remaining issue if any: commit/push the updated APK and deploy before the app download link will serve this build; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 35

- What was broken: mixed-order printouts could still appear wrong because the Dine In / Take Out label was appended after the item name, where a thermal printer can truncate it, and the header still had a per-order mode line.
- Suspected cause: the mode label needed to be the first text on each mixed-order item line, not a suffix or header-level summary.
- Files changed: `src/lib/pos/printService.ts`, `src/lib/pos/printService.test.ts`, `android/app/src/main/java/com/ooh/pos/printing/BluetoothEscPosPrinter.java`, `public/downloads/ooh-pos-tablet-debug.apk`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; `npx cap sync android`; Android `assembleDebug` with Android Studio JBR as `JAVA_HOME`
- Test result: build passed; unit tests passed 19/19 including a mixed kitchen-ticket regression test that asserts `Dine In - 1x ...`, `Take Out - 2x ...`, and no `MIXED` text in the browser kitchen-ticket HTML. Android debug APK also built successfully with matching native Bluetooth print formatting.
- Screenshot filename: not applicable; print text formatting/native output changed, not a screen layout.
- Remaining issue if any: commit/push the updated APK and deploy, then reinstall that new APK on the tablet before testing; Gemini screenshot review is still pending because no Gemini review tool was available in this session.

### Attempt 36

- What was broken: POS Sale Tracker could show only one ₱460 transaction even after multiple orders, and the transaction detail modal clipped longer order-item lists.
- Suspected cause: Sale Tracker treated the `payments` table as the primary source even when payment rows were missing/incomplete, filtered rows by the exact open `shift_session_id` instead of the whole current `shift_id`, and the detail item card used `overflow: hidden` without an inner scroll area.
- Files changed: `src/pos/PosApp.tsx`, `src/pos/pos.css`, `public/downloads/ooh-pos-tablet-debug.apk`, `WORKLOG.md`
- Command run: `npm run build`; `npm test`; targeted Playwright browser check against `http://127.0.0.1:5176/pos.html`; `npx cap sync android`; Android `assembleDebug` with Android Studio JBR as `JAVA_HOME`
- Test result: build passed; unit tests passed 19/19; browser check loaded Sale Tracker with no page or console errors; Android debug APK built successfully after merging Sale Tracker rows from `orders` plus `payments`, broadening current-shift matching, and adding a scrollable detail item list.
- Screenshot filename: `output/playwright/sale-tracker-detail-scroll.png`
- Remaining issue if any: the browser check had no live rows in the fresh test context, so it verified page health rather than a populated transaction modal; Gemini screenshot review is still pending because no Gemini review tool was available in this session.
