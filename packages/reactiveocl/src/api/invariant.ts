import type { ReadonlySignal } from "@core/signal";

export interface InvariantDef {
  name: string;
  value$: ReadonlySignal<boolean>;
  code: string;
}

export function invariant(
  name: string,
  value$: ReadonlySignal<boolean>,
  code: string = "",
): InvariantDef {
  return { name, value$, code };
}
