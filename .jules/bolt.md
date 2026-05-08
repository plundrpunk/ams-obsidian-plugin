## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2026-05-04 - Debouncing disk I/O in Obsidian Settings
**Learning:** In Obsidian plugins, `saveData()` triggers disk I/O writes to the plugin's `data.json` file. Binding synchronous `saveData()` calls to `onChange` events in text inputs within the Settings tab can cause significant performance bottlenecks and UI lag due to frequent, redundant disk writes on every keystroke.
**Action:** Use Obsidian's built-in `debounce` utility (imported from `obsidian`) to wrap `saveData()` calls originating from frequent UI events (like text inputs). Retain synchronous `saveData()` for critical state transitions (e.g., onboarding completion) to guarantee data persistence.
## 2026-05-08 - Fast-path string validation
**Learning:** String manipulation methods like `.trim()` or `.replace()` allocate new strings in memory, which becomes an expensive operation with large strings (like 5MB document contents) and can cause garbage collection spikes. Using a fast-path length check before checking against a known short literal skips the allocation entirely.
**Action:** Always check `.length` first when trying to determine if a potentially huge string is actually just a short error message placeholder.
