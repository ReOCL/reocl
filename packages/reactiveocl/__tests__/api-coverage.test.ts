/** Exercises the API surface that the feature-oriented suites leave untouched. */
import { describe, expect, it } from "bun:test";
import { ReactiveCollection } from "@core/reactive-collection";
import { Store } from "@core/store";
import { add, fieldStateId, rem } from "@core/types";
import { expectObj, valKey, vcoll, VFalse, vint, vobj, vstring, VTrue } from "@core/values";
import { TypedReactiveCollection } from "@api/reactive-collection";
import { ReactiveStore } from "@api/reactive-store";
import { effect } from "@core/signal";

describe("state identifiers and delta constructors", () => {
  it("fieldStateId names a field cell", () => {
    expect(fieldStateId("Employee", 3, "salary")).toBe("Employee:3:salary");
  });

  it("add and rem build membership deltas", () => {
    expect(add(vint(1))).toEqual({ tag: "ADD", val: vint(1) });
    expect(rem(vint(1))).toEqual({ tag: "REMOVE", val: vint(1) });
  });
});

describe("value helpers", () => {
  it("expectObj projects objects only", () => {
    expect(expectObj(vobj(7, "C"))).toEqual({ oid: 7, classId: "C" });
    expect(expectObj(vint(7))).toBeNull();
  });

  it("valKey separates every value shape", () => {
    const keys = [
      valKey(VTrue),
      valKey(VFalse),
      valKey(vint(1)),
      valKey(vstring("1")),
      valKey(vobj(1, "C")),
      valKey(vcoll([vint(1)])),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("valKey agrees with structural equality", () => {
    expect(valKey(vcoll([vstring("a"), vstring("b")]))).not.toBe(valKey(vcoll([vstring("a,b")])));
    expect(valKey(vobj(1, "C"))).toBe(valKey(vobj(1, "C")));
  });
});

describe("ReactiveCollection accessors", () => {
  const c = new ReactiveCollection([vint(1), vint(2)]);

  it("snapshot and value expose the current content", () => {
    expect(c.snapshot()).toEqual([vint(1), vint(2)]);
    expect(c.value).toEqual([vint(1), vint(2)]);
  });
});

describe("TypedReactiveCollection", () => {
  function employees() {
    const s = new ReactiveStore();
    s.registerClass("E", { salary: { tag: "Int", initial: 0 } });
    const ec = s.getClass("E")!;
    return { store: s, ec };
  }

  it("objects reflects a directly constructed collection", () => {
    const { ec } = employees();
    const c = new TypedReactiveCollection([ec.create({ salary: 10 })]);
    expect(c.objects.value.map((o) => o.int("salary"))).toEqual([10]);
  });

  it("addAll registers every object and updates aggregates", () => {
    const { ec } = employees();
    const c = new TypedReactiveCollection([]);
    const sz = c.size();
    c.addAll([ec.create({ salary: 10 }), ec.create({ salary: 20 })]);
    expect(sz.value).toBe(2);
    expect(c.sum().value).toBe(0); // objects are not integers
    expect(c.collect((o) => o.int("salary")).sum().value).toBe(30);
    expect(c.objects.value.length).toBe(2);
  });

  it("a subscriber sees the removal, not the state in between", () => {
    // Reading `objects` lazily hides the problem: a rendering effect recomputes
    // as soon as the collection notifies, so the object must already be gone.
    const { ec } = employees();
    const objs = [ec.create({ salary: 10 }), ec.create({ salary: 20 }), ec.create({ salary: 30 })];
    const c = new TypedReactiveCollection(objs);
    const size$ = c.size();

    const seen: string[] = [];
    effect(() => {
      seen.push(`${c.objects.value.length}/${size$.value}`);
    });
    expect(seen.at(-1)).toBe("3/3");

    c.removeByOid("E", objs[1]!.oid);
    expect(seen.at(-1)).toBe("2/2");
    expect(c.objects.value.length).toBe(2);
  });

  it("derived views still resolve the object while the removal is processed", () => {
    const { ec } = employees();
    const objs = [ec.create({ salary: 10 }), ec.create({ salary: 30 })];
    const c = new TypedReactiveCollection(objs);
    const rich = c.select((o) => o.int("salary") >= 20);
    expect(rich.objects.value.length).toBe(1);

    c.removeByOid("E", objs[1]!.oid);
    expect(rich.objects.value.length).toBe(0);
    expect(rich.size().value).toBe(0);
  });

  it("removeByOid ignores unknown objects", () => {
    const { ec } = employees();
    const c = new TypedReactiveCollection([ec.create({ salary: 10 })]);
    c.removeByOid("E", 999);
    expect(c.size().value).toBe(1);
  });
});

describe("store and metamodel edge cases", () => {
  it("write to an unregistered cell fails loudly", () => {
    const s = new Store();
    expect(() => s.write("Nope:1:x", vint(1))).toThrow(/unregistered state cell/);
    expect(s.read("Nope:1:x")).toBeUndefined();
  });

  it("restore skips cells that no longer exist", () => {
    const s = new Store();
    s.register("C", 1, "x", vint(1));
    const snap = s.snapshot();
    snap.set("Gone:1:x", vint(5));
    s.write("C:1:x", vint(2));
    s.restore(snap);
    expect(s.read("C:1:x")).toEqual(vint(1));
  });

  it("recording can be driven directly, and records each cell once", () => {
    const s = new Store();
    s.register("C", 1, "x", vint(1));
    s.register("C", 1, "y", vint(2));
    const heap = s.beginRecording();
    s.write("C:1:x", vint(10));
    s.write("C:1:x", vint(20));
    expect([...heap.entries()]).toEqual([["C:1:x", vint(1)]]);
    s.endRecording();
    s.write("C:1:y", vint(30));
    expect(heap.has("C:1:y")).toBe(false);
    expect(s.getSignal("C:1:y")!.value).toEqual(vint(30));
  });

  it("metaModel reports unknown fields and classes as untyped", () => {
    const s = new ReactiveStore();
    s.registerClass("C", { x: { tag: "Int", initial: 0 } });
    expect(s.metaModel.fieldType("C", "nope")).toBeNull();
    expect(s.metaModel.fieldType("Nope", "x")).toBeNull();
    expect(s.metaModel.extends("Nope", "C")).toBe(false);
  });

  it("collection fields are typed as collections of their element class", () => {
    const s = new ReactiveStore();
    s.registerClass("E", { salary: { tag: "Int", initial: 0 } });
    s.registerClass("D", {
      name: { tag: "String", initial: "" },
      active: { tag: "Bool", initial: true },
      staff: { tag: "Collection", elementClass: "E" },
    });
    expect(s.metaModel.fieldType("D", "staff")).toEqual({
      tag: "TCollection",
      t: { tag: "TObject", C: "E" },
    });
    expect(s.metaModel.fieldType("D", "name")).toEqual({ tag: "TString" });
    expect(s.metaModel.fieldType("D", "active")).toEqual({ tag: "TBool" });
  });
});
