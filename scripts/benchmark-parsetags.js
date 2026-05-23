const crypto = require('crypto');

function parseTagsOriginal(raw) {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseTagsOptimized(raw) {
  // ⚡ Bolt: Fast-path check to avoid array allocations for single tags or empty strings
  if (raw.indexOf(",") === -1) {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Generate some test data
const singleTags = Array.from({ length: 10000 }, () => "single-tag-" + crypto.randomUUID());
const emptyStrings = Array.from({ length: 10000 }, () => "   ");
const multiTags = Array.from({ length: 10000 }, () => "tag1, tag2, tag3, tag4");

const testData = [...singleTags, ...emptyStrings, ...multiTags];

console.time('Original');
for (let i = 0; i < 100; i++) {
    for (const data of testData) {
        parseTagsOriginal(data);
    }
}
console.timeEnd('Original');

console.time('Optimized');
for (let i = 0; i < 100; i++) {
    for (const data of testData) {
        parseTagsOptimized(data);
    }
}
console.timeEnd('Optimized');
