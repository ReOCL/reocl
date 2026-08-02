import { describe, expect, it } from "bun:test";
import { effect } from "@core/signal";
import { TypedReactiveCollection } from "@api/reactive-collection";
import { ReactiveObject } from "@api/reactive-object";
import { ReactiveStore } from "@api/reactive-store";

function makeCE() {
  return class CE {
    salary$: { value: number };
    constructor(public obj: ReactiveObject) {
      this.salary$ = {
        get value() {
          return obj.int("salary");
        },
      };
    }
    static from(obj: ReactiveObject) {
      return new CE(obj);
    }
  };
}

function employees() {
  const store = new ReactiveStore();
  store.registerClass("E", { salary: { tag: "Int", initial: 0 } });
  return { store, ec: store.getClass("E")! };
}

function wrapped(salaries: number[]) {
  const { ec } = employees();
  const CE = makeCE();
  const objs = salaries.map((salary) => ec.create({ salary }));
  return { objs, coll: new TypedReactiveCollection(objs, CE.from) };
}

describe("aggregates read through the element wrapper", () => {
  it("forAll holds when every wrapped element satisfies the predicate", () => {
    const { coll } = wrapped([40_000, 25_000]);
    expect(coll.forAll((e) => e.salary$.value >= 20_000).value).toBe(true);
  });

  it("exists distinguishes a satisfied predicate from an unsatisfiable one", () => {
    const { coll } = wrapped([10]);
    expect(coll.exists((e) => e.salary$.value > 5).value).toBe(true);
    expect(coll.exists((e) => e.salary$.value > 20).value).toBe(false);
  });

  it("one holds for exactly one match and fails for two", () => {
    const { coll } = wrapped([10, 20]);
    expect(coll.one((e) => e.salary$.value > 15).value).toBe(true);
    expect(coll.one((e) => e.salary$.value > 0).value).toBe(false);
  });

  it("isUnique holds when the wrapped keys are distinct", () => {
    const { coll } = wrapped([10, 20]);
    expect(coll.isUnique((e) => e.salary$.value).value).toBe(true);
  });

  it("size, isEmpty and notEmpty agree on the content", () => {
    const { coll } = wrapped([10, 20]);
    expect(coll.size().value).toBe(2);
    expect(coll.isEmpty().value).toBe(false);
    expect(coll.notEmpty().value).toBe(true);
  });

  it("sum ignores objects, so a mapped view is what carries the total", () => {
    const { ec } = employees();
    const coll = new TypedReactiveCollection([]);
    const size$ = coll.size();
    coll.addAll([ec.create({ salary: 10 }), ec.create({ salary: 20 })]);

    expect(size$.value).toBe(2);
    expect(coll.sum().value).toBe(0);
    expect(coll.collect((o) => o.int("salary")).sum().value).toBe(30);
  });
});

describe("views over wrapped elements", () => {
  it("select keeps the elements whose wrapped predicate holds", () => {
    const { coll } = wrapped([30, 10]);
    expect(coll.select((e) => e.salary$.value > 20).objects.value.length).toBe(1);
  });

  it("collect exposes the mapped integers through numbers()", () => {
    const { coll } = wrapped([5]);
    expect(coll.collect((e) => e.salary$.value * 2).numbers().value[0]).toBe(10);
  });

  it("numbers() is empty over a collection of objects", () => {
    const { coll } = wrapped([5]);
    expect(coll.numbers().value).toHaveLength(0);
  });

  it("an image of null drops the element from the collected view", () => {
    const { coll } = wrapped([5]);
    expect(coll.collect(() => null).numbers().value).toHaveLength(0);
  });

  it("a collected view has no objects of its own, only values", () => {
    const { coll } = wrapped([5]);
    expect(coll.collect((e) => e.salary$.value * 2).objects.value).toHaveLength(0);
  });

  it("wrapAs re-wraps the elements without copying the collection", () => {
    const { ec } = employees();
    const raw = new TypedReactiveCollection([ec.create({ salary: 99 })]);
    const typed = raw.wrapAs(makeCE().from);
    expect(typed.objects.value.length).toBe(1);
    expect(typed.objects.value[0]!.salary$.value).toBe(99);
  });
});

describe("membership", () => {
  it("objects reflects the collection it was constructed from", () => {
    const { ec } = employees();
    const coll = new TypedReactiveCollection([ec.create({ salary: 10 })]);
    expect(coll.objects.value.map((o) => o.int("salary"))).toEqual([10]);
  });

  it("removing an unknown object leaves the collection alone", () => {
    const { ec } = employees();
    const coll = new TypedReactiveCollection([ec.create({ salary: 10 })]);
    coll.removeByOid("E", 999);
    expect(coll.size().value).toBe(1);
  });

  it("a subscriber sees the removal, never the state in between", () => {
    const { ec } = employees();
    const objs = [10, 20, 30].map((salary) => ec.create({ salary }));
    const coll = new TypedReactiveCollection(objs);
    const size$ = coll.size();

    const seen: string[] = [];
    effect(() => {
      seen.push(`${coll.objects.value.length}/${size$.value}`);
    });
    expect(seen.at(-1)).toBe("3/3");

    coll.removeByOid("E", objs[1]!.oid);
    expect(seen.at(-1)).toBe("2/2");
  });

  it("a derived view can still resolve the object while its removal propagates", () => {
    const { ec } = employees();
    const objs = [10, 30].map((salary) => ec.create({ salary }));
    const coll = new TypedReactiveCollection(objs);
    const rich = coll.select((o) => o.int("salary") >= 20);
    expect(rich.objects.value.length).toBe(1);

    coll.removeByOid("E", objs[1]!.oid);
    expect(rich.objects.value.length).toBe(0);
    expect(rich.size().value).toBe(0);
  });
});
