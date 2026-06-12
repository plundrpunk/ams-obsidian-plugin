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

## 2026-06-08 - Fast-path check for JSON.parse
**Learning:** Parsing large plain text responses (such as verbose HTML error pages) using `JSON.parse` inside a `try/catch` block incurs a severe performance penalty because V8 generates a slow internal `SyntaxError` when parsing fails.
**Action:** Always implement a fast-path string check (e.g., verifying if the first non-whitespace character is `{` or `[`) before invoking `JSON.parse` on external payloads.

## 2026-06-12 - Single-pass loop for parsing comma-separated strings
**Learning:** Chaining array methods like `.split(",")`, `.map()`, and `.filter()` on strings creates multiple intermediate arrays and string copies, leading to unnecessary memory allocation and garbage collection overhead.
**Action:** When parsing strings (like comma-separated tags), implement a fast-path check for the separator (e.g., `indexOf(',') === -1`). If the separator exists, use a manual, single-pass `for` loop to extract, trim, and collect the elements instead of chaining array methods.
