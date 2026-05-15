function readFrontmatterValue(rawContent, key) {
    if (!rawContent.startsWith("---\n")) {
      return null;
    }

    const endIndex = rawContent.indexOf("\n---\n", 4);
    if (endIndex === -1) {
      return null;
    }

    // ⚡ Bolt: Use index-based search to avoid allocating intermediate strings and arrays
    // from slice().split('\n') which causes unnecessary garbage collection overhead.

    let searchStr = `\n${key}:`;
    let keyIdx = rawContent.indexOf(searchStr, 3);

    // If not found with newline prefix, it might be the very first line of frontmatter
    if (keyIdx === -1 || keyIdx >= endIndex) {
      const firstLinePrefix = `---\n${key}:`;
      if (rawContent.startsWith(firstLinePrefix)) {
        keyIdx = 0;
        searchStr = `---\n${key}:`;
      } else {
        return null;
      }
    }

    const valueStartIdx = keyIdx + searchStr.length;
    let valueEndIdx = rawContent.indexOf("\n", valueStartIdx);

    if (valueEndIdx === -1 || valueEndIdx > endIndex) {
      valueEndIdx = endIndex;
    }

    const value = rawContent.slice(valueStartIdx, valueEndIdx).trim();
    return value || null;
}

const content1 = "---\nams_memory_id: 123\nams_map_version: 2\n---\n# Content";
const content2 = "---\nother_key: 456\nams_map_version: 3\n---\n# Content";
const content3 = "---\ntest:   with spaces   \n---\n";

console.log(readFrontmatterValue(content1, "ams_memory_id")); // 123
console.log(readFrontmatterValue(content1, "ams_map_version")); // 2
console.log(readFrontmatterValue(content2, "ams_map_version")); // 3
console.log(readFrontmatterValue(content3, "test")); // "with spaces"
console.log(readFrontmatterValue(content1, "missing")); // null
