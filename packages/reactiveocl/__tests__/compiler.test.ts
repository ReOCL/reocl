import { describe, expect, it } from "bun:test";
import { compileInvariant, evalExpr, typeOf } from "@core/compiler";
import { Store } from "@core/store";
import {
  TBool,
  TCollection,
  TInt,
  TObject,
  TString,
  type Expr,
  type Invariant,
  type MetaModel,
} from "@core/types";
import { vcoll, VFalse, vint, vobj, vstring, VTrue } from "@core/values";

const mm: MetaModel = {
  fieldType(C, f) {
    if (C === "Person" && f === "name") return TString;
    if (C === "Person" && f === "age") return TInt;
    if (C === "Department" && f === "employees") return TCollection(TObject("Employee"));
    if (C === "Employee" && f === "salary") return TInt;
    if (C === "X" && f === "a") return TInt;
    return null;
  },
  extends(_sub, _sup) {
    return false;
  },
};

const store = new Store();
store.register("Person", 1, "name", vstring("Alice"));
store.register("Person", 1, "age", vint(30));

describe("evalExpr", () => {
  const env = new Map();

  it("literals", () => {
    expect(evalExpr({ tag: "ETrue" }, env, store, null)).toEqual(VTrue);
    expect(evalExpr({ tag: "EFalse" }, env, store, null)).toEqual(VFalse);
    expect(evalExpr({ tag: "EIntLit", n: 42 }, env, store, null)).toEqual(vint(42));
    expect(evalExpr({ tag: "EStringLit", s: "hi" }, env, store, null)).toEqual(vstring("hi"));
  });

  it("variable lookup", () => {
    const e = new Map();
    e.set("x", vint(7));
    expect(evalExpr({ tag: "EVar", x: "x" }, e, store, null)).toEqual(vint(7));
    expect(evalExpr({ tag: "EVar", x: "y" }, e, store, null)).toBeNull();
  });

  it("ESelf reads from env / null when missing", () => {
    const e = new Map();
    e.set("self", vint(42));
    expect(evalExpr({ tag: "ESelf" }, e, store, null)).toEqual(vint(42));
    expect(evalExpr({ tag: "ESelf" }, new Map(), store, null)).toBeNull();
  });

  it("navigation reads store", () => {
    const e = new Map();
    e.set("self", vobj(1, "Person"));
    expect(evalExpr({ tag: "ENav", e: { tag: "ESelf" }, f: "name" }, e, store, null)).toEqual(
      vstring("Alice"),
    );
  });

  it("ENav on non-object returns null", () => {
    const e = new Map();
    e.set("self", vint(1));
    expect(evalExpr({ tag: "ENav", e: { tag: "ESelf" }, f: "age" }, e, store, null)).toBeNull();
  });

  it("ENav with non-existent field returns null", () => {
    const e = new Map();
    e.set("self", vobj(1, "Person"));
    expect(
      evalExpr({ tag: "ENav", e: { tag: "ESelf" }, f: "nonexistent" }, e, store, null),
    ).toBeNull();
  });

  it("EPre reads value", () => {
    const heap = new Map<string, any>();
    heap.set("Person:1:age", vint(25));
    const e = new Map();
    e.set("self", vobj(1, "Person"));
    expect(
      evalExpr({ tag: "EPre", e: { tag: "EVar", x: "self" }, f: "age" }, e, store, heap),
    ).toEqual(vint(25));
  });

  it("EPre with null heap returns null", () => {
    const e = new Map();
    e.set("self", vobj(1, "Person"));
    expect(
      evalExpr({ tag: "EPre", e: { tag: "EVar", x: "self" }, f: "age" }, e, store, null),
    ).toBeNull();
  });

  it("arithmetic", () => {
    const add: Expr = {
      tag: "EBinOp",
      op: "add",
      e1: { tag: "EIntLit", n: 3 },
      e2: { tag: "EIntLit", n: 4 },
    };
    expect(evalExpr(add, env, store, null)).toEqual(vint(7));
  });

  it("sub / mul / div", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "sub", e1: { tag: "EIntLit", n: 10 }, e2: { tag: "EIntLit", n: 3 } },
        env,
        store,
        null,
      ),
    ).toEqual(vint(7));
    expect(
      evalExpr(
        { tag: "EBinOp", op: "mul", e1: { tag: "EIntLit", n: 4 }, e2: { tag: "EIntLit", n: 5 } },
        env,
        store,
        null,
      ),
    ).toEqual(vint(20));
    expect(
      evalExpr(
        { tag: "EBinOp", op: "div", e1: { tag: "EIntLit", n: 10 }, e2: { tag: "EIntLit", n: 3 } },
        env,
        store,
        null,
      ),
    ).toEqual(vint(3));
  });

  it("eq / neq", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "eq", e1: { tag: "EIntLit", n: 5 }, e2: { tag: "EIntLit", n: 5 } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "neq", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "EIntLit", n: 2 } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
  });

  it("lt / gt / leq / geq", () => {
    const e = new Map();
    expect(
      evalExpr(
        { tag: "EBinOp", op: "lt", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "EIntLit", n: 2 } },
        e,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "gt", e1: { tag: "EIntLit", n: 3 }, e2: { tag: "EIntLit", n: 2 } },
        e,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "leq", e1: { tag: "EIntLit", n: 2 }, e2: { tag: "EIntLit", n: 2 } },
        e,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "geq", e1: { tag: "EIntLit", n: 2 }, e2: { tag: "EIntLit", n: 2 } },
        e,
        store,
        null,
      ),
    ).toEqual(VTrue);
  });

  it("xor / implies", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "xor", e1: { tag: "ETrue" }, e2: { tag: "EFalse" } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "implies", e1: { tag: "ETrue" }, e2: { tag: "EFalse" } },
        env,
        store,
        null,
      ),
    ).toEqual(VFalse);
  });

  it("and short-circuits on false", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "and", e1: { tag: "EFalse" }, e2: { tag: "EIntLit", n: 0 } },
        env,
        store,
        null,
      ),
    ).toEqual(VFalse);
  });

  it("and with both bools", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "and", e1: { tag: "ETrue" }, e2: { tag: "ETrue" } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "and", e1: { tag: "ETrue" }, e2: { tag: "EFalse" } },
        env,
        store,
        null,
      ),
    ).toEqual(VFalse);
  });

  it("and with non-bool returns null", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "and", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "ETrue" } },
        env,
        store,
        null,
      ),
    ).toBeNull();
    expect(
      evalExpr(
        { tag: "EBinOp", op: "and", e1: { tag: "ETrue" }, e2: { tag: "EIntLit", n: 1 } },
        env,
        store,
        null,
      ),
    ).toBeNull();
  });

  it("or short-circuits on true", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "or", e1: { tag: "ETrue" }, e2: { tag: "EIntLit", n: 0 } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
  });

  it("or both bools", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "or", e1: { tag: "EFalse" }, e2: { tag: "ETrue" } },
        env,
        store,
        null,
      ),
    ).toEqual(VTrue);
    expect(
      evalExpr(
        { tag: "EBinOp", op: "or", e1: { tag: "EFalse" }, e2: { tag: "EFalse" } },
        env,
        store,
        null,
      ),
    ).toEqual(VFalse);
  });

  it("or with non-bool returns null", () => {
    expect(
      evalExpr(
        { tag: "EBinOp", op: "or", e1: { tag: "EIntLit", n: 1 }, e2: { tag: "ETrue" } },
        env,
        store,
        null,
      ),
    ).toBeNull();
  });

  it("binop with null operands returns null", () => {
    expect(
      evalExpr(
        {
          tag: "EBinOp",
          op: "add",
          e1: { tag: "EVar", x: "missing" },
          e2: { tag: "EIntLit", n: 1 },
        },
        env,
        store,
        null,
      ),
    ).toBeNull();
  });

  it("not", () => {
    expect(evalExpr({ tag: "ENot", e: { tag: "ETrue" } }, env, store, null)).toEqual(VFalse);
    expect(evalExpr({ tag: "ENot", e: { tag: "EFalse" } }, env, store, null)).toEqual(VTrue);
    expect(evalExpr({ tag: "ENot", e: { tag: "EIntLit", n: 1 } }, env, store, null)).toBeNull();
  });

  it("if-then-else", () => {
    const e: Expr = {
      tag: "EIf",
      e1: { tag: "ETrue" },
      e2: { tag: "EIntLit", n: 1 },
      e3: { tag: "EIntLit", n: 2 },
    };
    expect(evalExpr(e, env, store, null)).toEqual(vint(1));
    const e2: Expr = {
      tag: "EIf",
      e1: { tag: "EFalse" },
      e2: { tag: "EIntLit", n: 1 },
      e3: { tag: "EIntLit", n: 2 },
    };
    expect(evalExpr(e2, env, store, null)).toEqual(vint(2));
  });

  it("EIf with non-bool guard returns null", () => {
    const e: Expr = {
      tag: "EIf",
      e1: { tag: "EIntLit", n: 1 },
      e2: { tag: "ETrue" },
      e3: { tag: "EFalse" },
    };
    expect(evalExpr(e, env, store, null)).toBeNull();
  });

  it("forAll / exists on int collection", () => {
    const e = new Map();
    e.set("self", vcoll([vint(1), vint(2), vint(3)]));
    const fa: Expr = {
      tag: "EForAll",
      e1: { tag: "ESelf" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 0 } },
    };
    expect(evalExpr(fa, e, store, null)).toEqual(VTrue);
    const ex: Expr = {
      tag: "EExists",
      e1: { tag: "ESelf" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 0 } },
    };
    e.set("self", vcoll([vint(0), vint(0), vint(5)]));
    expect(evalExpr(ex, e, store, null)).toEqual(VTrue);
  });

  it("select / reject filters", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(2), vint(3), vint(4)]));
    const sel: Expr = {
      tag: "ESelect",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 2 } },
    };
    const r = evalExpr(sel, e, store, null);
    expect(r?.tag).toBe("VColl");
    if (r && r.tag === "VColl") expect(r.vs.length).toBe(2);
    const rej: Expr = {
      tag: "EReject",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "lt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 3 } },
    };
    const r2 = evalExpr(rej, e, store, null);
    expect(r2?.tag).toBe("VColl");
    if (r2 && r2.tag === "VColl") expect(r2.vs.length).toBe(2);
  });

  it("collect", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(2)]));
    const c: Expr = {
      tag: "ECollect",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "mul", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 10 } },
    };
    expect(evalExpr(c, e, store, null)).toEqual(vcoll([vint(10), vint(20)]));
  });

  it("one / isUnique / any", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(5), vint(2)]));
    const one: Expr = {
      tag: "EOne",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 3 } },
    };
    expect(evalExpr(one, e, store, null)).toEqual(VTrue);
    const anyE: Expr = {
      tag: "EAny",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 3 } },
    };
    expect(evalExpr(anyE, e, store, null)).toEqual(vint(5));
  });

  it("any returns null when none match", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(2)]));
    const a: Expr = {
      tag: "EAny",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "gt", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 100 } },
    };
    expect(evalExpr(a, e, store, null)).toBeNull();
  });

  it("size / sum / isEmpty / notEmpty", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(2), vint(3)]));
    expect(evalExpr({ tag: "ESize", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(vint(3));
    e.set("c", vcoll([vint(10), vint(20), vint(30)]));
    expect(evalExpr({ tag: "ESum", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(vint(60));
    e.set("c", vcoll([]));
    expect(evalExpr({ tag: "EIsEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(
      VTrue,
    );
    expect(evalExpr({ tag: "ENotEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(
      VFalse,
    );
    e.set("c", vcoll([vint(1)]));
    expect(evalExpr({ tag: "EIsEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(
      VFalse,
    );
    expect(evalExpr({ tag: "ENotEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toEqual(
      VTrue,
    );
  });

  it("EKindOf / ETypeOf", () => {
    const e = new Map();
    e.set("self", vobj(1, "Person"));
    expect(evalExpr({ tag: "EKindOf", e: { tag: "ESelf" }, C: "Person" }, e, store, null)).toEqual(
      VTrue,
    );
    expect(evalExpr({ tag: "EKindOf", e: { tag: "ESelf" }, C: "Other" }, e, store, null)).toEqual(
      VFalse,
    );
    expect(evalExpr({ tag: "ETypeOf", e: { tag: "ESelf" }, C: "Person" }, e, store, null)).toEqual(
      VTrue,
    );
    expect(
      evalExpr({ tag: "ETypeOf", e: { tag: "ESelf" }, C: "Employee" }, e, store, null),
    ).toEqual(VFalse);
  });

  it("EIsUnique returns VTrue on unique collection", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1), vint(2), vint(3)]));
    const expr: Expr = {
      tag: "EIsUnique",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EBinOp", op: "mul", e1: { tag: "EVar", x: "x" }, e2: { tag: "EIntLit", n: 2 } },
    };
    expect(evalExpr(expr, e, store, null)).toEqual(VTrue);
  });

  it("collection operators on non-collection return null", () => {
    const e = new Map();
    e.set("c", vint(1));
    const ops = [
      "ESelect",
      "EReject",
      "ECollect",
      "EForAll",
      "EExists",
      "EOne",
      "EIsUnique",
      "EAny",
    ];
    for (const op of ops) {
      const expr: Expr = {
        tag: op as any,
        e1: { tag: "EVar", x: "c" },
        x: "x",
        e2: { tag: "ETrue" },
      };
      expect(evalExpr(expr, e, store, null)).toBeNull();
    }
    expect(evalExpr({ tag: "ESize", e: { tag: "EVar", x: "c" } }, e, store, null)).toBeNull();
    expect(evalExpr({ tag: "ESum", e: { tag: "EVar", x: "c" } }, e, store, null)).toBeNull();
    expect(evalExpr({ tag: "EIsEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toBeNull();
    expect(evalExpr({ tag: "ENotEmpty", e: { tag: "EVar", x: "c" } }, e, store, null)).toBeNull();
    expect(
      evalExpr({ tag: "EKindOf", e: { tag: "EVar", x: "c" }, C: "X" }, e, store, null),
    ).toBeNull();
    expect(
      evalExpr({ tag: "ETypeOf", e: { tag: "EVar", x: "c" }, C: "X" }, e, store, null),
    ).toBeNull();
  });

  it("ESum on non-int collection fails", () => {
    const e = new Map();
    e.set("c", vcoll([VTrue]));
    expect(evalExpr({ tag: "ESum", e: { tag: "EVar", x: "c" } }, e, store, null)).toBeNull();
  });

  it("collect with null predicate returns null", () => {
    const e = new Map();
    e.set("c", vcoll([vint(1)]));
    const c: Expr = {
      tag: "ECollect",
      e1: { tag: "EVar", x: "c" },
      x: "x",
      e2: { tag: "EVar", x: "nonexistent" },
    };
    expect(evalExpr(c, e, store, null)).toBeNull();
  });
});

describe("typeOf", () => {
  it("boolean binary ops", () => {
    const e = new Map<string, any>();
    e.set("a", TBool);
    e.set("b", TBool);
    const ops = ["and", "or", "implies", "xor"];
    for (const op of ops) {
      const expr: Expr = {
        tag: "EBinOp",
        op: op as any,
        e1: { tag: "EVar", x: "a" },
        e2: { tag: "EVar", x: "b" },
      };
      expect(typeOf(e, expr, mm)?.tag).toBe("TBool");
    }
  });

  it("EBinOp eq/neq", () => {
    const e = new Map<string, any>();
    e.set("a", TInt);
    e.set("b", TInt);
    expect(
      typeOf(
        e,
        { tag: "EBinOp", op: "eq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      )?.tag,
    ).toBe("TBool");
    expect(
      typeOf(
        e,
        { tag: "EBinOp", op: "neq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      )?.tag,
    ).toBe("TBool");
  });

  it("EBinOp with mismatched types returns null", () => {
    const e = new Map<string, any>();
    e.set("a", TInt);
    e.set("b", TBool);
    expect(
      typeOf(
        e,
        { tag: "EBinOp", op: "eq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      ),
    ).toBeNull();
  });

  it("EPre / EReject / ECollect / EExists / EOne / EIsUnique / EAny / EIsEmpty / ENotEmpty / EKindOf / ETypeOf", () => {
    const e = new Map<string, any>();
    e.set("self", TObject("Department"));
    expect(
      typeOf(
        e,
        {
          tag: "EReject",
          e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
          x: "e",
          e2: { tag: "ETrue" },
        },
        mm,
      )?.tag,
    ).toBe("TCollection");
    expect(
      typeOf(
        e,
        {
          tag: "ECollect",
          e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
          x: "e",
          e2: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
        },
        mm,
      )?.tag,
    ).toBe("TCollection");
    expect(
      typeOf(e, { tag: "EPre", e: { tag: "ESelf" }, f: "salary" }, {
        ...mm,
        fieldType(C: string, _f: string) {
          return C === "Department" ? TObject("Employee") : TInt;
        },
        extends() {
          return false;
        },
      } as any)?.tag,
    ).not.toBeNull();
  });
});

describe("compileInvariant", () => {
  it("returns computed signal that evaluates invariant", () => {
    const s = new Store();
    s.register("X", 1, "val", vint(42));
    const inv: Invariant = {
      context: "X",
      name: "pos",
      body: {
        tag: "EBinOp" as const,
        op: "gt" as const,
        e1: { tag: "ENav" as const, e: { tag: "ESelf" as const }, f: "val" },
        e2: { tag: "EIntLit" as const, n: 0 },
      },
    };
    const sig = compileInvariant(inv, s, 1);
    expect(sig.value).toBe(true);
  });

  it("with null tx evaluates correctly", () => {
    const s = new Store();
    s.register("C", 1, "f", vint(42));
    const inv: Invariant = {
      context: "C",
      name: "test",
      body: {
        tag: "EBinOp" as const,
        op: "gt" as const,
        e1: { tag: "ENav" as const, e: { tag: "ESelf" as const }, f: "f" },
        e2: { tag: "EIntLit" as const, n: 0 },
      },
    };
    const sig = compileInvariant(inv, s, 1, null);
    expect(sig.value).toBe(true);
  });
});
