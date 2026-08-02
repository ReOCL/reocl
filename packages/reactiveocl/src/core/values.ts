export type OCLVal =
  | { tag: "VTrue" }
  | { tag: "VFalse" }
  | { tag: "VInt"; n: number }
  | { tag: "VString"; s: string }
  | { tag: "VObj"; oid: number; classId: string }
  | { tag: "VColl"; vs: OCLVal[] };

export const VTrue: OCLVal = { tag: "VTrue" };
export const VFalse: OCLVal = { tag: "VFalse" };
export const vint = (n: number): OCLVal => ({ tag: "VInt", n });
export const vstring = (s: string): OCLVal => ({ tag: "VString", s });
export const vobj = (oid: number, classId: string): OCLVal => ({ tag: "VObj", oid, classId });
export const vcoll = (vs: OCLVal[]): OCLVal => ({ tag: "VColl", vs });

export function valuesEqual(a: OCLVal, b: OCLVal): boolean {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case "VTrue":
    case "VFalse":
      return true;
    case "VInt":
      return a.n === (b as typeof a).n;
    case "VString":
      return a.s === (b as typeof a).s;
    case "VObj":
      return a.oid === (b as typeof a).oid && a.classId === (b as typeof a).classId;
    case "VColl": {
      const bs = b as typeof a;
      if (a.vs.length !== bs.vs.length) return false;
      for (let i = 0; i < a.vs.length; i++) {
        if (!valuesEqual(a.vs[i]!, bs.vs[i]!)) return false;
      }
      return true;
    }
  }
}

export function expectBool(v: OCLVal): boolean | null {
  if (v.tag === "VTrue") return true;
  if (v.tag === "VFalse") return false;
  return null;
}

export function expectInt(v: OCLVal): number | null {
  return v.tag === "VInt" ? v.n : null;
}

export function expectObj(v: OCLVal): { oid: number; classId: string } | null {
  return v.tag === "VObj" ? { oid: v.oid, classId: v.classId } : null;
}

export function expectColl(v: OCLVal): OCLVal[] | null {
  return v.tag === "VColl" ? v.vs : null;
}

export function isVTrue(v: OCLVal): v is { tag: "VTrue" } {
  return v.tag === "VTrue";
}
export function isVFalse(v: OCLVal): v is { tag: "VFalse" } {
  return v.tag === "VFalse";
}
export function isVInt(v: OCLVal): v is { tag: "VInt"; n: number } {
  return v.tag === "VInt";
}
export function isVString(v: OCLVal): v is { tag: "VString"; s: string } {
  return v.tag === "VString";
}
export function isVObj(v: OCLVal): v is { tag: "VObj"; oid: number; classId: string } {
  return v.tag === "VObj";
}
export function isVColl(v: OCLVal): v is { tag: "VColl"; vs: OCLVal[] } {
  return v.tag === "VColl";
}

export function asVInt(v: OCLVal): number | undefined {
  return v.tag === "VInt" ? v.n : undefined;
}
export function asVString(v: OCLVal): string | undefined {
  return v.tag === "VString" ? v.s : undefined;
}
export function asVObj(v: OCLVal): { oid: number; classId: string } | undefined {
  return v.tag === "VObj" ? { oid: v.oid, classId: v.classId } : undefined;
}
export function asVColl(v: OCLVal): OCLVal[] | undefined {
  return v.tag === "VColl" ? v.vs : undefined;
}

export function boolVal(b: boolean): OCLVal {
  return b ? VTrue : VFalse;
}

export function valKey(v: OCLVal): string {
  switch (v.tag) {
    case "VTrue":
      return "b:1";
    case "VFalse":
      return "b:0";
    case "VInt":
      return `i:${v.n}`;
    case "VString":
      return `s:${JSON.stringify(v.s)}`;
    case "VObj":
      return `o:${v.classId}:${v.oid}`;
    case "VColl":
      return `c:[${v.vs.map(valKey).join(",")}]`;
  }
}

export function oclNot(a: OCLVal): OCLVal | null {
  const ba = expectBool(a);
  if (ba === null) return null;
  return boolVal(!ba);
}

export function oclXor(a: OCLVal, b: OCLVal): OCLVal | null {
  const ba = expectBool(a);
  const bb = expectBool(b);
  if (ba === null || bb === null) return null;
  return boolVal(ba !== bb);
}

export function oclAdd(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return vint(n + m);
}

export function oclSub(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return vint(n - m);
}

export function oclMul(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return vint(n * m);
}

export function oclDiv(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null || m === 0) return null;
  return vint(n / m);
}

export function oclEq(a: OCLVal, b: OCLVal): OCLVal {
  return boolVal(valuesEqual(a, b));
}

export function oclNeq(a: OCLVal, b: OCLVal): OCLVal {
  return boolVal(!valuesEqual(a, b));
}

export function oclLt(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return boolVal(n < m);
}

export function oclGt(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return boolVal(n > m);
}

export function oclLeq(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return boolVal(n <= m);
}

export function oclGeq(a: OCLVal, b: OCLVal): OCLVal | null {
  const n = expectInt(a);
  const m = expectInt(b);
  if (n === null || m === null) return null;
  return boolVal(n >= m);
}
