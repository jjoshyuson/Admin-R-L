# Shared RNL styles and chart motion
User approved implementation inline: preserve layouts, outlined A cards, Geist, Lucide, optional light/dark, remove duplicate top navigation and routine Sync. Add a smooth traveling pulse on the actual sales line.
1. Add browser regressions for theme persistence, navigation reachability and reduced-motion chart behavior; verify failure before implementation.
2. Centralize semantic colors and type/spacing/control tokens, self-host Geist, migrate existing CSS declarations to tokens while preserving page geometry. Add system/light/dark preference initialized before first paint and a shared theme selector in both apps.
3. Replace admin navigation icons with Lucide; remove duplicate top navigation and routine sync; keep four existing bottom destinations and error recovery reachable on desktop too.
4. Add a reusable SVG traveling pulse using the existing data path (no fabricated data or shape), browser-native motion, and static/reduced-motion handling.
5. Build, unit/browser checks, read-only screenshots both themes, menu hashes and review. No push, merge, database changes or public deployment.

## Execution result
Implemented inline in the existing isolated branch, without push/merge/deployment. Shared semantic tokens replace opaque UI colors, type sizes/weights and common spacing/radii in the original admin/POS stylesheets; intentional garment swatch colors, alpha effects and layout geometry remain scoped. Compatibility aliases point to the same tokens. Geist is self-hosted with its OFL license. Shared theme preference supports OS changes and cross-tab changes, with initialization before first paint.

The existing four bottom destinations remain on phone and desktop; duplicate top navigation and routine Sync are removed. Error retry and sync diagnostics remain available. Common admin icon wrappers now render Lucide consistently. Card layout stays as before, with outlined surfaces and minimal card shadow.

SVG motion follows the exact existing line path over seven seconds, with a gentle halo and fade at loop boundary; no fabricated values, no empty-data animation, and reduced motion omits animated elements. The preview uses explicit demonstration data and the actual component, outside the app.

Verification:58 unit tests,6 read-only browser checks,production build,0 missing token references,0 literal font-size declarations in the two application stylesheets. Menu89products/12categories unchanged. Screenshots cover overview/settings/menu/POS in both themes. Review fixes cover dark inverse foregrounds, desktop footer clearance and collapsed theme picker width. Browser motion probe verifies advancement and reduced-motion fallback.

Screenshots and motion preview: /home/joshy/Documents/ChatGPT/RNL/design-review-2026-10-13/component-study/implementation/index.html and ../motion.html. No database writes during review captures. These checks do not constitute exhaustive end-to-end financial workflow validation or physical tablet benchmarking.

## Follow-up corrections
User approved one continuous green glow across a thin white strand; fixed focal dots pulse by distance along the path. The five-second cycle uses one full-path stroke-dashoffset sweep rather than segment-by-segment illumination. Pulse may run on a genuine flat zero series as requested, with its decorative meaning stated in the accessible chart label; reduced-motion and no-point/disabled handling remain.

Theme control is now an accessible sun/moon icon toggle; system preference applies initially, and explicit toggles persist/cross-tab sync. Dashboard blue accents use green semantic info tokens. Selected period pills and brand mark use on-action foreground. The Synced status badge no longer inherits a lime background; measured contrast5.52light/10.07dark. The payment ring uses actual share rather than a fixed70% decorative fill; shift bars are crisp data-drivenSVGs with0height when totalsare0. Menu comparison remains exact89products/12categories. No push/merge/deployment.
