import { describe, expect, it, spyOn } from "bun:test";
import { compileInvariant, evalExpr } from "@core/compiler";
import { Store } from "@core/store";
import type { BinOp, Expr, Invariant } from "@core/types";
import { vcoll, VFalse, vint, vobj, vstring, VTrue, type OCLVal } from "@core/values";

const store = new Store();
store.register("Person", 1, "name", vstring("Alice"));
store.register("Person", 1, "age", vint(30));

type ValEnv = Map<string, OCLVal | undefined>;

const evalIn = (e: Expr, env: ValEnv = new Map(), heap: Map<string, OCLVal> | null = null) =>
  evalExpr(e, env, store, heap);

const int = (n: number): Expr => ({ tag: "EIntLit", n });
const variable = (x: string): Expr => ({ tag: "EVar", x });
const bin = (op: BinOp, e1: Expr, e2: Expr): Expr => ({ tag: "EBinOp", op, e1, e2 });
const self: Expr = { tag: "ESelf" };
const bound = (x: string, v: OCLVal): ValEnv => new Map([[x, v]]);
const gt = (n: number): Expr => bin("gt", variable("x"), int(n));

describe("literals and variables", () => {
  it("a literal evaluates to the value it denotes", () => {
    expect(evalIn({ tag: "ETrue" })).toEqual(VTrue);
    expect(evalIn({ tag: "EFalse" })).toEqual(VFalse);
    expect(evalIn(int(42))).toEqual(vint(42));
    expect(evalIn({ tag: "EStringLit", s: "hi" })).toEqual(vstring("hi"));
  });

  it("a bound variable evaluates to its binding, an unbound one is undefined", () => {
    const env = bound("x", vint(7));
    expect(evalIn(variable("x"), env)).toEqual(vint(7));
    expect(evalIn(variable("y"), env)).toBeNull();
  });

  it("self is undefined unless the environment binds it", () => {
    expect(evalIn(self, bound("self", vint(42)))).toEqual(vint(42));
    expect(evalIn(self)).toBeNull();
  });
});

describe("navigation", () => {
  const person = bound("self", vobj(1, "Person"));

  it("reads the field from the store", () => {
    expect(evalIn({ tag: "ENav", e: self, f: "name" }, person)).toEqual(vstring("Alice"));
  });

  it("is undefined on a receiver that is not an object", () => {
    expect(evalIn({ tag: "ENav", e: self, f: "age" }, bound("self", vint(1)))).toBeNull();
  });

  it("is undefined for a field the object does not have", () => {
    expect(evalIn({ tag: "ENav", e: self, f: "nonexistent" }, person)).toBeNull();
  });

  it("pre-state navigation reads the recorded value", () => {
    const heap = new Map<string, OCLVal>([["Person:1:age", vint(25)]]);
    expect(evalIn({ tag: "EPre", e: variable("self"), f: "age" }, person, heap)).toEqual(vint(25));
  });

  it("pre-state navigation is undefined with no transaction", () => {
    expect(evalIn({ tag: "EPre", e: variable("self"), f: "age" }, person)).toBeNull();
  });

  it("is undefined when the receiver is itself undefined, rather than crashing", () => {
    const missing = variable("unbound");
    expect(evalIn({ tag: "ENav", e: missing, f: "age" })).toBeNull();
    expect(evalIn({ tag: "EPre", e: missing, f: "age" }, new Map(), new Map())).toBeNull();
    expect(evalIn({ tag: "EKindOf", e: missing, C: "Person" })).toBeNull();
    expect(evalIn({ tag: "ETypeOf", e: missing, C: "Person" })).toBeNull();
  });
});

describe("arithmetic and comparison", () => {
  it("computes over integer operands", () => {
    expect(evalIn(bin("add", int(3), int(4)))).toEqual(vint(7));
    expect(evalIn(bin("sub", int(10), int(3)))).toEqual(vint(7));
    expect(evalIn(bin("mul", int(4), int(5)))).toEqual(vint(20));
    expect(evalIn(bin("div", int(10), int(3)))).toEqual(vint(10 / 3));
  });

  it("compares integers", () => {
    expect(evalIn(bin("lt", int(1), int(2)))).toEqual(VTrue);
    expect(evalIn(bin("gt", int(3), int(2)))).toEqual(VTrue);
    expect(evalIn(bin("leq", int(2), int(2)))).toEqual(VTrue);
    expect(evalIn(bin("geq", int(2), int(2)))).toEqual(VTrue);
  });

  it("decides equality structurally", () => {
    expect(evalIn(bin("eq", int(5), int(5)))).toEqual(VTrue);
    expect(evalIn(bin("neq", int(1), int(2)))).toEqual(VTrue);
    expect(evalIn(bin("neq", int(2), int(1)))).toEqual(VTrue);
    expect(evalIn(bin("leq", int(2), int(1)))).toEqual(VFalse);
  });

  it("is undefined when an operand is undefined", () => {
    expect(evalIn(bin("add", variable("missing"), int(1)))).toBeNull();
  });
});

describe("Boolean operators", () => {
  it("and, or and xor follow their truth tables", () => {
    expect(evalIn(bin("and", { tag: "ETrue" }, { tag: "ETrue" }))).toEqual(VTrue);
    expect(evalIn(bin("and", { tag: "ETrue" }, { tag: "EFalse" }))).toEqual(VFalse);
    expect(evalIn(bin("or", { tag: "EFalse" }, { tag: "ETrue" }))).toEqual(VTrue);
    expect(evalIn(bin("or", { tag: "EFalse" }, { tag: "EFalse" }))).toEqual(VFalse);
    expect(evalIn(bin("xor", { tag: "ETrue" }, { tag: "EFalse" }))).toEqual(VTrue);
    expect(evalIn(bin("implies", { tag: "ETrue" }, { tag: "EFalse" }))).toEqual(VFalse);
  });

  it("negation inverts a Boolean and is undefined on anything else", () => {
    expect(evalIn({ tag: "ENot", e: { tag: "ETrue" } })).toEqual(VFalse);
    expect(evalIn({ tag: "ENot", e: { tag: "EFalse" } })).toEqual(VTrue);
    expect(evalIn({ tag: "ENot", e: int(1) })).toBeNull();
  });

  it("a non-Boolean operand makes a connective undefined", () => {
    expect(evalIn(bin("and", int(1), { tag: "ETrue" }))).toBeNull();
    expect(evalIn(bin("and", { tag: "ETrue" }, int(1)))).toBeNull();
    expect(evalIn(bin("or", int(1), { tag: "ETrue" }))).toBeNull();
  });
});

describe("conditionals", () => {
  it("takes the branch the guard selects", () => {
    expect(evalIn({ tag: "EIf", e1: { tag: "ETrue" }, e2: int(1), e3: int(2) })).toEqual(vint(1));
    expect(evalIn({ tag: "EIf", e1: { tag: "EFalse" }, e2: int(1), e3: int(2) })).toEqual(vint(2));
  });

  it("is undefined when the guard is not Boolean", () => {
    expect(
      evalIn({ tag: "EIf", e1: int(1), e2: { tag: "ETrue" }, e3: { tag: "EFalse" } }),
    ).toBeNull();
  });
});

describe("collection operators", () => {
  const over = (ns: number[]) => bound("c", vcoll(ns.map(vint)));
  const c = variable("c");

  it("forAll and exists quantify over the elements", () => {
    const forAll: Expr = { tag: "EForAll", e1: c, x: "x", e2: gt(0) };
    expect(evalIn(forAll, over([1, 2, 3]))).toEqual(VTrue);
    expect(evalIn(forAll, over([1, 0, 3]))).toEqual(VFalse);

    const exists: Expr = { tag: "EExists", e1: c, x: "x", e2: gt(0) };
    expect(evalIn(exists, over([0, 0, 5]))).toEqual(VTrue);
    expect(evalIn(exists, over([0, 0]))).toEqual(VFalse);
  });

  it("the quantifiers are told apart by how many elements match", () => {
    const two = over([5, 6, 0]);
    expect(evalIn({ tag: "EExists", e1: c, x: "x", e2: gt(3) }, two)).toEqual(VTrue);
    expect(evalIn({ tag: "EOne", e1: c, x: "x", e2: gt(3) }, two)).toEqual(VFalse);
    expect(evalIn({ tag: "EForAll", e1: c, x: "x", e2: gt(3) }, two)).toEqual(VFalse);

    const none = over([]);
    expect(evalIn({ tag: "EForAll", e1: c, x: "x", e2: gt(3) }, none)).toEqual(VTrue);
    expect(evalIn({ tag: "EExists", e1: c, x: "x", e2: gt(3) }, none)).toEqual(VFalse);
    expect(evalIn({ tag: "EOne", e1: c, x: "x", e2: gt(3) }, none)).toEqual(VFalse);
    expect(evalIn({ tag: "EAny", e1: c, x: "x", e2: gt(3) }, none)).toBeNull();
  });

  it("select and reject are told apart by which elements they keep", () => {
    const src = over([1, 5]);
    expect(evalIn({ tag: "ESelect", e1: c, x: "x", e2: gt(3) }, src)).toEqual(vcoll([vint(5)]));
    expect(evalIn({ tag: "EReject", e1: c, x: "x", e2: gt(3) }, src)).toEqual(vcoll([vint(1)]));
  });

  it("size and sum are told apart by elements that are not one each", () => {
    const src = over([10, 20]);
    expect(evalIn({ tag: "ESize", e: c }, src)).toEqual(vint(2));
    expect(evalIn({ tag: "ESum", e: c }, src)).toEqual(vint(30));
  });

  it("isEmpty and notEmpty are opposites on the same collection", () => {
    const src = over([1]);
    expect(evalIn({ tag: "EIsEmpty", e: c }, src)).toEqual(VFalse);
    expect(evalIn({ tag: "ENotEmpty", e: c }, src)).toEqual(VTrue);
  });

  it("an undefined iterator body makes every strict operator undefined", () => {
    const src = over([1, 2]);
    const undefinedBody: Expr = variable("unbound");
    for (const tag of ["ESelect", "EReject", "ECollect", "EOne", "EIsUnique"] as const) {
      expect(evalIn({ tag, e1: c, x: "x", e2: undefinedBody }, src)).toBeNull();
    }
    for (const tag of ["EForAll", "EExists", "EAny"] as const) {
      expect(evalIn({ tag, e1: c, x: "x", e2: undefinedBody }, src)).toBeNull();
    }
  });

  it("a non-Boolean iterator body makes a quantifier undefined", () => {
    const src = over([1, 2]);
    const numericBody: Expr = int(1);
    for (const tag of ["EForAll", "EExists", "EOne", "ESelect", "EReject", "EAny"] as const) {
      expect(evalIn({ tag, e1: c, x: "x", e2: numericBody }, src)).toBeNull();
    }
  });

  it("select keeps the matching elements and reject keeps the rest", () => {
    const select: Expr = { tag: "ESelect", e1: c, x: "x", e2: gt(2) };
    expect(evalIn(select, over([1, 2, 3, 4]))).toEqual(vcoll([vint(3), vint(4)]));

    const reject: Expr = { tag: "EReject", e1: c, x: "x", e2: bin("lt", variable("x"), int(3)) };
    expect(evalIn(reject, over([1, 2, 3, 4]))).toEqual(vcoll([vint(3), vint(4)]));
  });

  it("collect maps every element through its body", () => {
    const collect: Expr = {
      tag: "ECollect",
      e1: c,
      x: "x",
      e2: bin("mul", variable("x"), int(10)),
    };
    expect(evalIn(collect, over([1, 2]))).toEqual(vcoll([vint(10), vint(20)]));
  });

  it("one holds for exactly one match", () => {
    const one: Expr = { tag: "EOne", e1: c, x: "x", e2: gt(3) };
    expect(evalIn(one, over([1, 5, 2]))).toEqual(VTrue);
    expect(evalIn(one, over([1, 5, 9]))).toEqual(VFalse);
  });

  it("isUnique compares the keys the body produces", () => {
    const unique: Expr = {
      tag: "EIsUnique",
      e1: c,
      x: "x",
      e2: bin("mul", variable("x"), int(2)),
    };
    expect(evalIn(unique, over([1, 2, 3]))).toEqual(VTrue);
    expect(evalIn(unique, over([1, 2, 1]))).toEqual(VFalse);
  });

  it("any returns a witness, and is undefined when there is none", () => {
    const any = (limit: number): Expr => ({ tag: "EAny", e1: c, x: "x", e2: gt(limit) });
    expect(evalIn(any(3), over([1, 5, 2]))).toEqual(vint(5));
    expect(evalIn(any(100), over([1, 2]))).toBeNull();
  });

  it("size counts, sum totals, and the emptiness tests answer", () => {
    expect(evalIn({ tag: "ESize", e: c }, over([1, 2, 3]))).toEqual(vint(3));
    expect(evalIn({ tag: "ESum", e: c }, over([10, 20, 30]))).toEqual(vint(60));

    expect(evalIn({ tag: "EIsEmpty", e: c }, over([]))).toEqual(VTrue);
    expect(evalIn({ tag: "ENotEmpty", e: c }, over([]))).toEqual(VFalse);
    expect(evalIn({ tag: "EIsEmpty", e: c }, over([1]))).toEqual(VFalse);
    expect(evalIn({ tag: "ENotEmpty", e: c }, over([1]))).toEqual(VTrue);
  });

  it("sum is undefined over a non-integer element", () => {
    expect(evalIn({ tag: "ESum", e: c }, bound("c", vcoll([VTrue])))).toBeNull();
  });

  it("an undefined body makes a strict operator undefined", () => {
    const collect: Expr = { tag: "ECollect", e1: c, x: "x", e2: variable("nonexistent") };
    expect(evalIn(collect, over([1]))).toBeNull();
  });

  it("every collection operator is undefined over a non-collection", () => {
    const env = bound("c", vint(1));
    for (const tag of [
      "ESelect",
      "EReject",
      "ECollect",
      "EForAll",
      "EExists",
      "EOne",
      "EIsUnique",
      "EAny",
    ] as const) {
      expect(evalIn({ tag, e1: c, x: "x", e2: { tag: "ETrue" } }, env)).toBeNull();
    }
    for (const tag of ["ESize", "ESum", "EIsEmpty", "ENotEmpty"] as const) {
      expect(evalIn({ tag, e: c }, env)).toBeNull();
    }
  });

  it("every collection operator is undefined over an undefined source", () => {
    const missing = variable("unbound");
    for (const tag of [
      "ESelect",
      "EReject",
      "ECollect",
      "EForAll",
      "EExists",
      "EOne",
      "EIsUnique",
      "EAny",
    ] as const) {
      expect(evalIn({ tag, e1: missing, x: "x", e2: { tag: "ETrue" } })).toBeNull();
    }
    for (const tag of ["ESize", "ESum", "EIsEmpty", "ENotEmpty"] as const) {
      expect(evalIn({ tag, e: missing })).toBeNull();
    }
  });

  it("any is undefined when the body is undefined on an earlier element", () => {
    const body: Expr = {
      tag: "EIf",
      e1: bin("eq", variable("x"), int(1)),
      e2: variable("unbound"),
      e3: { tag: "ETrue" },
    };
    const any: Expr = { tag: "EAny", e1: c, x: "x", e2: body };
    expect(evalIn(any, over([1, 2]))).toBeNull();
  });
});

describe("type tests", () => {
  const person = bound("self", vobj(1, "Person"));

  it("answer for the object's own class", () => {
    expect(evalIn({ tag: "EKindOf", e: self, C: "Person" }, person)).toEqual(VTrue);
    expect(evalIn({ tag: "EKindOf", e: self, C: "Other" }, person)).toEqual(VFalse);
    expect(evalIn({ tag: "ETypeOf", e: self, C: "Person" }, person)).toEqual(VTrue);
    expect(evalIn({ tag: "ETypeOf", e: self, C: "Employee" }, person)).toEqual(VFalse);
  });

  it("are undefined on a receiver that is not an object", () => {
    const env = bound("c", vint(1));
    expect(evalIn({ tag: "EKindOf", e: variable("c"), C: "X" }, env)).toBeNull();
    expect(evalIn({ tag: "ETypeOf", e: variable("c"), C: "X" }, env)).toBeNull();
  });
});

describe("compiling an invariant to a signal", () => {
  function positiveField(field: string) {
    const s = new Store();
    s.register("C", 1, field, vint(42));
    const inv: Invariant = {
      context: "C",
      name: "positive",
      body: bin("gt", { tag: "ENav", e: self, f: field }, int(0)),
    };
    return { s, inv };
  }

  it("the signal reports whether the body holds", () => {
    const { s, inv } = positiveField("val");
    expect(compileInvariant(inv, s, 1).value).toBe(true);
  });

  it("an explicitly absent transaction behaves like none at all", () => {
    const { s, inv } = positiveField("f");
    expect(compileInvariant(inv, s, 1, null).value).toBe(true);
  });

  it("the signal follows later writes to the fields it reads", () => {
    const { s, inv } = positiveField("val");
    const holds = compileInvariant(inv, s, 1);
    expect(holds.value).toBe(true);

    s.write("C:1:val", vint(-1));
    expect(holds.value).toBe(false);

    s.write("C:1:val", vint(1));
    expect(holds.value).toBe(true);
  });
});

describe("undefined inputs", () => {
  it("negation is undefined when its operand is undefined", () => {
    expect(evalIn({ tag: "ENot", e: variable("unbound") })).toBeNull();
  });

  it("a conditional is undefined when its guard is undefined", () => {
    expect(evalIn({ tag: "EIf", e1: variable("unbound"), e2: int(1), e3: int(2) })).toBeNull();
  });

  it("navigation never touches the store for a receiver of the wrong kind", () => {
    const s = new Store();
    const spy = spyOn(s, "read");
    const env = bound("self", vint(1));
    expect(evalExpr({ tag: "ENav", e: self, f: "age" }, env, s, null)).toBeNull();
    expect(evalExpr({ tag: "EPre", e: self, f: "age" }, env, s, new Map())).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
