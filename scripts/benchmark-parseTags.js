const ITERATIONS = 1000000;

function parseTagsOriginal(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseTagsOptimized(raw) {
  if (!raw) return [];
  if (raw.indexOf(",") === -1) {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const singleTag = "important";
const multiTag = "important, urgent, test";
const emptyTag = "";
const spacesOnly = "   ";

console.time("original");
for (let i = 0; i < ITERATIONS; i++) {
  parseTagsOriginal(singleTag);
  parseTagsOriginal(multiTag);
  parseTagsOriginal(emptyTag);
  parseTagsOriginal(spacesOnly);
}
console.timeEnd("original");

console.time("optimized");
for (let i = 0; i < ITERATIONS; i++) {
  parseTagsOptimized(singleTag);
  parseTagsOptimized(multiTag);
  parseTagsOptimized(emptyTag);
  parseTagsOptimized(spacesOnly);
}
console.timeEnd("optimized");
