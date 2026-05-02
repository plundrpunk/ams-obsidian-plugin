## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.
## 2024-05-18 - Debounce disk I/O in Settings
**Learning:** In Obsidian plugins, `saveData()` triggers disk I/O writes for `data.json`. Calls to `saveData` from frequent events, such as text input `onChange` handlers, should be debounced using Obsidian's `debounce` utility to avoid performance bottlenecks, disk thrashing, and UI lag.
**Action:** When saving data inside frequent event handlers like `onChange` within Settings tabs or Modals, use a debounced save function (e.g., `debounce(() => this.saveData(), 500, true)`).
