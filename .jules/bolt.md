## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2026-05-04 - Debouncing disk I/O in Obsidian Settings
**Learning:** In Obsidian plugins, `saveData()` triggers disk I/O writes to the plugin's `data.json` file. Binding synchronous `saveData()` calls to `onChange` events in text inputs within the Settings tab can cause significant performance bottlenecks and UI lag due to frequent, redundant disk writes on every keystroke.
**Action:** Use Obsidian's built-in `debounce` utility (imported from `obsidian`) to wrap `saveData()` calls originating from frequent UI events (like text inputs). Retain synchronous `saveData()` for critical state transitions (e.g., onboarding completion) to guarantee data persistence.

## 2026-05-11 - Redundant sorts and eager I/O in fallbacks
**Learning:** In fallback loops or retry logic, avoid eager evaluation of secondary options if the primary option is likely to succeed, especially if the secondary option involves expensive disk I/O (like reading local vault notes). Additionally, using `Date.parse()` and string comparisons inside `Array.prototype.sort()` callbacks can cause severe performance bottlenecks because the callback is invoked O(n log n) times.
**Action:** Use lazy evaluation for expensive fallback operations (only perform them if the primary fails). When sorting items using expensive calculations (like parsing dates), implement the Schwartzian transform: map the array to calculate the score exactly once per item, sort based on the pre-calculated score, and then map back to the original items.
