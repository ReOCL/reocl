import type { OCLVal } from "./values";

export type ClassId = string;
export type FieldId = string;
export type StateId = string;

export function fieldStateId(C: ClassId, oid: number, f: FieldId): StateId {
  return `${C}:${oid}:${f}`;
}

export type OCLType =
  | { tag: "TBool" }
  | { tag: "TInt" }
  | { tag: "TString" }
  | { tag: "TObject"; C: ClassId }
  | { tag: "TCollection"; t: OCLType };

export const TBool: OCLType = { tag: "TBool" };
export const TInt: OCLType = { tag: "TInt" };
export const TString: OCLType = { tag: "TString" };
export const TObject = (C: ClassId): OCLType => ({ tag: "TObject", C });
export const TCollection = (t: OCLType): OCLType => ({ tag: "TCollection", t });

export function typesEqual(t1: OCLType, t2: OCLType): boolean {
  if (t1.tag !== t2.tag) return false;
  switch (t1.tag) {
    case "TBool":
    case "TInt":
    case "TString":
      return true;
    case "TObject":
      return t1.C === (t2 as typeof t1).C;
    case "TCollection":
      return typesEqual(t1.t, (t2 as typeof t1).t);
  }
}

export function typesCompatible(t1: OCLType, t2: OCLType): boolean {
  return typesEqual(t1, t2);
}

export function joinTypes(t1: OCLType, t2: OCLType): OCLType | null {
  return typesEqual(t1, t2) ? t1 : null;
}

/** Typing environment: variable → type. */
export type Env = Map<string, OCLType>;

/** The metamodel: maps (class, field) → OCLType. */
export interface MetaModel {
  fieldType(C: ClassId, f: FieldId): OCLType | null;
  extends(sub: ClassId, sup: ClassId): boolean;
}

/** Membership delta of a reactive collection view. */
export type Delta = Add | Remove;

interface Add {
  tag: "ADD";
  val: OCLVal;
}
interface Remove {
  tag: "REMOVE";
  val: OCLVal;
}

export const add = (val: OCLVal): Delta => ({ tag: "ADD", val });
export const rem = (val: OCLVal): Delta => ({ tag: "REMOVE", val });

export type DeltaSubscriber = (delta: Delta) => void;

// State kept by the terminal operators, each read back in constant time per delta.

/** Number of elements violating the predicate: forAll holds when it is zero. */
export interface ForAllAggregate {
  violatingCount: number;
}

/** Number of matching elements, read back by exists (> 0) and one (= 1). */
export interface MatchingAggregate {
  matchingCount: number;
}

/** Element count, read back by size, isEmpty and notEmpty. */
export interface SizeAggregate {
  size: number;
}

/** SumAggregate: running total over the integer elements. */
export interface SumAggregate {
  total: number;
}

/** IsUniqueAggregate: occurrence count per key, plus the number of duplicated keys. */
export interface IsUniqueAggregate {
  counts: Map<string | number, number>;
  duplicates: number;
}

export type BinOp =
  | "and"
  | "or"
  | "implies"
  | "xor"
  | "eq"
  | "neq"
  | "lt"
  | "gt"
  | "leq"
  | "geq"
  | "add"
  | "sub"
  | "mul"
  | "div";

export type Expr =
  | { tag: "ETrue" }
  | { tag: "EFalse" }
  | { tag: "EIntLit"; n: number }
  | { tag: "EStringLit"; s: string }
  | { tag: "ESelf" }
  | { tag: "EVar"; x: string }
  | { tag: "ENav"; e: Expr; f: FieldId }
  | { tag: "EPre"; e: Expr; f: FieldId }
  | { tag: "EBinOp"; op: BinOp; e1: Expr; e2: Expr }
  | { tag: "ENot"; e: Expr }
  | { tag: "EIf"; e1: Expr; e2: Expr; e3: Expr }
  | { tag: "ESelect"; e1: Expr; x: string; e2: Expr }
  | { tag: "EReject"; e1: Expr; x: string; e2: Expr }
  | { tag: "ECollect"; e1: Expr; x: string; e2: Expr }
  | { tag: "EForAll"; e1: Expr; x: string; e2: Expr }
  | { tag: "EExists"; e1: Expr; x: string; e2: Expr }
  | { tag: "EOne"; e1: Expr; x: string; e2: Expr }
  | { tag: "EIsUnique"; e1: Expr; x: string; e2: Expr }
  | { tag: "EAny"; e1: Expr; x: string; e2: Expr }
  | { tag: "ESize"; e: Expr }
  | { tag: "ESum"; e: Expr }
  | { tag: "EIsEmpty"; e: Expr }
  | { tag: "ENotEmpty"; e: Expr }
  | { tag: "EKindOf"; e: Expr; C: ClassId }
  | { tag: "ETypeOf"; e: Expr; C: ClassId };

/** An invariant: context C inv name : body. */
export interface Invariant {
  context: ClassId;
  name: string;
  body: Expr;
}
