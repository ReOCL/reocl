import { describe, it, expect } from "bun:test";
import {
  TBool,
  TInt,
  TString,
  TObject,
  TCollection,
  typesEqual,
  typesCompatible,
  joinTypes,
  type OCLType,
  type MetaModel,
} from "@core/types";
import { typeOf, wellTypedInvariant } from "@core/compiler";
import type { Expr, Invariant } from "@core/types";

describe("typesEqual", () => {
  it("reflexive", () => {
    expect(typesEqual(TBool, TBool)).toBe(true);
    expect(typesEqual(TInt, TInt)).toBe(true);
    expect(typesEqual(TString, TString)).toBe(true);
    expect(typesEqual(TObject("C"), TObject("C"))).toBe(true);
    expect(typesEqual(TCollection(TInt), TCollection(TInt))).toBe(true);
  });

  it("different tags", () => {
    expect(typesEqual(TBool, TInt)).toBe(false);
  });

  it("different class names", () => {
    expect(typesEqual(TObject("A"), TObject("B"))).toBe(false);
  });

  it("nested collection", () => {
    expect(typesEqual(TCollection(TCollection(TInt)), TCollection(TCollection(TInt)))).toBe(true);
    expect(typesEqual(TCollection(TBool), TCollection(TInt))).toBe(false);
  });
});

describe("typesCompatible", () => {
  it("same type is compatible", () => {
    expect(typesCompatible(TBool, TBool)).toBe(true);
    expect(typesCompatible(TInt, TInt)).toBe(true);
  });
  it("different types are not compatible", () => {
    expect(typesCompatible(TBool, TInt)).toBe(false);
  });
});

describe("joinTypes", () => {
  it("returns type when equal", () => {
    expect(joinTypes(TBool, TBool)?.tag).toBe("TBool");
  });
  it("returns null when different", () => {
    expect(joinTypes(TBool, TInt)).toBeNull();
  });
});

const mm: MetaModel = {
  fieldType(C, f) {
    if (C === "Employee" && f === "salary") return TInt;
    if (C === "Employee" && f === "name") return TString;
    if (C === "Department" && f === "budget") return TInt;
    if (C === "Department" && f === "employees") return TCollection(TObject("Employee"));
    if (C === "Person" && f === "parent") return TObject("Person");
    return null;
  },
  extends(_sub, _sup) {
    return false;
  },
};

describe("typeOf", () => {
  it("literals", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "ETrue" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "EFalse" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "EIntLit", n: 1 }, mm)?.tag).toBe("TInt");
    expect(typeOf(env, { tag: "EStringLit", s: "hi" }, mm)?.tag).toBe("TString");
  });

  it("variables", () => {
    const env = new Map<string, OCLType>();
    env.set("x", TInt);
    expect(typeOf(env, { tag: "EVar", x: "x" }, mm)?.tag).toBe("TInt");
    expect(typeOf(env, { tag: "EVar", x: "y" }, mm)).toBeNull();
  });

  it("navigation returns field type", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Employee"));
    const nav: Expr = { tag: "ENav", e: { tag: "ESelf" }, f: "salary" };
    expect(typeOf(env, nav, mm)?.tag).toBe("TInt");
  });

  it("unknown field returns null", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Employee"));
    const nav: Expr = { tag: "ENav", e: { tag: "ESelf" }, f: "unknown" };
    expect(typeOf(env, nav, mm)).toBeNull();
  });

  it("binary ops", () => {
    const env = new Map<string, OCLType>();
    env.set("a", TInt);
    env.set("b", TInt);
    const add: Expr = {
      tag: "EBinOp",
      op: "add",
      e1: { tag: "EVar", x: "a" },
      e2: { tag: "EVar", x: "b" },
    };
    expect(typeOf(env, add, mm)?.tag).toBe("TInt");
    const lt: Expr = {
      tag: "EBinOp",
      op: "lt",
      e1: { tag: "EVar", x: "a" },
      e2: { tag: "EVar", x: "b" },
    };
    expect(typeOf(env, lt, mm)?.tag).toBe("TBool");
  });

  it("binary op with wrong types", () => {
    const env = new Map<string, OCLType>();
    env.set("a", TBool);
    env.set("b", TInt);
    const add: Expr = {
      tag: "EBinOp",
      op: "add",
      e1: { tag: "EVar", x: "a" },
      e2: { tag: "EVar", x: "b" },
    };
    expect(typeOf(env, add, mm)).toBeNull();
  });

  it("not", () => {
    const env = new Map<string, OCLType>();
    env.set("b", TBool);
    expect(typeOf(env, { tag: "ENot", e: { tag: "EVar", x: "b" } }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "ENot", e: { tag: "EIntLit", n: 1 } }, mm)).toBeNull();
  });

  it("if-then-else", () => {
    const env = new Map<string, OCLType>();
    const e: Expr = {
      tag: "EIf",
      e1: { tag: "ETrue" },
      e2: { tag: "EIntLit", n: 1 },
      e3: { tag: "EIntLit", n: 2 },
    };
    expect(typeOf(env, e, mm)?.tag).toBe("TInt");
  });

  it("if with mismatched branches", () => {
    const env = new Map<string, OCLType>();
    const e: Expr = {
      tag: "EIf",
      e1: { tag: "ETrue" },
      e2: { tag: "EIntLit", n: 1 },
      e3: { tag: "EFalse" },
    };
    expect(typeOf(env, e, mm)).toBeNull();
  });

  it("select over department employees", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const e: Expr = {
      tag: "ESelect",
      e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
      x: "e",
      e2: {
        tag: "EBinOp",
        op: "gt",
        e1: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
        e2: { tag: "EIntLit", n: 0 },
      },
    };
    const t = typeOf(env, e, mm);
    expect(t?.tag).toBe("TCollection");
    if (t && t.tag === "TCollection") {
      expect(t.t.tag).toBe("TObject");
    }
  });

  it("forAll over department employees", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const e: Expr = {
      tag: "EForAll",
      e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
      x: "e",
      e2: {
        tag: "EBinOp",
        op: "gt",
        e1: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
        e2: { tag: "EIntLit", n: 0 },
      },
    };
    expect(typeOf(env, e, mm)?.tag).toBe("TBool");
  });

  it("size of collection", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const e: Expr = { tag: "ESize", e: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" } };
    expect(typeOf(env, e, mm)?.tag).toBe("TInt");
  });

  it("ESum on TCollection(TInt)", () => {
    const env = new Map<string, OCLType>();
    env.set("c", TCollection(TInt));
    const e: Expr = { tag: "ESum", e: { tag: "EVar", x: "c" } };
    expect(typeOf(env, e, mm)?.tag).toBe("TInt");
  });

  it("ESum on non-collection returns null", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "ESum", e: { tag: "ETrue" } }, mm)).toBeNull();
  });

  it("ESum on non-int collection returns null", () => {
    const env = new Map<string, OCLType>();
    env.set("c", TCollection(TBool));
    expect(typeOf(env, { tag: "ESum", e: { tag: "EVar", x: "c" } }, mm)).toBeNull();
  });

  it("EIsEmpty / ENotEmpty", () => {
    const env = new Map<string, OCLType>();
    env.set("c", TCollection(TInt));
    expect(typeOf(env, { tag: "EIsEmpty", e: { tag: "EVar", x: "c" } }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "ENotEmpty", e: { tag: "EVar", x: "c" } }, mm)?.tag).toBe("TBool");
  });

  it("EIsEmpty on non-collection returns null", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "EIsEmpty", e: { tag: "ETrue" } }, mm)).toBeNull();
  });

  it("EKindOf / ETypeOf", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    expect(typeOf(env, { tag: "EKindOf", e: { tag: "ESelf" }, C: "X" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "ETypeOf", e: { tag: "ESelf" }, C: "X" }, mm)?.tag).toBe("TBool");
  });

  it("EKindOf on non-object returns null", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "EKindOf", e: { tag: "ETrue" }, C: "X" }, mm)).toBeNull();
  });

  it("EReject typing", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const e: Expr = {
      tag: "EReject",
      e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
      x: "e",
      e2: { tag: "ETrue" },
    };
    const t = typeOf(env, e, mm);
    expect(t?.tag).toBe("TCollection");
  });

  it("ECollect typing", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const e: Expr = {
      tag: "ECollect",
      e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
      x: "e",
      e2: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
    };
    const t = typeOf(env, e, mm);
    expect(t?.tag).toBe("TCollection");
  });

  it("EExists / EOne / EIsUnique / EAny typing", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Department"));
    const make = (tag: string): Expr => ({
      tag: tag as any,
      e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
      x: "e",
      e2: {
        tag: "EBinOp",
        op: "gt",
        e1: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
        e2: { tag: "EIntLit", n: 0 },
      },
    });
    expect(typeOf(env, make("EExists"), mm)?.tag).toBe("TBool");
    expect(typeOf(env, make("EOne"), mm)?.tag).toBe("TBool");
    expect(typeOf(env, make("EIsUnique"), mm)?.tag).toBe("TBool");
    expect(typeOf(env, make("EAny"), mm)?.tag).toBe("TObject");
  });

  it("ENav on non-object type returns null", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TInt);
    expect(typeOf(env, { tag: "ENav", e: { tag: "ESelf" }, f: "x" }, mm)).toBeNull();
  });

  it("ENav on object with missing field returns null", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Employee"));
    expect(typeOf(env, { tag: "ENav", e: { tag: "ESelf" }, f: "missing" }, mm)).toBeNull();
  });

  it("EPre typing mirrors ENav", () => {
    const env = new Map<string, OCLType>();
    env.set("self", TObject("Employee"));
    expect(typeOf(env, { tag: "EPre", e: { tag: "ESelf" }, f: "salary" }, mm)?.tag).toBe("TInt");
  });

  it("EPre on non-object returns null", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "EPre", e: { tag: "ETrue" }, f: "x" }, mm)).toBeNull();
  });

  it("EBinOp eq/neq typing", () => {
    const env = new Map<string, OCLType>();
    env.set("a", TInt);
    env.set("b", TInt);
    expect(
      typeOf(
        env,
        { tag: "EBinOp", op: "eq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      )?.tag,
    ).toBe("TBool");
    expect(
      typeOf(
        env,
        { tag: "EBinOp", op: "neq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      )?.tag,
    ).toBe("TBool");
  });

  it("EBinOp with mismatched types returns null (eq)", () => {
    const env = new Map<string, OCLType>();
    env.set("a", TInt);
    env.set("b", TBool);
    expect(
      typeOf(
        env,
        { tag: "EBinOp", op: "eq", e1: { tag: "EVar", x: "a" }, e2: { tag: "EVar", x: "b" } },
        mm,
      ),
    ).toBeNull();
  });
});

describe("wellTypedInvariant", () => {
  it("well-typed noUnpaid invariant", () => {
    const inv: Invariant = {
      context: "Department",
      name: "noUnpaid",
      body: {
        tag: "EForAll",
        e1: { tag: "ENav", e: { tag: "ESelf" }, f: "employees" },
        x: "e",
        e2: {
          tag: "EBinOp",
          op: "gt",
          e1: { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" },
          e2: { tag: "EIntLit", n: 0 },
        },
      },
    };
    expect(wellTypedInvariant(inv, mm)).toBe(true);
  });

  it("ill-typed invariant (non-Bool body)", () => {
    const inv: Invariant = {
      context: "Department",
      name: "bad",
      body: { tag: "EIntLit", n: 5 },
    };
    expect(wellTypedInvariant(inv, mm)).toBe(false);
  });
});
