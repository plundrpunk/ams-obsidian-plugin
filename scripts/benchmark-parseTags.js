const iterations = 1000000;

function parseTagsOriginal(raw) {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseTagsOptimized(raw) {
  if (raw.indexOf(",") === -1) {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const singleTag = "knowledge-map";
const multiTag = "knowledge-map, system, meta";
const emptyTag = "";

console.log("Benchmarking single tag...");
console.time("Original (Single)");
for (let i = 0; i < iterations; i++) parseTagsOriginal(singleTag);
console.timeEnd("Original (Single)");

console.time("Optimized (Single)");
for (let i = 0; i < iterations; i++) parseTagsOptimized(singleTag);
console.timeEnd("Optimized (Single)");

console.log("\nBenchmarking multi tag...");
console.time("Original (Multi)");
for (let i = 0; i < iterations; i++) parseTagsOriginal(multiTag);
console.timeEnd("Original (Multi)");

console.time("Optimized (Multi)");
for (let i = 0; i < iterations; i++) parseTagsOptimized(multiTag);
console.timeEnd("Optimized (Multi)");

console.log("\nBenchmarking empty tag...");
console.time("Original (Empty)");
for (let i = 0; i < iterations; i++) parseTagsOriginal(emptyTag);
console.timeEnd("Original (Empty)");

console.time("Optimized (Empty)");
for (let i = 0; i < iterations; i++) parseTagsOptimized(emptyTag);
console.timeEnd("Optimized (Empty)");
