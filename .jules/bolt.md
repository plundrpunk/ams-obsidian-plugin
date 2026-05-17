## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2026-05-04 - Debouncing disk I/O in Obsidian Settings
**Learning:** In Obsidian plugins, `saveData()` triggers disk I/O writes to the plugin's `data.json` file. Binding synchronous `saveData()` calls to `onChange` events in text inputs within the Settings tab can cause significant performance bottlenecks and UI lag due to frequent, redundant disk writes on every keystroke.
**Action:** Use Obsidian's built-in `debounce` utility (imported from `obsidian`) to wrap `saveData()` calls originating from frequent UI events (like text inputs). Retain synchronous `saveData()` for critical state transitions (e.g., onboarding completion) to guarantee data persistence.
## 2026-05-14 - String allocation optimizations for large text\n**Learning:** In JavaScript, methods like , , and  on very large strings create entirely new strings and arrays, leading to significant memory allocation and garbage collection overhead. This is especially problematic when parsing large files like Obsidian notes.\n**Action:** Use fast-path  checks before  to avoid copying large strings unnecessarily. For targeted data extraction (like frontmatter), use index-based searches () instead of slicing and splitting the string.
## 2026-05-14 - String allocation optimizations for large text
**Learning:** In JavaScript, methods like `.trim()`, `.slice()`, and `.split()` on very large strings create entirely new strings and arrays, leading to significant memory allocation and garbage collection overhead. This is especially problematic when parsing large files like Obsidian notes.
**Action:** Use fast-path `.length` checks before `.trim()` to avoid copying large strings unnecessarily. For targeted data extraction (like frontmatter), use index-based searches (`indexOf`) instead of slicing and splitting the string.

## 2026-05-17 - Parallelizing Network/Disk I/O
**Learning:** In asynchronous logic iterating over candidate results (e.g., fetching missing data or reading local files for search results), using a sequential `for...of` loop with `await` blocks on network or disk I/O for each iteration. This unnecessarily serializes independent data fetches, leading to high latency.
**Action:** Use `Promise.all()` with an `array.map` to execute independent network or disk reads concurrently before filtering or extracting the final selected result.
