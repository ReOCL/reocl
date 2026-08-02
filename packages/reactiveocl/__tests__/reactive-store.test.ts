import { describe, expect, it } from "bun:test";
import { signal } from "@core/signal";
import { Store } from "@core/store";
import { Transaction } from "@core/transaction";
import { vint } from "@core/values";
import { TypedReactiveCollection } from "@api/reactive-collection";
import { ReactiveObject } from "@api/reactive-object";
import { ReactiveStore, RegisteredClass } from "@api/reactive-store";

function storeWithC(fields: Parameters<ReactiveStore["registerClass"]>[1]) {
  const s = new ReactiveStore();
  s.registerClass("C", fields);
  return { s, cls: s.getClass("C")! };
}

describe("registering classes", () => {
  it("a registered class is retrievable and an unregistered one is not", () => {
    const { s } = storeWithC({ x: { tag: "Int", initial: 0 } });
    expect(s.getClass("C")).toBeDefined();
    expect(s.getClass("X")).toBeUndefined();
  });

  it("the core store is reachable, for the transaction layer to record", () => {
    const s = new ReactiveStore();
    expect(s.core).toBeInstanceOf(Store);
  });

  it("a transaction watches the invariant signals it is given", () => {
    const { s, cls } = storeWithC({ x: { tag: "Int", initial: 10 } });
    const obj = cls.create({});
    expect(s.transaction(signal(obj.int("x") > 0))).toBeInstanceOf(Transaction);
  });

  it("an unregistered superclass is reported by name", () => {
    const s = new ReactiveStore();
    expect(() => s.registerClass("Sub", {}, { extends: "Missing" })).toThrow(
      'Cannot register "Sub": superclass "Missing" is not registered yet',
    );
  });

  it("a class built without an explicit ancestry has itself as its only ancestor", () => {
    const cls = new RegisteredClass("Lonely", {}, new Store(), () => 1);
    expect(cls.ancestry).toEqual(["Lonely"]);
  });
});

describe("creating instances", () => {
  it("supplied field values win over the declared initial ones", () => {
    const { cls } = storeWithC({
      a: { tag: "Int", initial: 10 },
      b: { tag: "String", initial: "hi" },
      c: { tag: "Bool", initial: true },
    });
    const obj = cls.create({ a: 5, b: "bye", c: false });
    expect(obj.int("a")).toBe(5);
    expect(obj.str("b")).toBe("bye");
    expect(obj.bool("c")).toBe(false);
  });

  it("an omitted field falls back to its declared initial value", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 99 } });
    expect(cls.create({}).int("x")).toBe(99);
  });

  it("each instance gets a fresh identifier", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 0 } });
    expect(cls.create({}).oid).toBe(cls.create({}).oid - 1);
  });

  it("a collection field is created as a reactive collection", () => {
    const { cls } = storeWithC({ items: { tag: "Collection", elementClass: "D" } });
    expect(cls.create({}).collection("items")).toBeInstanceOf(TypedReactiveCollection);
  });
});

describe("typed field access", () => {
  it("reads a field at the type it was declared with", () => {
    const { cls } = storeWithC({
      a: { tag: "Int", initial: 42 },
      b: { tag: "String", initial: "hello" },
      c: { tag: "Bool", initial: true },
    });
    const obj = cls.create({});
    expect(obj.int("a")).toBe(42);
    expect(obj.str("b")).toBe("hello");
    expect(obj.bool("c")).toBe(true);
  });

  it("writes are visible to the next read", () => {
    const { cls } = storeWithC({
      a: { tag: "Int", initial: 0 },
      b: { tag: "String", initial: "" },
      c: { tag: "Bool", initial: false },
    });
    const obj = cls.create({});
    obj.setInt("a", 99);
    obj.setString("b", "updated");
    obj.setBool("c", true);
    expect(obj.int("a")).toBe(99);
    expect(obj.str("b")).toBe("updated");
    expect(obj.bool("c")).toBe(true);
  });

  it("an unknown field reads as the zero of the accessor's type", () => {
    const { cls } = storeWithC({
      i: { tag: "Int", initial: 5 },
      s: { tag: "String", initial: "a" },
      b: { tag: "Bool", initial: true },
    });
    const obj = cls.create({});
    expect(obj.int("nope")).toBe(0);
    expect(obj.str("nope")).toBe("");
    expect(obj.bool("nope")).toBe(false);
  });

  it("outside a transaction @pre reads the current value", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 7 } });
    expect(cls.create({}).preInt("x")).toBe(7);
  });

  it("a field is reachable as the raw signal behind it", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 10 } });
    expect(cls.create({}).field("x").value).toEqual(vint(10));
  });

  it("an object represents itself as an object value", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 1 } });
    const obj = cls.create({});
    expect(obj.toVal()).toEqual({ tag: "VObj", oid: obj.oid, classId: "C" });
  });

  it("a Boolean write stores the Boolean value, not merely something falsy", () => {
    const { cls } = storeWithC({ flag: { tag: "Bool", initial: true } });
    const obj = cls.create({});

    obj.setBool("flag", false);
    expect(obj.field("flag").value).toEqual({ tag: "VFalse" });

    obj.setBool("flag", true);
    expect(obj.field("flag").value).toEqual({ tag: "VTrue" });
  });
});

describe("class ancestry", () => {
  it("a class without a superclass has itself as its only ancestor", () => {
    const { cls } = storeWithC({ x: { tag: "Int", initial: 0 } });
    expect(cls.superclass).toBeNull();
    expect([...cls.ancestry]).toEqual(["C"]);
  });

  it("a subclass lists itself first, then its ancestors", () => {
    const s = new ReactiveStore();
    s.registerClass("Employee", { salary: { tag: "Int", initial: 0 } });
    s.registerClass("Manager", {}, { extends: "Employee" });
    s.registerClass("Director", {}, { extends: "Manager" });

    expect([...s.getClass("Manager")!.ancestry]).toEqual(["Manager", "Employee"]);
    expect([...s.getClass("Director")!.ancestry]).toEqual(["Director", "Manager", "Employee"]);
    expect(s.getClass("Director")!.superclass).toBe("Manager");
  });

  it("an object built without an ancestry is still a kind of its own class", () => {
    const s = new ReactiveStore();
    s.registerClass("C", { x: { tag: "Int", initial: 0 } });
    const bare = new ReactiveObject(s.core, "C", 1);

    expect(bare.oclIsKindOf("C")).toBe(true);
    expect(bare.oclIsTypeOf("C")).toBe(true);
    expect(bare.oclIsKindOf("Other")).toBe(false);
  });
});

describe("the registered classes seen as a metamodel", () => {
  it("unknown fields and unknown classes are untyped", () => {
    const { s } = storeWithC({ x: { tag: "Int", initial: 0 } });
    expect(s.metaModel.fieldType("C", "nope")).toBeNull();
    expect(s.metaModel.fieldType("Nope", "x")).toBeNull();
    expect(s.metaModel.extends("Nope", "C")).toBe(false);
  });

  it("a collection field is typed as a collection of its element class", () => {
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
