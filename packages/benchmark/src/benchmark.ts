import { parseArgs } from "util";
import { mkdir } from "node:fs/promises";
import { makeScenario } from "./scenario";
import { ReoclDepartment } from "./reocl";
import { EagerDepartmentImpl } from "./eager";
import { OclJsDepartment } from "./ocl_js";
import type { Department } from "./model";

// Benchmarks the three engines - ReOCL (incremental), a plain eager
// implementation, and the ocl.js library - on the same department scenario:
// one million employees in the largest size, mutations mixed between adds and
// removes, and an `activeCapacity` invariant read after every mutation.
// Measures init cost, per-mutation cost, and the two combined.

// https://bun.com/docs/guides/process/argv
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    sizes: { type: "string", default: "100,1000,10000,100000,1000000" },
    ops: { type: "string", default: "10000" },
    "ops-scale": { type: "boolean", default: true },
  },
  strict: true,
  allowPositionals: true,
});

const SIZES = values.sizes!.split(",").map(Number);
const BASE_MUTATIONS = Number(values.ops!);
const MUTATIONS_SCALE = values["ops-scale"] as boolean;

// With scaling, the mutation budget shrinks as the model grows, so the run
// stays interactive at the million-employee size while still stressing the
// incremental machinery at the smaller ones.
function mutationsForN(n: number): number {
  if (!MUTATIONS_SCALE) return BASE_MUTATIONS;
  if (n <= 1000) return BASE_MUTATIONS;
  if (n <= 10000) return Math.round(BASE_MUTATIONS / 2);
  if (n <= 100000) return Math.round(BASE_MUTATIONS / 10);
  return Math.round(BASE_MUTATIONS / 50);
}

// SINK absorbs the invariant result, so no engine can skip maintaining it.
let SINK = 0;

function runMutateLoop(
  dept: Department,
  mutations: ReturnType<typeof makeScenario>["mutations"],
): void {
  for (const mutation of mutations) {
    switch (mutation.kind) {
      case "add":
        dept.addEmployee(mutation.employee);
        break;
      case "remove":
        dept.removeEmployee(mutation.employee);
        break;
    }
    SINK ^= dept.activeCapacity ? 1 : 0;
  }
}

// Stat reports avg and median (p50); the median is what the summary tables
// show, because a single cold outlier distorts the mean far more than the
// latency a user would actually perceive.
interface Stat {
  avg: number;
  p50: number;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = (sorted.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - mid) + sorted[hi]! * (mid - lo);
}

function stat(trials: number[]): Stat {
  if (trials.length === 0) return { avg: 0, p50: 0 };
  const s = trials.slice().sort((a, b) => a - b);
  return {
    avg: trials.reduce((a, b) => a + b, 0) / trials.length,
    p50: median(s),
  };
}

function ms(value: number, digits = 2): string {
  return `${value.toFixed(digits)} ms`;
}

function us(valueMs: number, digits = 3): string {
  return `${(valueMs * 1000).toFixed(digits)} µs`;
}

function warmup(deps: Department[], mutations: ReturnType<typeof makeScenario>["mutations"]): void {
  for (const dept of deps) {
    runMutateLoop(dept, mutations);
  }
}

// Sanity check: run the same mutations through all three engines and require
// them to agree on the invariant after every step, before any timing begins.
{
  const scenario = makeScenario(100, 500);
  const reocl = new ReoclDepartment(scenario.initialEmployees, scenario.capacity);
  const eager = new EagerDepartmentImpl(scenario.initialEmployees, scenario.capacity);
  const ocljs = new OclJsDepartment(scenario.initialEmployees, scenario.capacity);

  for (const mutation of scenario.mutations) {
    switch (mutation.kind) {
      case "add":
        reocl.addEmployee(mutation.employee);
        eager.addEmployee(mutation.employee);
        ocljs.addEmployee(mutation.employee);
        break;
      case "remove":
        reocl.removeEmployee(mutation.employee);
        eager.removeEmployee(mutation.employee);
        ocljs.removeEmployee(mutation.employee);
        break;
    }

    const reoclValue = reocl.activeCapacity;
    const eagerValue = eager.activeCapacity;
    const ocljsValue = ocljs.activeCapacity;

    if (reoclValue !== eagerValue || reoclValue !== ocljsValue) {
      console.error("Correctness mismatch!");
      console.table({
        ReOCL: { activeCapacity: reoclValue },
        Eager: { activeCapacity: eagerValue },
        "OCL.js": { activeCapacity: ocljsValue },
      });
      process.exit(1);
    }
  }
  console.log("Correctness: OK\n");
}

await mkdir("results", { recursive: true });

const initResults = {} as Record<string, Record<string, Stat>>;
const mutateResults = {} as Record<string, Record<string, Stat>>;
const totalMeasuredResults = {} as Record<string, Record<string, Stat>>;
const initSummary: Array<Record<string, string | number>> = [];
const mutateSummary: Array<Record<string, string | number>> = [];
const totalSummary: Array<Record<string, string | number>> = [];

for (const n of SIZES) {
  const nMutations = mutationsForN(n);
  const scenario = makeScenario(n, nMutations);

  // Init measurement: construct the department fresh, without mutating it.
  // This is where ReOCL pays for building its indexes, and ocl.js for parsing
  // and compiling the invariant source.
  const INIT_RUNS = n <= 1000 ? 20 : 5;
  console.group(`N=${n.toLocaleString()}  mutations=${nMutations.toLocaleString()}`);
  console.log(`init: ${INIT_RUNS} runs`);

  const reoclInitRuns: number[] = [];
  for (let i = 0; i < INIT_RUNS; i++) {
    const t0 = performance.now();
    void new ReoclDepartment(scenario.initialEmployees, scenario.capacity);
    reoclInitRuns.push(performance.now() - t0);
  }

  const eagerInitRuns: number[] = [];
  for (let i = 0; i < INIT_RUNS; i++) {
    const t0 = performance.now();
    void new EagerDepartmentImpl(scenario.initialEmployees, scenario.capacity);
    eagerInitRuns.push(performance.now() - t0);
  }

  const ocljsInitRuns: number[] = [];
  for (let i = 0; i < INIT_RUNS; i++) {
    const t0 = performance.now();
    void new OclJsDepartment(scenario.initialEmployees, scenario.capacity);
    ocljsInitRuns.push(performance.now() - t0);
  }

  const reoclInit = stat(reoclInitRuns);
  const eagerInit = stat(eagerInitRuns);
  const ocljsInit = stat(ocljsInitRuns);
  initResults[String(n)] = { reocl: reoclInit, eager: eagerInit, ocljs: ocljsInit };

  console.table({
    ReOCL: { runs: INIT_RUNS, avg: ms(reoclInit.avg), p50: ms(reoclInit.p50) },
    Eager: { runs: INIT_RUNS, avg: ms(eagerInit.avg), p50: ms(eagerInit.p50) },
    "OCL.js": { runs: INIT_RUNS, avg: ms(ocljsInit.avg, 3), p50: ms(ocljsInit.p50, 3) },
  });

  // Warmup: let JIT compilation and cold module loading settle before the
  // per-operation numbers are taken.
  {
    const wR = new ReoclDepartment(scenario.initialEmployees, scenario.capacity);
    const wE = new EagerDepartmentImpl(scenario.initialEmployees, scenario.capacity);
    const wO = new OclJsDepartment(scenario.initialEmployees, scenario.capacity);
    warmup([wR, wE, wO], scenario.mutations);
  }

  // Steady-state per-mutation cost: each trial replays the whole mutation list
  // on a fresh department and divides by the number of mutations, so adds and
  // removes are averaged together.
  const MUTATE_TRIALS = n <= 1000 ? 10 : 3;
  const ocljsTrials = n <= 100 ? MUTATE_TRIALS : 1;
  console.log(
    `mutate: ${nMutations.toLocaleString()} mutations (reocl/eager x${MUTATE_TRIALS}, ocljs x${ocljsTrials})`,
  );

  const reoclMutateRuns: number[] = [];
  for (let t = 0; t < MUTATE_TRIALS; t++) {
    const dept = new ReoclDepartment(scenario.initialEmployees, scenario.capacity);
    const t0 = performance.now();
    runMutateLoop(dept, scenario.mutations);
    reoclMutateRuns.push((performance.now() - t0) / nMutations);
  }

  const eagerMutateRuns: number[] = [];
  for (let t = 0; t < MUTATE_TRIALS; t++) {
    const dept = new EagerDepartmentImpl(scenario.initialEmployees, scenario.capacity);
    const t0 = performance.now();
    runMutateLoop(dept, scenario.mutations);
    eagerMutateRuns.push((performance.now() - t0) / nMutations);
  }

  const ocljsMutateRuns: number[] = [];
  for (let t = 0; t < ocljsTrials; t++) {
    const dept = new OclJsDepartment(scenario.initialEmployees, scenario.capacity);
    const t0 = performance.now();
    runMutateLoop(dept, scenario.mutations);
    ocljsMutateRuns.push((performance.now() - t0) / nMutations);
  }

  const reoclMutate = stat(reoclMutateRuns);
  const eagerMutate = stat(eagerMutateRuns);
  const ocljsMutate = stat(ocljsMutateRuns);
  mutateResults[String(n)] = { reocl: reoclMutate, eager: eagerMutate, ocljs: ocljsMutate };

  console.table({
    ReOCL: { runs: MUTATE_TRIALS, avg: us(reoclMutate.avg), p50: us(reoclMutate.p50) },
    Eager: { runs: MUTATE_TRIALS, avg: us(eagerMutate.avg), p50: us(eagerMutate.p50) },
    "OCL.js": { runs: ocljsTrials, avg: us(ocljsMutate.avg, 2), p50: us(ocljsMutate.p50, 2) },
  });

  // Directly measured total: init plus all mutations in one timed block. This
  // is the end-to-end cost a user pays, and it can differ from init + N x
  // per-mutation because of allocation and GC effects across the phases.
  const TOTAL_TRIALS = MUTATE_TRIALS;
  const ocljsTotalTrials = n <= 100 ? TOTAL_TRIALS : 1;
  console.log(`total measured (reocl/eager x${TOTAL_TRIALS}, ocljs x${ocljsTotalTrials})`);

  const reoclTotalRuns: number[] = [];
  for (let t = 0; t < TOTAL_TRIALS; t++) {
    const t0 = performance.now();
    const dept = new ReoclDepartment(scenario.initialEmployees, scenario.capacity);
    runMutateLoop(dept, scenario.mutations);
    reoclTotalRuns.push(performance.now() - t0);
  }

  const eagerTotalRuns: number[] = [];
  for (let t = 0; t < TOTAL_TRIALS; t++) {
    const t0 = performance.now();
    const dept = new EagerDepartmentImpl(scenario.initialEmployees, scenario.capacity);
    runMutateLoop(dept, scenario.mutations);
    eagerTotalRuns.push(performance.now() - t0);
  }

  const ocljsTotalRuns: number[] = [];
  for (let t = 0; t < ocljsTotalTrials; t++) {
    const t0 = performance.now();
    const dept = new OclJsDepartment(scenario.initialEmployees, scenario.capacity);
    runMutateLoop(dept, scenario.mutations);
    ocljsTotalRuns.push(performance.now() - t0);
  }

  const reoclTotalMeasured = stat(reoclTotalRuns);
  const eagerTotalMeasured = stat(eagerTotalRuns);
  const ocljsTotalMeasured = stat(ocljsTotalRuns);
  totalMeasuredResults[String(n)] = {
    reocl: reoclTotalMeasured,
    eager: eagerTotalMeasured,
    ocljs: ocljsTotalMeasured,
  };

  console.table({
    ReOCL: { runs: TOTAL_TRIALS, avg: ms(reoclTotalMeasured.avg), p50: ms(reoclTotalMeasured.p50) },
    Eager: { runs: TOTAL_TRIALS, avg: ms(eagerTotalMeasured.avg), p50: ms(eagerTotalMeasured.p50) },
    "OCL.js": {
      runs: ocljsTotalTrials,
      avg: ms(ocljsTotalMeasured.avg, 3),
      p50: ms(ocljsTotalMeasured.p50, 3),
    },
  });

  initSummary.push({
    N: n.toLocaleString(),
    ReOCL: ms(reoclInit.avg),
    Eager: ms(eagerInit.avg),
    "OCL.js": ms(ocljsInit.avg, 3),
  });
  mutateSummary.push({
    N: n.toLocaleString(),
    ReOCL: us(reoclMutate.avg),
    Eager: us(eagerMutate.avg),
    "OCL.js": us(ocljsMutate.avg, 2),
  });
  totalSummary.push({
    N: n.toLocaleString(),
    ReOCL: ms(reoclTotalMeasured.avg),
    Eager: ms(eagerTotalMeasured.avg),
    "OCL.js": ms(ocljsTotalMeasured.avg, 3),
  });

  console.groupEnd();
}

// Machine-readable results for the research scripts; the tables below are for
// a quick glance at a single run.
await Bun.write(
  "results/rq2.json",
  JSON.stringify(
    {
      config: { sizes: SIZES, baseMutations: BASE_MUTATIONS, mutationsScale: MUTATIONS_SCALE },
      init: initResults,
      mutate: mutateResults,
      totalMeasured: totalMeasuredResults,
    },
    null,
    2,
  ),
);
console.log(`\nSINK = ${SINK}`);
console.log("Init summary:");
console.table(Object.fromEntries(initSummary.map(({ N, ...row }) => [N, row])));
console.log("Mutate summary:");
console.table(Object.fromEntries(mutateSummary.map(({ N, ...row }) => [N, row])));
console.log("Total summary:");
console.table(Object.fromEntries(totalSummary.map(({ N, ...row }) => [N, row])));
console.log("Benchmark complete. Results saved to results/rq2.json.");
