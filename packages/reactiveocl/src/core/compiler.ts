import { computed, type ReadonlySignal } from "./signal";
import { Store } from "./store";
import { Transaction } from "./transaction";
import {
  type BinOp,
  type Env,
  type Expr,
  type Invariant,
  type MetaModel,
  type OCLType,
  TBool,
  TInt,
  TString,
  TObject,
  TCollection,
  typesCompatible,
  typesEqual,
  joinTypes,
} from "./types";
import type { OCLVal } from "./values";
import {
  boolVal,
  expectBool,
  expectColl,
  oclAdd,
  oclDiv,
  oclEq,
  oclGeq,
  oclGt,
  oclLeq,
  oclLt,
  oclMul,
  oclNeq,
  oclNot,
  oclSub,
  oclXor,
  valKey,
  VFalse,
  vint,
  vstring,
  VTrue,
} from "./values";
type ValEnv = Map<string, OCLVal | undefined>;

type StrictBinOp = Exclude<BinOp, "and" | "or" | "implies">;

function oclBinOp(op: StrictBinOp, a: OCLVal, b: OCLVal): OCLVal | null {
  switch (op) {
    case "xor":
      return oclXor(a, b);
    case "eq":
      return oclEq(a, b);
    case "neq":
      return oclNeq(a, b);
    case "lt":
      return oclLt(a, b);
    case "gt":
      return oclGt(a, b);
    case "leq":
      return oclLeq(a, b);
    case "geq":
      return oclGeq(a, b);
    case "add":
      return oclAdd(a, b);
    case "sub":
      return oclSub(a, b);
    case "mul":
      return oclMul(a, b);
    case "div":
      return oclDiv(a, b);
  }
}

function typeBinOp(op: BinOp, t1: OCLType, t2: OCLType): OCLType | null {
  switch (op) {
    case "and":
    case "or":
    case "implies":
    case "xor":
      if (typesCompatible(t1, TBool) && typesCompatible(t2, TBool)) return TBool;
      return null;
    case "eq":
    case "neq":
      if (typesEqual(t1, t2)) return TBool;
      return null;
    case "lt":
    case "gt":
    case "leq":
    case "geq":
      if (typesCompatible(t1, TInt) && typesCompatible(t2, TInt)) return TBool;
      return null;
    case "add":
    case "sub":
    case "mul":
    case "div":
      if (typesCompatible(t1, TInt) && typesCompatible(t2, TInt)) return TInt;
      return null;
  }
}

export function typeOf(env: Env, e: Expr, mm: MetaModel): OCLType | null {
  switch (e.tag) {
    case "ETrue":
    case "EFalse":
      return TBool;
    case "EIntLit":
      return TInt;
    case "EStringLit":
      return TString;
    case "ESelf": {
      const selfT = env.get("self");
      return selfT ?? null;
    }
    case "EVar": {
      const t = env.get(e.x);
      return t ?? null;
    }
    case "ENav": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TObject") return null;
      return mm.fieldType(t.C, e.f);
    }
    case "EPre": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TObject") return null;
      return mm.fieldType(t.C, e.f);
    }
    case "EBinOp": {
      const t1 = typeOf(env, e.e1, mm);
      const t2 = typeOf(env, e.e2, mm);
      if (!t1 || !t2) return null;
      return typeBinOp(e.op, t1, t2);
    }
    case "ENot": {
      const t = typeOf(env, e.e, mm);
      if (!t || !typesCompatible(t, TBool)) return null;
      return TBool;
    }
    case "EIf": {
      const tg = typeOf(env, e.e1, mm);
      const tt = typeOf(env, e.e2, mm);
      const te = typeOf(env, e.e3, mm);
      if (!tg || !typesCompatible(tg, TBool)) return null;
      if (!tt || !te) return null;
      return joinTypes(tt, te);
    }
    case "ESelect": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv: Env = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return TCollection(t1.t);
    }
    case "EReject": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv: Env = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return TCollection(t1.t);
    }
    case "ECollect": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2) return null;
      return TCollection(t2);
    }
    case "EForAll": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return TBool;
    }
    case "EExists": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return TBool;
    }
    case "EOne": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return TBool;
    }
    case "EIsUnique": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2) return null;
      return TBool;
    }
    case "EAny": {
      const t1 = typeOf(env, e.e1, mm);
      if (!t1 || t1.tag !== "TCollection") return null;
      const extEnv = new Map(env);
      extEnv.set(e.x, t1.t);
      const t2 = typeOf(extEnv, e.e2, mm);
      if (!t2 || !typesCompatible(t2, TBool)) return null;
      return t1.t;
    }
    case "ESize": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TCollection") return null;
      return TInt;
    }
    case "ESum": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TCollection" || !typesEqual(t.t, TInt)) return null;
      return TInt;
    }
    case "EIsEmpty": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TCollection") return null;
      return TBool;
    }
    case "ENotEmpty": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TCollection") return null;
      return TBool;
    }
    case "EKindOf": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TObject") return null;
      return TBool;
    }
    case "ETypeOf": {
      const t = typeOf(env, e.e, mm);
      if (!t || t.tag !== "TObject") return null;
      return TBool;
    }
  }
}

export function wellTypedInvariant(inv: Invariant, mm: MetaModel): boolean {
  const env: Env = new Map();
  env.set("self", TObject(inv.context));
  return typeOf(env, inv.body, mm)?.tag === "TBool";
}

function bindVar(env: ValEnv, x: string, v: OCLVal): ValEnv {
  const extended: ValEnv = new Map(env);
  extended.set(x, v);
  return extended;
}

function evalBool(
  e: Expr,
  env: ValEnv,
  store: Store,
  heap: Map<string, OCLVal> | null,
  mm?: MetaModel,
): boolean | null {
  const r = evalExpr(e, env, store, heap, mm);
  return r === null ? null : expectBool(r);
}

function evalIterBools(
  source: Expr,
  x: string,
  body: Expr,
  env: ValEnv,
  store: Store,
  heap: Map<string, OCLVal> | null,
  mm?: MetaModel,
): { vs: OCLVal[]; bs: boolean[] } | null {
  const c = evalExpr(source, env, store, heap, mm);
  if (c === null) return null;
  const vs = expectColl(c);
  if (vs === null) return null;
  const bs: boolean[] = [];
  for (const v of vs) {
    const b = evalBool(body, bindVar(env, x, v), store, heap, mm);
    if (b === null) return null;
    bs.push(b);
  }
  return { vs, bs };
}

export function evalExpr(
  expr: Expr,
  env: ValEnv,
  store: Store,
  heap: Map<string, OCLVal> | null,
  mm?: MetaModel,
): OCLVal | null {
  switch (expr.tag) {
    case "ETrue":
      return VTrue;
    case "EFalse":
      return VFalse;
    case "EIntLit":
      return vint(expr.n);
    case "EStringLit":
      return vstring(expr.s);
    case "ESelf":
      return env.get("self") ?? null;
    case "EVar":
      return env.get(expr.x) ?? null;
    case "ENav": {
      const v = evalExpr(expr.e, env, store, heap, mm);
      if (v === null || v.tag !== "VObj") return null;
      const sid = `${v.classId}:${v.oid}:${expr.f}`;
      return store.read(sid) ?? null;
    }
    case "EPre": {
      const v = evalExpr(expr.e, env, store, heap, mm);
      if (v === null || v.tag !== "VObj") return null;
      if (heap === null) return null;
      const sid = `${v.classId}:${v.oid}:${expr.f}`;
      return heap.get(sid) ?? store.read(sid) ?? null;
    }
    case "EBinOp": {
      const v1 = evalExpr(expr.e1, env, store, heap, mm);
      if (v1 === null) return null;

      if (expr.op === "and" || expr.op === "or" || expr.op === "implies") {
        const b1 = expectBool(v1);
        if (b1 === null) return null;
        if (expr.op === "and" && !b1) return VFalse;
        if (expr.op === "or" && b1) return VTrue;
        if (expr.op === "implies" && !b1) return VTrue;
        const v2 = evalExpr(expr.e2, env, store, heap, mm);
        if (v2 === null) return null;
        const b2 = expectBool(v2);
        return b2 === null ? null : boolVal(b2);
      }

      const v2 = evalExpr(expr.e2, env, store, heap, mm);
      if (v2 === null) return null;
      return oclBinOp(expr.op, v1, v2);
    }
    case "ENot": {
      const v = evalExpr(expr.e, env, store, heap, mm);
      return v === null ? null : oclNot(v);
    }
    case "EIf": {
      const guard = evalExpr(expr.e1, env, store, heap, mm);
      const bg = guard === null ? null : expectBool(guard);
      if (bg === null) return null;
      return evalExpr(bg ? expr.e2 : expr.e3, env, store, heap, mm);
    }
    case "ESelect": {
      const it = evalIterBools(expr.e1, expr.x, expr.e2, env, store, heap, mm);
      if (it === null) return null;
      return { tag: "VColl", vs: it.vs.filter((_, i) => it.bs[i]!) };
    }
    case "EReject": {
      const it = evalIterBools(expr.e1, expr.x, expr.e2, env, store, heap, mm);
      if (it === null) return null;
      return { tag: "VColl", vs: it.vs.filter((_, i) => !it.bs[i]!) };
    }
    case "ECollect": {
      const c = evalExpr(expr.e1, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      const out: OCLVal[] = [];
      for (const v of vs) {
        const r = evalExpr(expr.e2, bindVar(env, expr.x, v), store, heap, mm);
        if (r === null) return null;
        out.push(r);
      }
      return { tag: "VColl", vs: out };
    }
    case "EForAll": {
      const c = evalExpr(expr.e1, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      for (const v of vs) {
        const b = evalBool(expr.e2, bindVar(env, expr.x, v), store, heap, mm);
        if (b === null) return null;
        if (!b) return VFalse;
      }
      return VTrue;
    }
    case "EExists": {
      const c = evalExpr(expr.e1, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      for (const v of vs) {
        const b = evalBool(expr.e2, bindVar(env, expr.x, v), store, heap, mm);
        if (b === null) return null;
        if (b) return VTrue;
      }
      return VFalse;
    }
    case "EOne": {
      const it = evalIterBools(expr.e1, expr.x, expr.e2, env, store, heap, mm);
      if (it === null) return null;
      return boolVal(it.bs.filter((b) => b).length === 1);
    }
    case "EIsUnique": {
      const c = evalExpr(expr.e1, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      const keys: string[] = [];
      for (const v of vs) {
        const r = evalExpr(expr.e2, bindVar(env, expr.x, v), store, heap, mm);
        if (r === null) return null;
        keys.push(valKey(r));
      }
      return boolVal(new Set(keys).size === keys.length);
    }
    case "EAny": {
      const c = evalExpr(expr.e1, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      for (const v of vs) {
        const b = evalBool(expr.e2, bindVar(env, expr.x, v), store, heap, mm);
        if (b === null) return null;
        if (b) return v;
      }
      return null;
    }
    case "ESize": {
      const c = evalExpr(expr.e, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      return vs === null ? null : vint(vs.length);
    }
    case "ESum": {
      const c = evalExpr(expr.e, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      if (vs === null) return null;
      let total = 0;
      for (const v of vs) {
        if (v.tag !== "VInt") return null;
        total += v.n;
      }
      return vint(total);
    }
    case "EIsEmpty": {
      const c = evalExpr(expr.e, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      return vs === null ? null : boolVal(vs.length === 0);
    }
    case "ENotEmpty": {
      const c = evalExpr(expr.e, env, store, heap, mm);
      if (c === null) return null;
      const vs = expectColl(c);
      return vs === null ? null : boolVal(vs.length > 0);
    }
    case "EKindOf": {
      const v = evalExpr(expr.e, env, store, heap, mm);
      if (v === null || v.tag !== "VObj") return null;
      return boolVal(mm ? mm.extends(v.classId, expr.C) : v.classId === expr.C);
    }
    case "ETypeOf": {
      const v = evalExpr(expr.e, env, store, heap, mm);
      if (v === null || v.tag !== "VObj") return null;
      return boolVal(v.classId === expr.C);
    }
  }
}

export function compileInvariant(
  inv: Invariant,
  store: Store,
  oid: number,
  tx: Transaction | null = null,
  mm?: MetaModel,
): ReadonlySignal<boolean> {
  return computed(() => {
    const heap = tx?.preHeap ?? null;
    const env = new Map<string, OCLVal | undefined>();
    env.set("self", { tag: "VObj", oid, classId: inv.context } satisfies OCLVal);
    const result = evalExpr(inv.body, env, store, heap, mm);
    return result !== null && result.tag === "VTrue";
  });
}
