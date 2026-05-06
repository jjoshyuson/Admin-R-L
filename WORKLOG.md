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
