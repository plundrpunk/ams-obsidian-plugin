const ITERATIONS = 1000000;
const filePath = "some/very/long/path/to/a/file/name_like_this.md";

function original(filePath) {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}

function optimized(filePath) {
  const lastSlash = filePath.lastIndexOf("/");
  const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}

console.time("original");
for (let i = 0; i < ITERATIONS; i++) {
  original(filePath);
}
console.timeEnd("original");

console.time("optimized");
for (let i = 0; i < ITERATIONS; i++) {
  optimized(filePath);
}
console.timeEnd("optimized");
