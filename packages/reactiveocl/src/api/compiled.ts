import { computed, type ReadonlySignal } from "@core/signal";
import { ReactiveObject } from "./reactive-object";

type ReactiveSignal<T> = ReadonlySignal<T>;

export function intSignal(obj: ReactiveObject, field: string): ReactiveSignal<number> {
  return computed(() => obj.int(field));
}

export function strSignal(obj: ReactiveObject, field: string): ReactiveSignal<string> {
  return computed(() => obj.str(field));
}

export function boolSignal(obj: ReactiveObject, field: string): ReactiveSignal<boolean> {
  return computed(() => obj.bool(field));
}
