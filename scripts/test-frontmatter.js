function optimizedRead(rawContent, key) {
  if (!rawContent.startsWith("---\n")) {
    return null;
  }

  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }

  let valueStart = -1;
  if (rawContent.startsWith(`---\n${key}:`)) {
    valueStart = 4 + key.length + 1;
  } else {
    const searchStr = `\n${key}:`;
    const matchIndex = rawContent.indexOf(searchStr, 3);
    if (matchIndex !== -1 && matchIndex < endIndex) {
      valueStart = matchIndex + searchStr.length;
    }
  }

  if (valueStart !== -1 && valueStart < endIndex) {
    let lineEndIndex = rawContent.indexOf("\n", valueStart);
    if (lineEndIndex === -1 || lineEndIndex > endIndex) {
      lineEndIndex = endIndex;
    }
    return rawContent.slice(valueStart, lineEndIndex).trim() || null;
  }

  return null;
}

const c1 = "---\nams_memory_id: 123\nams_map_version: 2\n---\nbody";
console.log(optimizedRead(c1, "ams_memory_id") === "123");
console.log(optimizedRead(c1, "ams_map_version") === "2");
console.log(optimizedRead(c1, "missing") === null);
