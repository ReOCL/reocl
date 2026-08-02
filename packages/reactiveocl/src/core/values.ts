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
      return isVInt(b) && a.n === b.n;
    case "VString":
      return isVString(b) && a.s === b.s;
    case "VObj":
      return isVObj(b) && a.oid === b.oid && a.classId === b.classId;
    case "VColl":
      return isVColl(b) && collEqual(a, b);
  }
}

function collEqual(a: { vs: OCLVal[] }, b: { vs: OCLVal[] }): boolean {
  if (a.vs.length !== b.vs.length) return false;
  for (let i = 0; i < a.vs.length; i++) {
    if (!valuesEqual(a.vs[i]!, b.vs[i]!)) return false;
  }
  return true;
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
  if (isVTrue(a)) return VFalse;
  if (isVFalse(a)) return VTrue;
  return null;
}

export function oclXor(a: OCLVal, b: OCLVal): OCLVal | null {
  if (!isVTrue(a) && !isVFalse(a)) return null;
  if (!isVTrue(b) && !isVFalse(b)) return null;
  return boolVal(a.tag !== b.tag);
}

export function oclAdd(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? vint(a.n + b.n) : null;
}

export function oclSub(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? vint(a.n - b.n) : null;
}

export function oclMul(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? vint(a.n * b.n) : null;
}

export function oclDiv(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) && b.n !== 0 ? vint(Math.trunc(a.n / b.n)) : null;
}

export function oclEq(a: OCLVal, b: OCLVal): OCLVal {
  return boolVal(valuesEqual(a, b));
}

export function oclNeq(a: OCLVal, b: OCLVal): OCLVal {
  return boolVal(!valuesEqual(a, b));
}

export function oclLt(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? boolVal(a.n < b.n) : null;
}

export function oclGt(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? boolVal(a.n > b.n) : null;
}

export function oclLeq(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? boolVal(a.n <= b.n) : null;
}

export function oclGeq(a: OCLVal, b: OCLVal): OCLVal | null {
  return isVInt(a) && isVInt(b) ? boolVal(a.n >= b.n) : null;
}
