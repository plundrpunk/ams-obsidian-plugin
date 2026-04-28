## 2024-04-28 - Obsidian DocumentFragment DOM Builder Methods
**Learning:** In Obsidian plugins, `DocumentFragment` supports the polyfilled DOM builder methods (`createDiv`, `createEl`), enabling DOM insertion batching without losing Obsidian's clean DOM API.
**Action:** When rendering lists of DOM elements, always use `document.createDocumentFragment()`, create child elements on the fragment using `fragment.createDiv()`, and then append the entire fragment to the parent container to prevent layout thrashing.
