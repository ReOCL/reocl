import { describe, expect, it } from "bun:test";
import {
  TBool,
  TInt,
  TString,
  TObject,
  TCollection,
  typesEqual,
  joinTypes,
  fieldStateId,
  type Expr,
  type Invariant,
  type MetaModel,
  type OCLType,
} from "@core/types";
import { typeOf, wellTypedInvariant } from "@core/compiler";

const mm: MetaModel = {
  fieldType(C, f) {
    if (C === "Employee" && f === "salary") return TInt;
    if (C === "Employee" && f === "name") return TString;
    if (C === "Department" && f === "budget") return TInt;
    if (C === "Department" && f === "employees") return TCollection(TObject("Employee"));
    if (C === "Department" && f === "head") return TObject("Employee");
    if (C === "Person" && f === "parent") return TObject("Person");
    return null;
  },
  extends(_sub, _sup) {
    return false;
  },
};

function contextOf(C: string): Map<string, OCLType> {
  return new Map([["self", TObject(C)]]);
}

const employees: Expr = { tag: "ENav", e: { tag: "ESelf" }, f: "employees" };
const salaryOfE: Expr = { tag: "ENav", e: { tag: "EVar", x: "e" }, f: "salary" };
const positiveSalary: Expr = {
  tag: "EBinOp",
  op: "gt",
  e1: salaryOfE,
  e2: { tag: "EIntLit", n: 0 },
};

describe("type equality", () => {
  it("a type equals itself, whatever its shape", () => {
    expect(typesEqual(TBool, TBool)).toBe(true);
    expect(typesEqual(TInt, TInt)).toBe(true);
    expect(typesEqual(TString, TString)).toBe(true);
    expect(typesEqual(TObject("C"), TObject("C"))).toBe(true);
    expect(typesEqual(TCollection(TInt), TCollection(TInt))).toBe(true);
  });

  it("types of different kinds, or over different classes, differ", () => {
    expect(typesEqual(TBool, TInt)).toBe(false);
    expect(typesEqual(TObject("A"), TObject("B"))).toBe(false);
  });

  it("collections are compared by their element type, to any depth", () => {
    expect(typesEqual(TCollection(TCollection(TInt)), TCollection(TCollection(TInt)))).toBe(true);
    expect(typesEqual(TCollection(TBool), TCollection(TInt))).toBe(false);
  });

  it("compatibility is equality: there is no subtyping in the core", () => {
    expect(typesEqual(TBool, TBool)).toBe(true);
    expect(typesEqual(TBool, TInt)).toBe(false);
  });

  it("two branches join only when they already agree", () => {
    expect(joinTypes(TBool, TBool)?.tag).toBe("TBool");
    expect(joinTypes(TBool, TInt)).toBeNull();
  });
});

describe("state identifiers", () => {
  it("a field cell is named by class, object and field", () => {
    expect(fieldStateId("Employee", 3, "salary")).toBe("Employee:3:salary");
  });
});

describe("typing literals and variables", () => {
  it("each literal has the type of its kind", () => {
    const env = new Map<string, OCLType>();
    expect(typeOf(env, { tag: "ETrue" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "EFalse" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "EIntLit", n: 1 }, mm)?.tag).toBe("TInt");
    expect(typeOf(env, { tag: "EStringLit", s: "hi" }, mm)?.tag).toBe("TString");
  });

  it("a bound variable has its bound type, an unbound one has none", () => {
    const env = new Map<string, OCLType>([["x", TInt]]);
    expect(typeOf(env, { tag: "EVar", x: "x" }, mm)?.tag).toBe("TInt");
    expect(typeOf(env, { tag: "EVar", x: "y" }, mm)).toBeNull();
  });
});

describe("typing navigation", () => {
  it("navigation takes the declared field type", () => {
    const env = contextOf("Employee");
    expect(typeOf(env, { tag: "ENav", e: { tag: "ESelf" }, f: "salary" }, mm)?.tag).toBe("TInt");
  });

  it("navigating an unknown field is untyped", () => {
    const env = contextOf("Employee");
    expect(typeOf(env, { tag: "ENav", e: { tag: "ESelf" }, f: "unknown" }, mm)).toBeNull();
  });

  it("navigating a non-object is untyped", () => {
    const env = new Map<string, OCLType>([["self", TInt]]);
    expect(typeOf(env, { tag: "ENav", e: { tag: "ESelf" }, f: "x" }, mm)).toBeNull();
  });

  it("pre-state navigation is typed exactly like ordinary navigation", () => {
    const env = contextOf("Employee");
    expect(typeOf(env, { tag: "EPre", e: { tag: "ESelf" }, f: "salary" }, mm)?.tag).toBe("TInt");
    expect(typeOf(env, { tag: "EPre", e: { tag: "ETrue" }, f: "x" }, mm)).toBeNull();
  });

  it("pre-state navigation follows a navigated receiver", () => {
    const env = contextOf("Department");
    const head: Expr = { tag: "ENav", e: { tag: "ESelf" }, f: "head" };
    expect(typeOf(env, { tag: "EPre", e: head, f: "salary" }, mm)?.tag).toBe("TInt");
  });
});

describe("typing operators", () => {
  const ints = new Map<string, OCLType>([
    ["a", TInt],
    ["b", TInt],
  ]);
  const a: Expr = { tag: "EVar", x: "a" };
  const b: Expr = { tag: "EVar", x: "b" };

  it("arithmetic over integers is an integer", () => {
    expect(typeOf(ints, { tag: "EBinOp", op: "add", e1: a, e2: b }, mm)?.tag).toBe("TInt");
  });

  it("comparison over integers is a Boolean", () => {
    expect(typeOf(ints, { tag: "EBinOp", op: "lt", e1: a, e2: b }, mm)?.tag).toBe("TBool");
  });

  it("every comparison and arithmetic operator is typed by its own case", () => {
    for (const op of ["lt", "gt", "leq", "geq"] as const) {
      expect(typeOf(ints, { tag: "EBinOp", op, e1: a, e2: b }, mm)?.tag).toBe("TBool");
    }
    for (const op of ["add", "sub", "mul", "div"] as const) {
      expect(typeOf(ints, { tag: "EBinOp", op, e1: a, e2: b }, mm)?.tag).toBe("TInt");
    }
  });

  it("a comparison over a non-integer operand is untyped", () => {
    const mixed = new Map<string, OCLType>([
      ["a", TInt],
      ["b", TBool],
    ]);
    for (const op of ["lt", "gt", "leq", "geq"] as const) {
      expect(typeOf(mixed, { tag: "EBinOp", op, e1: a, e2: b }, mm)).toBeNull();
    }
  });

  it("a connective over mixed Boolean and integer operands is untyped", () => {
    const mixed = new Map<string, OCLType>([
      ["a", TBool],
      ["b", TInt],
    ]);
    for (const op of ["and", "or", "implies", "xor"] as const) {
      expect(typeOf(mixed, { tag: "EBinOp", op, e1: a, e2: b }, mm)).toBeNull();
    }
  });

  it("equality over Booleans is a Boolean, over anything at all", () => {
    const bools = new Map<string, OCLType>([
      ["a", TBool],
      ["b", TBool],
    ]);
    for (const op of ["eq", "neq"] as const) {
      expect(typeOf(bools, { tag: "EBinOp", op, e1: a, e2: b }, mm)?.tag).toBe("TBool");
    }
  });

  it("the connectives take and return Booleans", () => {
    const bools = new Map<string, OCLType>([
      ["a", TBool],
      ["b", TBool],
    ]);
    for (const op of ["and", "or", "implies", "xor"] as const) {
      expect(typeOf(bools, { tag: "EBinOp", op, e1: a, e2: b }, mm)?.tag).toBe("TBool");
      expect(typeOf(ints, { tag: "EBinOp", op, e1: a, e2: b }, mm)).toBeNull();
    }
  });

  it("equality needs both sides at the same type", () => {
    const mixed = new Map<string, OCLType>([
      ["a", TInt],
      ["b", TBool],
    ]);
    for (const op of ["eq", "neq"] as const) {
      expect(typeOf(ints, { tag: "EBinOp", op, e1: a, e2: b }, mm)?.tag).toBe("TBool");
      expect(typeOf(mixed, { tag: "EBinOp", op, e1: a, e2: b }, mm)).toBeNull();
    }
  });

  it("arithmetic over a non-integer is untyped", () => {
    const mixed = new Map<string, OCLType>([
      ["a", TBool],
      ["b", TInt],
    ]);
    expect(typeOf(mixed, { tag: "EBinOp", op: "add", e1: a, e2: b }, mm)).toBeNull();
  });

  it("negation takes and returns a Boolean", () => {
    const env = new Map<string, OCLType>([["b", TBool]]);
    expect(typeOf(env, { tag: "ENot", e: { tag: "EVar", x: "b" } }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "ENot", e: { tag: "EIntLit", n: 1 } }, mm)).toBeNull();
  });

  it("a conditional takes the type both branches agree on", () => {
    const env = new Map<string, OCLType>();
    expect(
      typeOf(
        env,
        {
          tag: "EIf",
          e1: { tag: "ETrue" },
          e2: { tag: "EIntLit", n: 1 },
          e3: { tag: "EIntLit", n: 2 },
        },
        mm,
      )?.tag,
    ).toBe("TInt");
    expect(
      typeOf(
        env,
        { tag: "EIf", e1: { tag: "ETrue" }, e2: { tag: "EIntLit", n: 1 }, e3: { tag: "EFalse" } },
        mm,
      ),
    ).toBeNull();
  });
});

describe("typing collection operators", () => {
  const env = contextOf("Department");

  it("select and reject keep the source element type", () => {
    for (const tag of ["ESelect", "EReject"] as const) {
      const t = typeOf(env, { tag, e1: employees, x: "e", e2: positiveSalary }, mm);
      expect(t?.tag).toBe("TCollection");
      if (t?.tag === "TCollection") expect(t.t.tag).toBe("TObject");
    }
  });

  it("collect takes the type of its body", () => {
    const t = typeOf(env, { tag: "ECollect", e1: employees, x: "e", e2: salaryOfE }, mm);
    expect(t?.tag).toBe("TCollection");
    if (t?.tag === "TCollection") expect(t.t.tag).toBe("TInt");
  });

  it("the Boolean quantifiers are Booleans", () => {
    for (const tag of ["EForAll", "EExists", "EOne", "EIsUnique"] as const) {
      expect(typeOf(env, { tag, e1: employees, x: "e", e2: positiveSalary }, mm)?.tag).toBe(
        "TBool",
      );
    }
  });

  it("any returns an element of the source collection", () => {
    expect(typeOf(env, { tag: "EAny", e1: employees, x: "e", e2: positiveSalary }, mm)?.tag).toBe(
      "TObject",
    );
  });

  it("size is an integer and the emptiness tests are Booleans", () => {
    const ints = new Map<string, OCLType>([["c", TCollection(TInt)]]);
    const c: Expr = { tag: "EVar", x: "c" };
    expect(typeOf(env, { tag: "ESize", e: employees }, mm)?.tag).toBe("TInt");
    expect(typeOf(ints, { tag: "EIsEmpty", e: c }, mm)?.tag).toBe("TBool");
    expect(typeOf(ints, { tag: "ENotEmpty", e: c }, mm)?.tag).toBe("TBool");
  });

  it("sum needs a collection of integers", () => {
    const c: Expr = { tag: "EVar", x: "c" };
    expect(typeOf(new Map([["c", TCollection(TInt)]]), { tag: "ESum", e: c }, mm)?.tag).toBe(
      "TInt",
    );
    expect(typeOf(new Map([["c", TCollection(TBool)]]), { tag: "ESum", e: c }, mm)).toBeNull();
    expect(typeOf(new Map(), { tag: "ESum", e: { tag: "ETrue" } }, mm)).toBeNull();
  });

  it("a collection operator over a non-collection is untyped", () => {
    expect(typeOf(new Map(), { tag: "EIsEmpty", e: { tag: "ETrue" } }, mm)).toBeNull();
  });

  it("an iterator over a non-collection source is untyped, whatever its body", () => {
    const env = new Map<string, OCLType>([["c", TInt]]);
    const c: Expr = { tag: "EVar", x: "c" };
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
      expect(typeOf(env, { tag, e1: c, x: "e", e2: { tag: "ETrue" } }, mm)).toBeNull();
    }
  });

  it("size and the emptiness tests need a collection too", () => {
    const env = new Map<string, OCLType>([["c", TInt]]);
    const c: Expr = { tag: "EVar", x: "c" };
    expect(typeOf(env, { tag: "ESize", e: c }, mm)).toBeNull();
    expect(typeOf(env, { tag: "ENotEmpty", e: c }, mm)).toBeNull();
  });

  it("exists and one are untyped when their body is", () => {
    const untypedBody: Expr = { tag: "EVar", x: "unbound" };
    for (const tag of ["EExists", "EOne", "EIsUnique"] as const) {
      expect(typeOf(env, { tag, e1: employees, x: "e", e2: untypedBody }, mm)).toBeNull();
    }
  });

  it("one needs a Boolean body, where isUnique takes any key", () => {
    const numericBody: Expr = salaryOfE;
    expect(typeOf(env, { tag: "EOne", e1: employees, x: "e", e2: numericBody }, mm)).toBeNull();
    expect(typeOf(env, { tag: "EIsUnique", e1: employees, x: "e", e2: numericBody }, mm)?.tag).toBe(
      "TBool",
    );
  });

  it("a collection operator over an untyped source is untyped, not a crash", () => {
    const untyped: Expr = { tag: "EVar", x: "unbound" };
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
      expect(typeOf(new Map(), { tag, e1: untyped, x: "e", e2: { tag: "ETrue" } }, mm)).toBeNull();
    }
    for (const tag of ["ESize", "ESum", "EIsEmpty", "ENotEmpty"] as const) {
      expect(typeOf(new Map(), { tag, e: untyped }, mm)).toBeNull();
    }
  });

  it("an iterator body that is itself untyped makes the operator untyped", () => {
    const env = contextOf("Department");
    const untypedBody: Expr = { tag: "EVar", x: "unbound" };
    for (const tag of ["ESelect", "EReject", "ECollect", "EForAll", "EAny"] as const) {
      expect(typeOf(env, { tag, e1: employees, x: "e", e2: untypedBody }, mm)).toBeNull();
    }
  });
});

describe("typing the type tests", () => {
  it("a type test over an object is a Boolean", () => {
    const env = contextOf("Department");
    expect(typeOf(env, { tag: "EKindOf", e: { tag: "ESelf" }, C: "X" }, mm)?.tag).toBe("TBool");
    expect(typeOf(env, { tag: "ETypeOf", e: { tag: "ESelf" }, C: "X" }, mm)?.tag).toBe("TBool");
  });

  it("a type test over a non-object is untyped", () => {
    expect(typeOf(new Map(), { tag: "EKindOf", e: { tag: "ETrue" }, C: "X" }, mm)).toBeNull();
    expect(typeOf(new Map(), { tag: "ETypeOf", e: { tag: "ETrue" }, C: "X" }, mm)).toBeNull();
  });

  it("a type test over an untyped receiver is untyped, not a crash", () => {
    const untyped: Expr = { tag: "EVar", x: "unbound" };
    expect(typeOf(new Map(), { tag: "EKindOf", e: untyped, C: "X" }, mm)).toBeNull();
    expect(typeOf(new Map(), { tag: "ETypeOf", e: untyped, C: "X" }, mm)).toBeNull();
  });

  it("navigation from an untyped receiver is untyped, not a crash", () => {
    const untyped: Expr = { tag: "EVar", x: "unbound" };
    expect(typeOf(new Map(), { tag: "ENav", e: untyped, f: "salary" }, mm)).toBeNull();
    expect(typeOf(new Map(), { tag: "EPre", e: untyped, f: "salary" }, mm)).toBeNull();
  });

  it("the receiver guard holds even when the metamodel answers for unknown classes", () => {
    const lenient: MetaModel = {
      fieldType: () => TInt,
      extends: () => false,
    };
    expect(typeOf(new Map(), { tag: "ENav", e: { tag: "ETrue" }, f: "x" }, lenient)).toBeNull();
    expect(typeOf(new Map(), { tag: "EPre", e: { tag: "ETrue" }, f: "x" }, lenient)).toBeNull();
  });

  it("an operator over untyped operands is untyped, not a crash", () => {
    const untyped: Expr = { tag: "EVar", x: "unbound" };
    expect(typeOf(new Map(), { tag: "ENot", e: untyped }, mm)).toBeNull();
    expect(
      typeOf(new Map(), { tag: "EBinOp", op: "add", e1: untyped, e2: untyped }, mm),
    ).toBeNull();
    expect(
      typeOf(
        new Map(),
        { tag: "EIf", e1: untyped, e2: { tag: "ETrue" }, e3: { tag: "ETrue" } },
        mm,
      ),
    ).toBeNull();
    expect(
      typeOf(
        new Map(),
        { tag: "EIf", e1: { tag: "ETrue" }, e2: untyped, e3: { tag: "ETrue" } },
        mm,
      ),
    ).toBeNull();
  });

  it("an operator with one untyped operand is untyped, not a crash", () => {
    const untyped: Expr = { tag: "EVar", x: "unbound" };
    for (const op of ["add", "eq", "lt", "and"] as const) {
      expect(
        typeOf(new Map(), { tag: "EBinOp", op, e1: untyped, e2: { tag: "EIntLit", n: 1 } }, mm),
      ).toBeNull();
      expect(
        typeOf(new Map(), { tag: "EBinOp", op, e1: { tag: "EIntLit", n: 1 }, e2: untyped }, mm),
      ).toBeNull();
    }
  });
});

describe("well-typed invariants", () => {
  it("an invariant with a Boolean body is well typed", () => {
    const inv: Invariant = {
      context: "Department",
      name: "noUnpaid",
      body: { tag: "EForAll", e1: employees, x: "e", e2: positiveSalary },
    };
    expect(wellTypedInvariant(inv, mm)).toBe(true);
  });

  it("an invariant whose body is not Boolean is rejected", () => {
    const inv: Invariant = {
      context: "Department",
      name: "bad",
      body: { tag: "EIntLit", n: 5 },
    };
    expect(wellTypedInvariant(inv, mm)).toBe(false);
  });

  it("an invariant whose body is ill typed is rejected, not a crash", () => {
    const inv: Invariant = {
      context: "Department",
      name: "illTyped",
      body: { tag: "EVar", x: "unbound" },
    };
    expect(wellTypedInvariant(inv, mm)).toBe(false);
  });
});
