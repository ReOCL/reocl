import { describe, expect, it } from "bun:test";
import { invariant } from "@api/invariant";
import { signal } from "@core/signal";

describe("invariant definitions", () => {
  it("carry the name, the signal and the source they were given", () => {
    const value$ = signal(true);
    const def = invariant("conservation", value$, "self.a = self.a@pre");

    expect(def.name).toBe("conservation");
    expect(def.value$).toBe(value$);
    expect(def.code).toBe("self.a = self.a@pre");
  });

  it("default to no source at all", () => {
    expect(invariant("unnamed", signal(false)).code).toBe("");
  });

  it("expose the signal live, rather than the value it held at definition", () => {
    const value$ = signal(true);
    const def = invariant("flips", value$, "");

    expect(def.value$.value).toBe(true);
    value$.value = false;
    expect(def.value$.value).toBe(false);
  });
});
