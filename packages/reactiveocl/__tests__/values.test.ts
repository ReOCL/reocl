import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import {
  VTrue,
  VFalse,
  vint,
  vstring,
  vobj,
  vcoll,
  valuesEqual,
  boolVal,
  expectBool,
  isVTrue,
  isVFalse,
  isVInt,
  isVString,
  isVObj,
  isVColl,
  asVInt,
  asVString,
  asVObj,
  asVColl,
  oclNot,
  oclAdd,
  oclSub,
  oclMul,
  oclDiv,
  oclEq,
  oclNeq,
  oclLt,
  oclGt,
  oclLeq,
  oclGeq,
  type OCLVal,
} from "@core/values";

const arbVInt = fc.integer().map((n) => vint(n));
const arbVString = fc.string().map((s) => vstring(s));

function arbOCLVal(): fc.Arbitrary<OCLVal> {
  return fc.oneof(
    fc.constant(VTrue),
    fc.constant(VFalse),
    arbVInt,
    arbVString,
    fc.integer().chain((n) => fc.string().map((c) => vobj(n, c))),
    fc
      .array(fc.oneof(arbVInt, arbVString, fc.constant(VTrue), fc.constant(VFalse)))
      .map((vs) => vcoll(vs)),
  );
}

describe("OCLVal constructors and guards", () => {
  it("vint → isVInt → asVInt roundtrip", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const v = vint(n);
        expect(isVInt(v)).toBe(true);
        expect(asVInt(v)).toBe(n);
      }),
    );
  });

  it("vstring → isVString → asVString roundtrip", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const v = vstring(s);
        expect(isVString(v)).toBe(true);
        expect(asVString(v)).toBe(s);
      }),
    );
  });

  it("vobj → isVObj → asVObj roundtrip", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (oid, cid) => {
        const v = vobj(oid, cid);
        expect(isVObj(v)).toBe(true);
        const o = asVObj(v);
        expect(o!.oid).toBe(oid);
        expect(o!.classId).toBe(cid);
      }),
    );
  });

  it("VTrue / VFalse", () => {
    expect(isVTrue(VTrue)).toBe(true);
    expect(isVFalse(VFalse)).toBe(true);
    expect(isVTrue(VFalse)).toBe(false);
    expect(isVFalse(VTrue)).toBe(false);
    expect(expectBool(VTrue)).toBe(true);
    expect(expectBool(VFalse)).toBe(false);
    expect(expectBool(vint(1))).toBeNull();
  });

  it("vcoll → isVColl → asVColl roundtrip", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        const v = vcoll(vs);
        expect(isVColl(v)).toBe(true);
        const result = asVColl(v);
        expect(result!.length).toBe(vs.length);
      }),
    );
  });
});

describe("boolVal", () => {
  it("true → VTrue, false → VFalse", () => {
    expect(boolVal(true)).toBe(VTrue);
    expect(boolVal(false)).toBe(VFalse);
  });
});

describe("valuesEqual", () => {
  it("reflexive", () => {
    fc.assert(
      fc.property(arbOCLVal(), (v) => {
        expect(valuesEqual(v, v)).toBe(true);
      }),
    );
  });

  it("symmetric", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        expect(valuesEqual(a, b)).toBe(valuesEqual(b, a));
      }),
    );
  });

  it("vint equality matches number equality", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(valuesEqual(vint(n), vint(m))).toBe(n === m);
      }),
    );
  });

  it("different tags are never equal", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (n, s) => {
        expect(valuesEqual(vint(n), vstring(s))).toBe(false);
      }),
    );
  });

  it("vobj equality", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (oid, cid) => {
        expect(valuesEqual(vobj(oid, cid), vobj(oid, cid))).toBe(true);
        expect(valuesEqual(vobj(oid, cid), vobj(oid + 1, cid))).toBe(false);
      }),
    );
  });

  it("vcoll structural equality", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        // same values -> equal
        expect(valuesEqual(vcoll(vs), vcoll([...vs]))).toBe(true);
      }),
    );
  });

  it("vcoll different lengths → not equal", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        const longer = [...vs, vint(0)];
        expect(valuesEqual(vcoll(vs), vcoll(longer))).toBe(vs.length === longer.length);
      }),
    );
  });
});

describe("oclNot", () => {
  it("oclNot(VTrue) = VFalse", () => {
    expect(oclNot(VTrue)).toEqual(VFalse);
  });
  it("oclNot(VFalse) = VTrue", () => {
    expect(oclNot(VFalse)).toEqual(VTrue);
  });
  it("oclNot(non-bool) = null", () => {
    fc.assert(
      fc.property(arbVInt, (v) => {
        expect(oclNot(v)).toBeNull();
      }),
    );
  });
});

describe("oclAdd", () => {
  it("correct addition", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const result = oclAdd(vint(n), vint(m));
        expect(isVInt(result!)).toBe(true);
        expect(asVInt(result!)).toBe(n + m);
      }),
    );
  });
  it("non-int → null", () => {
    expect(oclAdd(VTrue, vint(1))).toBeNull();
    expect(oclAdd(vint(1), VTrue)).toBeNull();
  });
});

describe("oclSub", () => {
  it("correct subtraction", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const result = oclSub(vint(n), vint(m));
        expect(asVInt(result!)).toBe(n - m);
      }),
    );
  });
});

describe("oclMul", () => {
  it("correct multiplication", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const result = oclMul(vint(n), vint(m));
        expect(asVInt(result!)).toBe(n * m);
      }),
    );
  });
});

describe("oclDiv", () => {
  it("correct division", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1 }), (n, m) => {
        const result = oclDiv(vint(n), vint(m));
        expect(asVInt(result!)).toBe(Math.floor(n / m));
      }),
    );
  });
  it("rounds towards minus infinity, not towards zero", () => {
    expect(asVInt(oclDiv(vint(-1), vint(2))!)).toBe(-1);
    expect(asVInt(oclDiv(vint(-7), vint(2))!)).toBe(-4);
    expect(asVInt(oclDiv(vint(7), vint(2))!)).toBe(3);
  });
  it("division by zero → null", () => {
    expect(oclDiv(vint(5), vint(0))).toBeNull();
  });
});

describe("oclLt / oclGt / oclLeq / oclGeq", () => {
  it("oclLt matches <", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const r = oclLt(vint(n), vint(m));
        expect(r === VTrue).toBe(n < m);
        expect(r === VFalse).toBe(n >= m);
      }),
    );
  });
  it("oclLeq matches <=", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const r = oclLeq(vint(n), vint(m));
        expect(r === VTrue).toBe(n <= m);
      }),
    );
  });
  it("oclGt matches >", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const r = oclGt(vint(n), vint(m));
        expect(r === VTrue).toBe(n > m);
      }),
    );
  });
  it("oclGeq matches >=", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const r = oclGeq(vint(n), vint(m));
        expect(r === VTrue).toBe(n >= m);
      }),
    );
  });
});

describe("oclEq / oclNeq", () => {
  it("oclEq matches valuesEqual", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        expect(oclEq(a, b) === VTrue).toBe(valuesEqual(a, b));
        expect(oclEq(a, b) === VFalse).toBe(!valuesEqual(a, b));
      }),
    );
  });
  it("oclNeq is the negation of oclEq", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        const eq = oclEq(a, b);
        const neq = oclNeq(a, b);
        if (eq === VTrue) expect(neq).toEqual(VFalse);
        else expect(neq).toEqual(VTrue);
      }),
    );
  });
});
