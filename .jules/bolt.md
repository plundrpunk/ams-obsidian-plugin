## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.
## 2024-05-19 - Obsidian Plugin Settings Optimization
**Learning:** In Obsidian plugins, calls to `saveData()` from frequent events like text input `onChange` handlers trigger excessive disk I/O writes for `data.json`, causing performance bottlenecks and UI lag.
**Action:** Always debounce `saveData()` calls (using Obsidian's `debounce` utility) for frequent UI events, while keeping synchronous saves for critical state transitions like onboarding flows.
