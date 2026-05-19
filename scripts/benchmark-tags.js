const ITERATIONS = 1000000;

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

const testCases = [
  "",
  "single-tag",
  "  padded-tag  ",
  "tag1, tag2",
  "tag1, tag2, tag3, tag4"
];

for (const testCase of testCases) {
  console.log(`\nTesting: "${testCase}"`);

  const startOriginal = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    parseTagsOriginal(testCase);
  }
  const endOriginal = performance.now();

  const startOptimized = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    parseTagsOptimized(testCase);
  }
  const endOptimized = performance.now();

  console.log(`Original:  ${(endOriginal - startOriginal).toFixed(2)}ms`);
  console.log(`Optimized: ${(endOptimized - startOptimized).toFixed(2)}ms`);
}
