const largeContent = "---\n" +
  "source: ams-memory-companion\n" +
  "ams_memory_id: some-id-123\n" +
  "ams_map_version: 2\n" +
  "ams_synced_at: 2026-05-04T12:00:00Z\n" +
  "tags: [knowledge-map, ams]\n" +
  "---\n" +
  "A".repeat(10000);

function originalRead(rawContent, key) {
  if (!rawContent.startsWith("---\n")) {
    return null;
  }

  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }

  const prefix = `${key}:`;
  for (const line of rawContent.slice(4, endIndex).split("\n")) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value || null;
    }
  }

  return null;
}

function optimizedRead(rawContent, key) {
  if (!rawContent.startsWith("---\n")) {
    return null;
  }

  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }

  const searchStr = `\n${key}:`;
  // Start from index 3 so the first newline of "\n${key}:" matches the first newline,
  // or we could just check if it starts with it. Wait, the first line starts at index 4.
  // Actually, let's just search within the frontmatter block.

  // It could be on the very first line after "---"
  let matchIndex = -1;
  let valueStart = -1;
  if (rawContent.startsWith(`---\n${key}:`)) {
    matchIndex = 4; // where the key starts
    valueStart = 4 + key.length + 1;
  } else {
    matchIndex = rawContent.indexOf(searchStr, 3);
    if (matchIndex !== -1 && matchIndex < endIndex) {
      valueStart = matchIndex + searchStr.length;
    }
  }

  if (valueStart !== -1 && valueStart < endIndex) {
    const lineEndIndex = rawContent.indexOf("\n", valueStart);
    // lineEndIndex must be <= endIndex
    const actualEnd = lineEndIndex === -1 || lineEndIndex > endIndex ? endIndex : lineEndIndex;
    return rawContent.slice(valueStart, actualEnd).trim() || null;
  }

  return null;
}

const ITERATIONS = 100000;

console.time("original");
for (let i = 0; i < ITERATIONS; i++) {
  originalRead(largeContent, "ams_memory_id");
  originalRead(largeContent, "ams_map_version");
  originalRead(largeContent, "missing_key");
}
console.timeEnd("original");

console.time("optimized");
for (let i = 0; i < ITERATIONS; i++) {
  optimizedRead(largeContent, "ams_memory_id");
  optimizedRead(largeContent, "ams_map_version");
  optimizedRead(largeContent, "missing_key");
}
console.timeEnd("optimized");
