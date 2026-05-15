const shortString = "  [Content unavailable - vault file missing]  ";
const largeString = "A".repeat(1000000) + " ".repeat(10);

function originalIsUsable(content) {
  if (!content) return false;
  return content.trim() !== "[Content unavailable - vault file missing]";
}

function optimizedIsUsable(content) {
  if (!content) return false;
  if (content.length > 100) return true;
  return content.trim() !== "[Content unavailable - vault file missing]";
}

const ITERATIONS = 10000;

console.time("original");
for (let i = 0; i < ITERATIONS; i++) {
  originalIsUsable(largeString);
  originalIsUsable(shortString);
}
console.timeEnd("original");

console.time("optimized");
for (let i = 0; i < ITERATIONS; i++) {
  optimizedIsUsable(largeString);
  optimizedIsUsable(shortString);
}
console.timeEnd("optimized");
