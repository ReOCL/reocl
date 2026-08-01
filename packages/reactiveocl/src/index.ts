import { signal as _signal, computed as _computed, effect as _effect } from "./core/signal";
import type { ReadonlySignal } from "./core/signal";

/** Mutable reactive cell. */
export const signal = _signal;

/** Derived reactive cell. */
export const computed = _computed;

/** Subscribe to a signal's changes - drives reactive UI updates. */
export const effect = _effect;

/** Read-only view of a reactive signal. */
export type ReactiveSignal<T> = ReadonlySignal<T>;

export { ReactiveStore } from "./api/reactive-store";
export type { RegisteredClass, ClassOptions, FieldDef, FieldDefMap } from "./api/reactive-store";

export { ReactiveObject } from "./api/reactive-object";

export { TypedReactiveCollection } from "./api/reactive-collection";

export { invariant } from "./api/invariant";
export type { InvariantDef } from "./api/invariant";

export { intSignal, strSignal, boolSignal } from "./api/compiled";
