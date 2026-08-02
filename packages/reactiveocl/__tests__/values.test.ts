import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  VTrue,
  VFalse,
  vint,
  vstring,
  vobj,
  vcoll,
  valuesEqual,
  valKey,
  boolVal,
  isVTrue,
  isVFalse,
  isVInt,
  isVString,
  isVObj,
  isVColl,
  oclNot,
  oclXor,
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

describe("values are recognised by their guards", () => {
  it("an integer is recognised and carries its number", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const v = vint(n);
        expect(isVInt(v)).toBe(true);
        expect(isVInt(v) ? v.n : null).toBe(n);
      }),
    );
  });

  it("a string is recognised and carries its text", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const v = vstring(s);
        expect(isVString(v)).toBe(true);
        expect(isVString(v) ? v.s : null).toBe(s);
      }),
    );
  });

  it("an object is recognised and carries its identity", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (oid, cid) => {
        const v = vobj(oid, cid);
        expect(isVObj(v)).toBe(true);
        expect(isVObj(v) ? v.oid : null).toBe(oid);
        expect(isVObj(v) ? v.classId : null).toBe(cid);
      }),
    );
  });

  it("a collection is recognised and carries its elements", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        const v = vcoll(vs);
        expect(isVColl(v)).toBe(true);
        expect(isVColl(v) ? v.vs.length : null).toBe(vs.length);
      }),
    );
  });

  it("only the Boolean values are Boolean", () => {
    expect(isVTrue(VTrue)).toBe(true);
    expect(isVFalse(VFalse)).toBe(true);
    expect(isVTrue(VFalse)).toBe(false);
    expect(isVFalse(VTrue)).toBe(false);
  });

  it("only an object carries an object identity", () => {
    expect(isVObj(vobj(7, "C"))).toBe(true);
    expect(isVObj(vint(7))).toBe(false);
  });

  it("a mathematical Boolean maps onto the Boolean values", () => {
    expect(boolVal(true)).toBe(VTrue);
    expect(boolVal(false)).toBe(VFalse);
  });

  it("each guard recognises only its own kind of value", () => {
    const guards: [(v: OCLVal) => boolean, OCLVal][] = [
      [isVInt, vint(1)],
      [isVString, vstring("s")],
      [isVObj, vobj(1, "C")],
      [isVColl, vcoll([])],
    ];
    const all: OCLVal[] = [VTrue, VFalse, vint(1), vstring("s"), vobj(1, "C"), vcoll([])];

    for (const [guard, match] of guards) {
      for (const v of all) {
        expect(guard(v)).toBe(v.tag === match.tag);
      }
    }
  });
});

describe("structural equality", () => {
  it("every value equals itself", () => {
    fc.assert(
      fc.property(arbOCLVal(), (v) => {
        expect(valuesEqual(v, v)).toBe(true);
      }),
    );
  });

  it("equality does not depend on the order of the operands", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        expect(valuesEqual(a, b)).toBe(valuesEqual(b, a));
      }),
    );
  });

  it("integers are equal exactly when their numbers are", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(valuesEqual(vint(n), vint(m))).toBe(n === m);
      }),
    );
  });

  it("values of different kinds are never equal", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (n, s) => {
        expect(valuesEqual(vint(n), vstring(s))).toBe(false);
      }),
    );
  });

  it("objects are equal exactly when class and identifier agree", () => {
    fc.assert(
      fc.property(fc.integer(), fc.string(), (oid, cid) => {
        expect(valuesEqual(vobj(oid, cid), vobj(oid, cid))).toBe(true);
        expect(valuesEqual(vobj(oid, cid), vobj(oid + 1, cid))).toBe(false);
      }),
    );
  });

  it("collections are compared element by element", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        expect(valuesEqual(vcoll(vs), vcoll([...vs]))).toBe(true);
      }),
    );
  });

  it("collections of different lengths are never equal", () => {
    fc.assert(
      fc.property(fc.array(arbVInt), (vs) => {
        expect(valuesEqual(vcoll(vs), vcoll([...vs, vint(0)]))).toBe(false);
      }),
    );
  });

  it("collections of equal length differ when any element differs", () => {
    expect(valuesEqual(vcoll([vint(1), vint(2)]), vcoll([vint(1), vint(3)]))).toBe(false);
    expect(valuesEqual(vcoll([vint(1), vint(2)]), vcoll([vint(9), vint(2)]))).toBe(false);
    expect(valuesEqual(vcoll([vint(1), vint(2)]), vcoll([vint(1), vint(2)]))).toBe(true);
  });

  it("the Boolean values are equal to themselves and to nothing else", () => {
    expect(valuesEqual(VTrue, VTrue)).toBe(true);
    expect(valuesEqual(VFalse, VFalse)).toBe(true);
    expect(valuesEqual(VTrue, VFalse)).toBe(false);
    expect(valuesEqual(VFalse, VTrue)).toBe(false);
  });
});

describe("structural keys", () => {
  it("every kind of value gets its own non-empty key", () => {
    const keys = [
      valKey(VTrue),
      valKey(VFalse),
      valKey(vint(1)),
      valKey(vstring("1")),
      valKey(vobj(1, "C")),
      valKey(vcoll([vint(1)])),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.length).toBeGreaterThan(0);
  });

  it("keys agree with structural equality", () => {
    expect(valKey(vobj(1, "C"))).toBe(valKey(vobj(1, "C")));
    expect(valKey(vcoll([vstring("a"), vstring("b")]))).not.toBe(valKey(vcoll([vstring("a,b")])));
  });

  it("equal values share a key, and distinct ones do not", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        expect(valKey(a) === valKey(b)).toBe(valuesEqual(a, b));
      }),
    );
  });
});

describe("negation", () => {
  it("inverts a Boolean", () => {
    expect(oclNot(VTrue)).toEqual(VFalse);
    expect(oclNot(VFalse)).toEqual(VTrue);
  });

  it("is undefined on anything else", () => {
    fc.assert(
      fc.property(arbVInt, (v) => {
        expect(oclNot(v)).toBeNull();
      }),
    );
  });
});

describe("arithmetic", () => {
  it("addition matches integer addition", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclAdd(vint(n), vint(m))).toEqual(vint(n + m));
      }),
    );
  });

  it("subtraction matches integer subtraction", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclSub(vint(n), vint(m))).toEqual(vint(n - m));
      }),
    );
  });

  it("multiplication matches integer multiplication", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclMul(vint(n), vint(m))).toEqual(vint(n * m));
      }),
    );
  });

  it("division truncates toward zero, as integer division", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer().filter((m) => m !== 0),
        (n, m) => {
          expect(oclDiv(vint(n), vint(m))).toEqual(vint(Math.trunc(n / m)));
        },
      ),
    );
  });

  it("division by zero is undefined", () => {
    expect(oclDiv(vint(5), vint(0))).toBeNull();
  });

  it("is undefined unless both operands are integers", () => {
    expect(oclAdd(VTrue, vint(1))).toBeNull();
    expect(oclAdd(vint(1), VTrue)).toBeNull();
  });
});

describe("every partial operator guards both of its operands", () => {
  const nonInteger = [VTrue, VFalse, vstring("1"), vobj(1, "C"), vcoll([vint(1)])];
  const nonBoolean = [vint(1), vstring("true"), vobj(1, "C"), vcoll([VTrue])];

  const integerOps = { oclAdd, oclSub, oclMul, oclDiv, oclLt, oclGt, oclLeq, oclGeq };
  const booleanOps = { oclXor };

  for (const [name, op] of Object.entries(integerOps)) {
    it(`${name} is undefined when either operand is not an integer`, () => {
      for (const bad of nonInteger) {
        expect(op(bad, vint(1))).toBeNull();
        expect(op(vint(1), bad)).toBeNull();
        expect(op(bad, bad)).toBeNull();
      }
      expect(op(vint(4), vint(2))).not.toBeNull();
    });
  }

  for (const [name, op] of Object.entries(booleanOps)) {
    it(`${name} is undefined when either operand is not Boolean`, () => {
      for (const bad of nonBoolean) {
        expect(op(bad, VTrue)).toBeNull();
        expect(op(VTrue, bad)).toBeNull();
        expect(op(bad, bad)).toBeNull();
      }
      expect(op(VTrue, VFalse)).not.toBeNull();
    });
  }

  it("negation is undefined on every non-Boolean value", () => {
    for (const bad of nonBoolean) {
      expect(oclNot(bad)).toBeNull();
    }
  });
});

describe("comparisons", () => {
  it("less-than matches <, and is false exactly when >= holds", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        const r = oclLt(vint(n), vint(m));
        expect(r === VTrue).toBe(n < m);
        expect(r === VFalse).toBe(n >= m);
      }),
    );
  });

  it("less-or-equal matches <=", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclLeq(vint(n), vint(m)) === VTrue).toBe(n <= m);
      }),
    );
  });

  it("greater-than matches >", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclGt(vint(n), vint(m)) === VTrue).toBe(n > m);
      }),
    );
  });

  it("greater-or-equal matches >=", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (n, m) => {
        expect(oclGeq(vint(n), vint(m)) === VTrue).toBe(n >= m);
      }),
    );
  });
});

describe("equality operators", () => {
  it("equality agrees with structural equality", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        expect(oclEq(a, b) === VTrue).toBe(valuesEqual(a, b));
        expect(oclEq(a, b) === VFalse).toBe(!valuesEqual(a, b));
      }),
    );
  });

  it("inequality is the negation of equality", () => {
    fc.assert(
      fc.property(arbOCLVal(), arbOCLVal(), (a, b) => {
        const eq = oclEq(a, b);
        expect(oclNeq(a, b)).toEqual(eq === VTrue ? VFalse : VTrue);
      }),
    );
  });
});

describe("edges of structural equality and keys", () => {
  it("VFalse is a value in its own right", () => {
    expect(valuesEqual(VFalse, VFalse)).toBe(true);
    expect(valKey(VFalse)).toBe("b:0");
  });

  it("strings of different text are not equal", () => {
    expect(valuesEqual(vstring("a"), vstring("b"))).toBe(false);
  });

  it("objects agree only when class and identifier both agree", () => {
    expect(valuesEqual(vobj(1, "A"), vobj(1, "B"))).toBe(false);
    expect(valuesEqual(vobj(1, "A"), vobj(2, "A"))).toBe(false);
  });

  it("a collection key lists the element keys, comma-separated", () => {
    expect(valKey(vcoll([vint(1), vint(2)]))).toBe("c:[i:1,i:2]");
  });

  it("xor is false exactly when both sides agree", () => {
    expect(oclXor(VTrue, VTrue)).toEqual(VFalse);
    expect(oclXor(VFalse, VFalse)).toEqual(VFalse);
    expect(oclXor(VTrue, VFalse)).toEqual(VTrue);
    expect(oclXor(VFalse, VTrue)).toEqual(VTrue);
  });
});
