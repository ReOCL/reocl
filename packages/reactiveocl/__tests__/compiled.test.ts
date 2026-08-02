import { describe, expect, it } from "bun:test";
import { boolSignal, intSignal, strSignal } from "@api/compiled";
import { ReactiveStore } from "@api/reactive-store";

function instance() {
  const store = new ReactiveStore();
  store.registerClass("C", {
    count: { tag: "Int", initial: 7 },
    label: { tag: "String", initial: "seven" },
    active: { tag: "Bool", initial: true },
  });
  return store.getClass("C")!.create({});
}

describe("field signals", () => {
  it("read the field they were built from", () => {
    const obj = instance();
    expect(intSignal(obj, "count").value).toBe(7);
    expect(strSignal(obj, "label").value).toBe("seven");
    expect(boolSignal(obj, "active").value).toBe(true);
  });

  it("track later writes to that field", () => {
    const obj = instance();
    const count$ = intSignal(obj, "count");
    const label$ = strSignal(obj, "label");
    const active$ = boolSignal(obj, "active");

    obj.setInt("count", 8);
    obj.setString("label", "eight");
    obj.setBool("active", false);

    expect(count$.value).toBe(8);
    expect(label$.value).toBe("eight");
    expect(active$.value).toBe(false);
  });

  it("are bound to one field each, so a sibling write does not move them", () => {
    const obj = instance();
    const count$ = intSignal(obj, "count");

    obj.setString("label", "changed");
    expect(count$.value).toBe(7);
  });

  it("read the zero of their type for a field that does not exist", () => {
    const obj = instance();
    expect(intSignal(obj, "missing").value).toBe(0);
    expect(strSignal(obj, "missing").value).toBe("");
    expect(boolSignal(obj, "missing").value).toBe(false);
  });
});
