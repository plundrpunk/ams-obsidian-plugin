import { performance } from "perf_hooks";

function oldDerive(filePath) {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}

function newDerive(filePath) {
  const lastSlashIndex = filePath.lastIndexOf("/");
  const name = lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}

const paths = [
  "Notes/Projects/2023_Project_Alpha.md",
  "Daily/2024-01-01.md",
  "Simple_Note.md",
  "A/Very/Long/Nested/Path/To/A/Note_With_Underscores.md"
];

const ITERS = 1_000_000;

console.log("Warming up...");
for (let i = 0; i < 10000; i++) {
  oldDerive(paths[i % paths.length]);
  newDerive(paths[i % paths.length]);
}

console.log(`Running ${ITERS} iterations...`);

const startOld = performance.now();
for (let i = 0; i < ITERS; i++) {
  oldDerive(paths[i % paths.length]);
}
const endOld = performance.now();
const oldTime = endOld - startOld;

const startNew = performance.now();
for (let i = 0; i < ITERS; i++) {
  newDerive(paths[i % paths.length]);
}
const endNew = performance.now();
const newTime = endNew - startNew;

console.log(`Old: ${oldTime.toFixed(2)}ms`);
console.log(`New: ${newTime.toFixed(2)}ms`);
console.log(`Improvement: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}%`);
