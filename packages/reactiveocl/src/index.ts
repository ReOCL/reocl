import { signal as _signal, computed as _computed, effect as _effect } from "./core/signal";
import type { ReadonlySignal } from "./core/signal";

export const signal = _signal;

export const computed = _computed;

export const effect = _effect;

export type ReactiveSignal<T> = ReadonlySignal<T>;

export { ReactiveStore } from "./api/reactive-store";
export type { RegisteredClass, ClassOptions, FieldDef, FieldDefMap } from "./api/reactive-store";

export { ReactiveObject } from "./api/reactive-object";

export { TypedReactiveCollection } from "./api/reactive-collection";

export { invariant } from "./api/invariant";
export type { InvariantDef } from "./api/invariant";

export { intSignal, strSignal, boolSignal } from "./api/compiled";

export { $pre } from "./core/transaction";

export type { OCLVal } from "./core/values";
export {
  VTrue,
  VFalse,
  vint,
  vstring,
  vobj,
  vcoll,
  boolVal,
  valuesEqual,
  valKey,
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
} from "./core/values";
