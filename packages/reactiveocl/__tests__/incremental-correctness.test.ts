import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { TypedReactiveCollection } from "@api/reactive-collection";
import { ReactiveStore } from "@api/reactive-store";

const MIN_SALARY = 20_000;

function empClass() {
  const store = new ReactiveStore();
  store.registerClass("Employee", {
    name: { tag: "String", initial: "" },
    salary: { tag: "Int", initial: 30_000 },
  });
  return store.getClass("Employee")!;
}

const arbSalary = fc.integer({ min: -50_000, max: 200_000 });

type Action = { type: "add"; salary: number } | { type: "removeByOid"; oid: number };

interface Model {
  emps: { oid: number; salary: number }[];
  coll: TypedReactiveCollection;
  forAll$: ReturnType<TypedReactiveCollection["forAll"]>;
  ec: ReturnType<typeof empClass>;
}

function applyAction(m: Model, a: Action): void {
  if (a.type === "add") {
    const emp = m.ec.create({ name: "E", salary: a.salary });
    m.coll.add(emp);
    m.emps.push({ oid: emp.oid, salary: a.salary });
  } else {
    const idx = m.emps.findIndex((e) => e.oid === a.oid);
    if (idx === -1) return;
    m.emps.splice(idx, 1);
    m.coll.removeByOid("Employee", a.oid);
  }
}

function eagerFromModel(m: Model): boolean {
  return m.emps.every((e) => e.salary >= MIN_SALARY);
}

describe("maintained forAll agrees with a from-scratch scan", () => {
  it("forAll equals eager after arbitrary sequences of ADD and REMOVE", () => {
    fc.assert(
      fc.property(
        fc.array(arbSalary, { minLength: 0, maxLength: 10 }),
        fc.array(fc.nat({ max: 30 }), { minLength: 1, maxLength: 50 }),
        (initial, seeds) => {
          const ec = empClass();
          const coll = new TypedReactiveCollection([]);
          const m: Model = {
            emps: [],
            coll,
            forAll$: coll.forAll((o) => o.int("salary") >= MIN_SALARY),
            ec,
          };

          for (const s of initial) {
            applyAction(m, { type: "add", salary: s });
          }

          for (const seed of seeds) {
            const available = m.emps.length > 0 ? 2 : 1;
            const kind = seed % available;
            if (kind === 0 || m.emps.length === 0) {
              applyAction(m, { type: "add", salary: ((seed * 7919) % 100_000) - 30_000 });
            } else {
              const idx = seed % m.emps.length;
              applyAction(m, { type: "removeByOid", oid: m.emps[idx]!.oid });
            }
            expect(m.forAll$.value).toBe(eagerFromModel(m));
          }
        },
      ),
    );
  });

  it("removing a compliant employee never flips forAll from false to true", () => {
    fc.assert(
      fc.property(
        arbSalary,
        arbSalary,
        fc.nat({ max: 10 }),
        (badSalary, goodSalary, extraCompliant) => {
          fc.pre(badSalary < MIN_SALARY);
          fc.pre(goodSalary >= MIN_SALARY);

          const ec = empClass();
          const coll = new TypedReactiveCollection([]);
          const m: Model = {
            emps: [],
            coll,
            forAll$: coll.forAll((o) => o.int("salary") >= MIN_SALARY),
            ec,
          };

          applyAction(m, { type: "add", salary: badSalary });
          expect(m.forAll$.value).toBe(false);

          for (let i = 0; i <= extraCompliant; i++) {
            applyAction(m, { type: "add", salary: goodSalary });
          }
          expect(m.forAll$.value).toBe(false);

          const compliant = m.emps.filter((e) => e.salary >= MIN_SALARY);
          for (const e of compliant) {
            applyAction(m, { type: "removeByOid", oid: e.oid });
            expect(m.forAll$.value).toBe(false);
          }

          expect(m.forAll$.value).toBe(false);
          expect(m.emps.length).toBe(1);
        },
      ),
    );
  });

  it("removing the last violator flips forAll back to true", () => {
    fc.assert(
      fc.property(
        arbSalary,
        fc.array(arbSalary, { minLength: 0, maxLength: 10 }),
        (badSalary, goods) => {
          fc.pre(badSalary < MIN_SALARY);

          const ec = empClass();
          const coll = new TypedReactiveCollection([]);
          const m: Model = {
            emps: [],
            coll,
            forAll$: coll.forAll((o) => o.int("salary") >= MIN_SALARY),
            ec,
          };

          for (const s of goods) {
            applyAction(m, { type: "add", salary: s > 0 ? s + MIN_SALARY : MIN_SALARY + 1 });
          }
          expect(m.forAll$.value).toBe(true);

          applyAction(m, { type: "add", salary: badSalary });
          expect(m.forAll$.value).toBe(false);

          const violator = m.emps.find((e) => e.salary === badSalary)!;
          applyAction(m, { type: "removeByOid", oid: violator.oid });
          expect(m.forAll$.value).toBe(true);
        },
      ),
    );
  });
});
