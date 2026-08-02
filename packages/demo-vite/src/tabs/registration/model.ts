import {
  computed,
  intSignal,
  signal,
  strSignal,
  type ReactiveObject,
  type TypedReactiveCollection,
} from "reactiveocl";
import { store } from "@/store";
import {
  BUDGET_STEP,
  INITIAL_BUDGET,
  MAX_ATTENDEES,
  MAX_CONTRACTORS,
  PASS_PRICE,
  POOL_SIZE,
  SEAT_PRICE,
  type Step,
} from "./config";

class CompiledRegistration {
  readonly obj: ReactiveObject;
  readonly team$;
  readonly budget$;
  readonly passes$;
  readonly attendees$: TypedReactiveCollection;

  constructor() {
    this.obj = store
      .getClass("Registration")!
      .create({ team: "", budget: INITIAL_BUDGET, passes: 0 });
    this.team$ = strSignal(this.obj, "team");
    this.budget$ = intSignal(this.obj, "budget");
    this.passes$ = intSignal(this.obj, "passes");
    this.attendees$ = this.obj.collection("attendees");
  }
}

export const reg = new CompiledRegistration();
export const attendees$ = reg.attendees$;

const FIRST = ["Ada", "Grace", "Alan", "Edsger", "Barbara", "Tony", "Donald", "Frances"];
const LAST = ["Lovelace", "Hopper", "Turing", "Dijkstra", "Liskov", "Hoare", "Knuth", "Allen"];

function makePool(): ReactiveObject[] {
  const staff = store.getClass("Staff")!;
  const contractor = store.getClass("Contractor")!;
  const out: ReactiveObject[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const cls = i % 7 === 0 ? contractor : staff;
    out.push(
      cls.create({
        name: `${FIRST[i % FIRST.length]} ${LAST[(i / FIRST.length) | (0 % LAST.length)]} ${i + 1}`,
        accredited: i % 11 !== 0,
      }),
    );
  }
  return out;
}

export const pool: ReactiveObject[] = makePool();

export const attendeeCount$ = attendees$.size();

export const contractorCount$ = attendees$
  .select((o) => (o as ReactiveObject).oclIsTypeOf("Contractor"))
  .size();

export const cost$ = computed(
  () => attendeeCount$.value * SEAT_PRICE + reg.passes$.value * PASS_PRICE,
);

export const seatsAffordable$ = computed(() => Math.floor(reg.budget$.value / SEAT_PRICE));

export const withinBudgetOk$ = computed(() => cost$.value <= reg.obj.preInt("budget"));

export const teamSizeOk$ = computed(
  () => attendeeCount$.value >= 1 && attendeeCount$.value <= MAX_ATTENDEES,
);

export const teamNamedOk$ = computed(() => reg.team$.value.trim() !== "");

export const allAccreditedOk$ = attendees$.forAll((o) => (o as ReactiveObject).bool("accredited"));

export const uniqueNamesOk$ = attendees$.isUnique((o) => (o as ReactiveObject).str("name"));

export const contractorCapOk$ = computed(() => contractorCount$.value <= MAX_CONTRACTORS);

const tx = store.transaction(
  teamNamedOk$,
  withinBudgetOk$,
  teamSizeOk$,
  allAccreditedOk$,
  uniqueNamesOk$,
  contractorCapOk$,
);

export const open$ = signal(false);
export const step$ = signal<Step>(0);
export const query$ = signal("");
export const outcome$ = signal("");
export const outcomeOk$ = signal(true);
export const staged$ = signal(0);

export const pickedKeys$ = computed(
  () => new Set((attendees$.objects.value as ReactiveObject[]).map((o) => `${o.classId}:${o.oid}`)),
);

let eager: ReactiveObject[] = [];
let eagerSnapshot: ReactiveObject[] = [];

export const reoclMs$ = signal(0);
export const eagerMs$ = signal(0);
export const snapshotMs$ = signal(0);
export const lastDeltas$ = signal(0);

const WINDOW = 15;
const reoclSamples: number[] = [];
const eagerSamples: number[] = [];

export const reoclMedianMs$ = signal(0);
export const eagerMedianMs$ = signal(0);

function sample(into: number[], v: number): number {
  into.push(v);
  if (into.length > WINDOW) into.shift();
  const sorted = into.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function eagerRescan(list: ReactiveObject[]) {
  let contractors = 0;
  let accredited = true;
  let unique = true;
  const names = new Set<string>();
  for (const o of list) {
    if (o.oclIsTypeOf("Contractor")) contractors++;
    if (!o.bool("accredited")) accredited = false;
    const n = o.str("name");
    if (names.has(n)) unique = false;
    names.add(n);
  }
  return { count: list.length, contractors, accredited, unique };
}

function stage(
  deltas: number,
  edit: () => void,
  mirror: (list: ReactiveObject[]) => ReactiveObject[],
): void {
  if (!open$.value) return;

  const t0 = performance.now();
  tx.mutate(edit);
  void attendeeCount$.value;
  void contractorCount$.value;
  void allAccreditedOk$.value;
  void uniqueNamesOk$.value;
  reoclMs$.value = performance.now() - t0;

  const t1 = performance.now();
  eager = mirror(eager);
  eagerRescan(eager);
  eagerMs$.value = performance.now() - t1;

  if (deltas === 1) {
    reoclMedianMs$.value = sample(reoclSamples, reoclMs$.value);
    eagerMedianMs$.value = sample(eagerSamples, eagerMs$.value);
  }

  lastDeltas$.value = deltas;
  staged$.value = staged$.value + deltas;
}

export function start(): void {
  tx.begin();
  const t0 = performance.now();
  eagerSnapshot = eager.slice();
  snapshotMs$.value = performance.now() - t0;

  open$.value = true;
  step$.value = 0;
  query$.value = "";
  outcome$.value = "";
  staged$.value = 0;
  reoclMs$.value = 0;
  eagerMs$.value = 0;
  lastDeltas$.value = 0;
  reoclSamples.length = 0;
  eagerSamples.length = 0;
  reoclMedianMs$.value = 0;
  eagerMedianMs$.value = 0;
}

export function goTo(step: Step): void {
  step$.value = step;
}

export function setTeam(name: string): void {
  stage(
    0,
    () => reg.obj.setString("team", name),
    (l) => l,
  );
}

export function raiseBudget(): void {
  stage(
    0,
    () => reg.obj.setInt("budget", reg.budget$.value + BUDGET_STEP),
    (l) => l,
  );
}

export function setPasses(n: number): void {
  stage(
    0,
    () => reg.obj.setInt("passes", Math.max(0, n)),
    (l) => l,
  );
}

export function isPicked(obj: ReactiveObject): boolean {
  return pickedKeys$.value.has(`${obj.classId}:${obj.oid}`);
}

export function toggleAttendee(obj: ReactiveObject): void {
  const picked = isPicked(obj);
  stage(
    1,
    () => {
      if (picked) attendees$.removeByOid(obj.classId, obj.oid);
      else attendees$.add(obj);
    },
    (l) => (picked ? l.filter((o) => o.oid !== obj.oid || o.classId !== obj.classId) : [...l, obj]),
  );
}

export function enrol(n: number): void {
  const picked = pickedKeys$.value;
  const block: ReactiveObject[] = [];
  for (const o of pool) {
    if (block.length >= n) break;
    if (picked.has(`${o.classId}:${o.oid}`)) continue;
    if (o.oclIsTypeOf("Contractor") || !o.bool("accredited")) continue;
    block.push(o);
  }
  stage(
    block.length,
    () => attendees$.addAll(block),
    (l) => [...l, ...block],
  );
}

function violations(): string[] {
  const failed: string[] = [];
  if (!teamNamedOk$.value) failed.push("teamNamed");
  if (!withinBudgetOk$.value) failed.push("withinBudget");
  if (!teamSizeOk$.value) failed.push("teamSize");
  if (!allAccreditedOk$.value) failed.push("allAccredited");
  if (!uniqueNamesOk$.value) failed.push("uniqueNames");
  if (!contractorCapOk$.value) failed.push("contractorCap");
  return failed;
}

export function confirm(): void {
  const failed = violations();
  const ok = tx.commit();
  if (ok) eagerSnapshot = eager.slice();
  else eager = eagerSnapshot;
  open$.value = false;
  outcomeOk$.value = ok;
  outcome$.value = ok
    ? `Registration confirmed for ${attendeeCount$.value.toLocaleString()} attendees.`
    : `Could not confirm: ${failed.length} requirement${failed.length === 1 ? "" : "s"} not met. Nothing was saved.`;
}

export function cancel(): void {
  tx.rollback();
  eager = eagerSnapshot;
  open$.value = false;
  outcomeOk$.value = true;
  outcome$.value = "Registration discarded. Nothing was saved.";
}

export { MAX_ATTENDEES, MAX_CONTRACTORS };
