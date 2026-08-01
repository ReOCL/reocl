import { computed, type ReadonlySignal } from "@core/signal";
import { ReactiveObject } from "./reactive-object";

type ReactiveSignal<T> = ReadonlySignal<T>;

/** Compile a scalar integer field into a reactive signal. */
export function intSignal(obj: ReactiveObject, field: string): ReactiveSignal<number> {
  return computed(() => obj.int(field));
}

/** Compile a scalar string field into a reactive signal. */
export function strSignal(obj: ReactiveObject, field: string): ReactiveSignal<string> {
  return computed(() => obj.str(field));
}

/** Compile a scalar boolean field into a reactive signal. */
export function boolSignal(obj: ReactiveObject, field: string): ReactiveSignal<boolean> {
  return computed(() => obj.bool(field));
}
