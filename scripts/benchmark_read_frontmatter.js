const fs = require('fs');

function readFrontmatterValueOld(rawContent, key) {
  if (!rawContent.startsWith("---\n")) return null;
  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) return null;

  const prefix = `${key}:`;
  for (const line of rawContent.slice(4, endIndex).split("\n")) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value || null;
    }
  }
  return null;
}

function readFrontmatterValueNew(rawContent, key) {
  if (!rawContent.startsWith("---\n")) return null;
  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) return null;

  // ⚡ Bolt: Use index-based search to avoid allocating intermediate arrays and strings
  const searchStr = `\n${key}:`;
  const keyIdx = rawContent.indexOf(searchStr, 3);

  if (keyIdx === -1 || keyIdx >= endIndex) {
    // Also check first line
    if (rawContent.startsWith(`---\n${key}:`)) {
      const valueStartIdx = 4 + key.length + 1;
      let valueEndIdx = rawContent.indexOf("\n", valueStartIdx);
      if (valueEndIdx === -1 || valueEndIdx > endIndex) {
          valueEndIdx = endIndex;
      }
      const value = rawContent.slice(valueStartIdx, valueEndIdx).trim();
      return value || null;
    }
    return null;
  }

  const valueStartIdx = keyIdx + searchStr.length;
  let valueEndIdx = rawContent.indexOf("\n", valueStartIdx);
  if (valueEndIdx === -1 || valueEndIdx > endIndex) {
    valueEndIdx = endIndex;
  }

  const value = rawContent.slice(valueStartIdx, valueEndIdx).trim();
  return value || null;
}

const largeContent = "---\n" + Array.from({length: 1000}).map((_, i) => `key_${i}: value_${i}`).join("\n") + "\nams_map_version: 5\n---\n" + "x".repeat(10000);

const ITERATIONS = 10000;

console.time("Old");
for (let i = 0; i < ITERATIONS; i++) {
  readFrontmatterValueOld(largeContent, "ams_map_version");
}
console.timeEnd("Old");

console.time("New");
for (let i = 0; i < ITERATIONS; i++) {
  readFrontmatterValueNew(largeContent, "ams_map_version");
}
console.timeEnd("New");
