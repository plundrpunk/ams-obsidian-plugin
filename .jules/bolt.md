## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2024-05-18 - Debouncing Disk I/O in Obsidian Plugin Settings
**Learning:** Obsidian plugin settings using `onChange` must be debounced when tied to `saveData`, because `saveData` natively triggers a disk I/O write for the `data.json` configuration file. Tying it directly to text inputs results in synchronous disk writes on every keystroke, leading to I/O lag and stuttering UI during rapid configuration changes.
**Action:** Always wrap `saveData` in a `debounce` helper (from the `obsidian` package) when saving text-based user configuration.
