/**
 * Conformance of the runtime with the option-valued semantics of ReOCL:
 * undefinedness, short-circuiting, structural equality and pre-state reads.
 */
import { describe, expect, it } from "bun:test";
import { compileInvariant, evalExpr, typeOf } from "@core/compiler";
import { Store } from "@core/store";
import { Transaction } from "@core/transaction";
import { TInt, TObject, type Expr, type MetaModel } from "@core/types";
import { vcoll, VFalse, vint, vobj, vstring, VTrue } from "@core/values";
import { ReactiveStore } from "@api/reactive-store";
import { TypedReactiveCollection } from "@api/reactive-collection";

/** Metamodel with Manager <= Employee. */
const hierarchy: MetaModel = {
  fieldType(C, f) {
    if (f === "salary" && (C === "Employee" || C === "Manager")) return TInt;
    return null;
  },
  // The subclass relation is reflexive and transitive.
  extends(sub, sup) {
    if (sub === sup) return true;
    return sub === "Manager" && sup === "Employee";
  },
};

const store = new Store();

describe("oclIsKindOf follows the subclass relation", () => {
  const env = new Map([["self", vobj(1, "Manager")]]);
  const kindOf = (C: string): Expr => ({ tag: "EKindOf", e: { tag: "ESelf" }, C });
  const typeOfExpr = (C: string): Expr => ({ tag: "ETypeOf", e: { tag: "ESelf" }, C });

  it("a Manager is a kind of Employee", () => {
    expect(evalExpr(kindOf("Employee"), env, store, null, hierarchy)).toEqual(VTrue);
  });

  it("kind test is reflexive", () => {
    expect(evalExpr(kindOf("Manager"), env, store, null, hierarchy)).toEqual(VTrue);
  });

  it("unrelated classes are rejected", () => {
    expect(evalExpr(kindOf("Department"), env, store, null, hierarchy)).toEqual(VFalse);
  });

  it("oclIsTypeOf stays exact, unlike oclIsKindOf", () => {
    expect(evalExpr(typeOfExpr("Employee"), env, store, null, hierarchy)).toEqual(VFalse);
    expect(evalExpr(typeOfExpr("Manager"), env, store, null, hierarchy)).toEqual(VTrue);
  });

  it("static compatibility ignores inheritance", () => {
    const branches: Expr = {
      tag: "EIf",
      e1: { tag: "ETrue" },
      e2: { tag: "EVar", x: "m" },
      e3: { tag: "EVar", x: "e" },
    };
    const env2 = new Map([
      ["m", TObject("Manager")],
      ["e", TObject("Employee")],
    ]);
    expect(typeOf(env2, branches, hierarchy)).toBeNull();
  });
});

describe("ReactiveStore exposes the class hierarchy as a MetaModel", () => {
  function hierarchyStore() {
    const s = new ReactiveStore();
    s.registerClass("Employee", { salary: { tag: "Int", initial: 0 } });
    s.registerClass("Manager", { reports: { tag: "Int", initial: 0 } }, { extends: "Employee" });
    return s;
  }

  it("extends is reflexive and transitive", () => {
    const mm = hierarchyStore().metaModel;
    expect(mm.extends("Manager", "Employee")).toBe(true);
    expect(mm.extends("Manager", "Manager")).toBe(true);
    expect(mm.extends("Employee", "Manager")).toBe(false);
  });

  it("inherited fields are visible on the subclass", () => {
    const s = hierarchyStore();
    expect(s.metaModel.fieldType("Manager", "salary")).toEqual(TInt);
    const m = s.getClass("Manager")!.create({ salary: 50_000, reports: 3 });
    expect(m.int("salary")).toBe(50_000);
    expect(m.int("reports")).toBe(3);
  });

  it("registering with an unknown superclass fails loudly", () => {
    const s = new ReactiveStore();
    expect(() => s.registerClass("Manager", {}, { extends: "Nope" })).toThrow();
  });

  it("oclIsKindOf works against a store-backed metamodel", () => {
    const s = hierarchyStore();
    const m = s.getClass("Manager")!.create({});
    const env = new Map([["self", vobj(m.oid, "Manager")]]);
    const kindOf: Expr = { tag: "EKindOf", e: { tag: "ESelf" }, C: "Employee" };
    expect(evalExpr(kindOf, env, s.core, null, s.metaModel)).toEqual(VTrue);
  });

  it("objects answer the type tests directly", () => {
    const s = hierarchyStore();
    const m = s.getClass("Manager")!.create({});
    const e = s.getClass("Employee")!.create({});

    expect(m.oclIsKindOf("Employee")).toBe(true);
    expect(m.oclIsKindOf("Manager")).toBe(true);
    expect(m.oclIsTypeOf("Employee")).toBe(false);
    expect(m.oclIsTypeOf("Manager")).toBe(true);

    expect(e.oclIsKindOf("Manager")).toBe(false);
    expect(e.oclIsKindOf("Employee")).toBe(true);
    expect(e.oclIsTypeOf("Employee")).toBe(true);
  });

  it("a class without a superclass is a kind of itself only", () => {
    const s = new ReactiveStore();
    s.registerClass("C", {});
    const o = s.getClass("C")!.create({});
    expect(o.oclIsKindOf("C")).toBe(true);
    expect(o.oclIsKindOf("D")).toBe(false);
  });

  it("kind tests are stable, so views filtered by them stay exact", () => {
    const s = hierarchyStore();
    const E = s.getClass("Employee")!;
    const M = s.getClass("Manager")!;
    const staff = new TypedReactiveCollection([E.create({}), M.create({})]);

    const managers = staff.select((o) => o.oclIsKindOf("Manager"));
    const managerCount$ = managers.size();
    expect(managerCount$.value).toBe(1);

    const extra = M.create({});
    staff.add(extra);
    expect(managerCount$.value).toBe(2);

    staff.removeByOid("Manager", extra.oid);
    expect(managerCount$.value).toBe(1);

    staff.add(E.create({}));
    expect(managerCount$.value).toBe(1);
  });
});

describe("iterator bodies are option-valued", () => {
  const env = new Map([["c", vcoll([vint(1), vint(2)])]]);
  const nonBoolBody: Expr = { tag: "EVar", x: "x" }; // an Int, not a Boolean

  for (const tag of ["ESelect", "EReject", "EForAll", "EExists", "EOne", "EAny"] as const) {
    it(`${tag} is undefined when the body is not Boolean`, () => {
      const expr = { tag, e1: { tag: "EVar", x: "c" }, x: "x", e2: nonBoolBody } as Expr;
      expect(evalExpr(expr, env, store, null)).toBeNull();
    });
  }

  it("exists is false when no element satisfies a defined body", () => {
    const expr: Expr = {
      tag: "EExists",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 10 } },
    };
    expect(evalExpr(expr, env, store, null)).toEqual(VFalse);
  });

  it("select keeps the elements whose body holds", () => {
    const expr: Expr = {
      tag: "ESelect",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 1 } },
    };
    expect(evalExpr(expr, env, store, null)).toEqual(vcoll([vint(2)]));
  });

  it("an iterator binding does not leak into the enclosing environment", () => {
    const outer = new Map([
      ["c", vcoll([vint(1), vint(2)])],
      ["x", vint(99)],
    ]);
    const expr: Expr = {
      tag: "EForAll",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 0 } },
    };
    expect(evalExpr(expr, outer, store, null)).toEqual(VTrue);
    expect(outer.get("x")).toEqual(vint(99));
  });
});

describe("isUnique is strict and compares values structurally", () => {
  it("distinct strings of equal length are not duplicates", () => {
    const env = new Map([["c", vcoll([vstring("ab"), vstring("cd")])]]);
    const expr: Expr = {
      tag: "EIsUnique",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EVar", x: "x" },
    };
    expect(evalExpr(expr, env, store, null)).toEqual(VTrue);
  });

  it("equal keys are duplicates", () => {
    const env = new Map([["c", vcoll([vstring("ab"), vstring("ab")])]]);
    const expr: Expr = {
      tag: "EIsUnique",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EVar", x: "x" },
    };
    expect(evalExpr(expr, env, store, null)).toEqual(VFalse);
  });

  it("an undefined key after a duplicate still makes the result undefined", () => {
    // Every key is evaluated before duplicates are looked for.
    const env = new Map([["c", vcoll([vint(1), vint(1), vint(0)])]]);
    const expr: Expr = {
      tag: "EIsUnique",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "div", e1: { tag: "EIntLit", n: 10 }, e2: { tag: "EVar", x: "x" } },
    };
    expect(evalExpr(expr, env, store, null)).toBeNull();
  });
});

describe("implies short-circuits on a false left operand", () => {
  it("a false antecedent hides an undefined consequent", () => {
    const expr: Expr = {
      tag: "EBinOp",
      op: "implies",
      e1: { tag: "EFalse" },
      e2: { tag: "EBinOp", op: "div", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "EIntLit", n: 0 } },
    };
    expect(evalExpr(expr, new Map(), store, null)).toEqual(VTrue);
  });

  it("a true antecedent still requires a defined Boolean consequent", () => {
    const expr: Expr = {
      tag: "EBinOp",
      op: "implies",
      e1: { tag: "ETrue" },
      e2: { tag: "EBinOp", op: "div", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "EIntLit", n: 0 } },
    };
    expect(evalExpr(expr, new Map(), store, null)).toBeNull();
  });
});

describe("@pre reads the state recorded at transaction begin", () => {
  /** context C inv conservation: self.a + self.b = self.a@pre + self.b@pre */
  const conservation = {
    context: "C",
    name: "conservation",
    body: {
      tag: "EBinOp" as const,
      op: "eq" as const,
      e1: {
        tag: "EBinOp" as const,
        op: "add" as const,
        e1: { tag: "ENav" as const, e: { tag: "ESelf" as const }, f: "a" },
        e2: { tag: "ENav" as const, e: { tag: "ESelf" as const }, f: "b" },
      },
      e2: {
        tag: "EBinOp" as const,
        op: "add" as const,
        e1: { tag: "EPre" as const, e: { tag: "ESelf" as const }, f: "a" },
        e2: { tag: "EPre" as const, e: { tag: "ESelf" as const }, f: "b" },
      },
    },
  };

  function scenario() {
    const s = new Store();
    s.register("C", 1, "a", vint(300));
    s.register("C", 1, "b", vint(700));
    const tx = new Transaction(s);
    const inv$ = compileInvariant(conservation, s, 1, tx);
    tx.watch(inv$);
    return { store: s, tx, inv$ };
  }

  it("a transfer keeps the total, so the invariant holds", () => {
    const { store: s, tx, inv$ } = scenario();
    tx.begin();
    tx.mutate(() => {
      s.write("C:1:a", vint(400));
      s.write("C:1:b", vint(600));
    });
    expect(inv$.value).toBe(true);
    expect(tx.commit()).toBe(true);
  });

  it("a one-sided mutation breaks it and rolls back", () => {
    const { store: s, tx, inv$ } = scenario();
    tx.begin();
    tx.mutate(() => s.write("C:1:a", vint(350)));
    expect(inv$.value).toBe(false);
    expect(tx.commit()).toBe(false);
    expect(s.read("C:1:a")).toEqual(vint(300));
    expect(s.read("C:1:b")).toEqual(vint(700));
  });

  it("outside a transaction @pre is undefined", () => {
    const { inv$ } = scenario();
    expect(inv$.value).toBe(false);
  });

  it("only mutated locations are recorded, and unmutated ones read as pre-state", () => {
    const { store: s, tx } = scenario();
    tx.begin();
    tx.mutate(() => s.write("C:1:a", vint(350)));
    // The heap holds just the mutated cell...
    expect(tx.preHeap!.size).toBe(1);
    expect(tx.preHeap!.get("C:1:a")).toEqual(vint(300));
    // ...yet reads agree with a full snapshot taken at begin.
    expect(tx.$pre("C:1:a")).toEqual(vint(300));
    expect(tx.$pre("C:1:b")).toEqual(vint(700));
    tx.commit();
  });
});
