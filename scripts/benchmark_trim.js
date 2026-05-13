const largeString = " ".repeat(50) + "a".repeat(1024 * 1024) + " ".repeat(50);
const shortLiteral = "[Content unavailable - vault file missing]";

console.time("trim");
for (let i = 0; i < 100; i++) {
  const isUsable = largeString.trim() !== shortLiteral;
}
console.timeEnd("trim");

console.time("length-fast-path");
for (let i = 0; i < 100; i++) {
  const isUsable = largeString.length > 100 ? true : largeString.trim() !== shortLiteral;
}
console.timeEnd("length-fast-path");
