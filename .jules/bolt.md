## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2026-05-04 - Debouncing disk I/O in Obsidian Settings
**Learning:** In Obsidian plugins, `saveData()` triggers disk I/O writes to the plugin's `data.json` file. Binding synchronous `saveData()` calls to `onChange` events in text inputs within the Settings tab can cause significant performance bottlenecks and UI lag due to frequent, redundant disk writes on every keystroke.
**Action:** Use Obsidian's built-in `debounce` utility (imported from `obsidian`) to wrap `saveData()` calls originating from frequent UI events (like text inputs). Retain synchronous `saveData()` for critical state transitions (e.g., onboarding completion) to guarantee data persistence.

## 2026-05-12 - Fast-path length checks to avoid string allocations
**Learning:** Checking potentially large strings against short literals (e.g., verifying if a 500KB file content is just "[Content unavailable]") using methods like `.trim()` creates expensive string copies and causes O(n) garbage collection overhead. Since the target literal is small, we can often bypass the expensive `.trim()` entirely if the string length significantly exceeds the literal's length.
**Action:** Before calling string-copying methods like `.trim()`, `.toLowerCase()`, or `.replace()` for validation against short literals, implement a fast-path `.length` check. If the string is safely larger than the expected literal, return early to save memory and CPU cycles.
