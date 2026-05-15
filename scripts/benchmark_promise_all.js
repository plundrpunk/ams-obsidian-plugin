const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function simulateSequential(count) {
  const start = Date.now();
  for (let i = 0; i < count; i++) {
    await sleep(50); // Simulate network request
    // Simulate finding it on the last one to show worst-case
    if (i === count - 1) return Date.now() - start;
  }
}

async function simulateParallel(count) {
  const start = Date.now();
  const arr = Array.from({ length: count });
  await Promise.all(arr.map(async (_, i) => {
    await sleep(50);
  }));
  return Date.now() - start;
}

async function run() {
  console.log("Benchmarking sequential vs parallel for 10 items (worst-case)...");
  const seqTime = await simulateSequential(10);
  console.log(`Sequential: ${seqTime}ms`);

  const parTime = await simulateParallel(10);
  console.log(`Parallel: ${parTime}ms`);

  console.log(`Improvement: ~${Math.round((seqTime - parTime) / seqTime * 100)}%`);
}

run();
