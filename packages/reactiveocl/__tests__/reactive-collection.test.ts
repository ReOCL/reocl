import { describe, expect, it } from "bun:test";
import { ReactiveCollection } from "@core/reactive-collection";
import { isVInt, vcoll, vint, vobj, vstring, type OCLVal } from "@core/values";

describe("content and membership", () => {
  it("starts from the values it was constructed with", () => {
    expect(new ReactiveCollection().signal.value).toEqual([]);
    expect(new ReactiveCollection([vint(1), vint(2)]).signal.value).toHaveLength(2);
  });

  it("snapshot and value both expose the current content", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    expect(c.snapshot()).toEqual([vint(1), vint(2)]);
    expect(c.value).toEqual([vint(1), vint(2)]);
  });

  it("adding appends the value", () => {
    const c = new ReactiveCollection();
    c.add(vint(5));
    expect(c.signal.value).toEqual([vint(5)]);
  });

  it("adding a block appends every element", () => {
    const c = new ReactiveCollection([vint(1)]);
    c.addAll([vint(2), vint(3)]);
    expect(c.snapshot()).toEqual([vint(1), vint(2), vint(3)]);
  });

  it("removing takes out a structurally equal value", () => {
    const c = new ReactiveCollection([vint(1), vint(2), vint(3)]);
    c.remove(vint(2));
    expect(c.signal.value).toEqual([vint(1), vint(3)]);
  });

  it("removing a value that is not a member changes nothing", () => {
    const c = new ReactiveCollection([vint(1)]);
    c.remove(vint(99));
    expect(c.signal.value).toEqual([vint(1)]);
  });
});

describe("multiset occurrences", () => {
  it("withdraws one occurrence of a duplicated object at a time", () => {
    const c = new ReactiveCollection();
    const size = c.size();
    const o = vobj(1, "C");

    c.add(o);
    c.add(o);
    expect(size.value).toBe(2);

    c.remove(o);
    expect(size.value).toBe(1);

    c.remove(o);
    expect(size.value).toBe(0);
  });

  it("withdraws one occurrence for every kind of value", () => {
    const c = new ReactiveCollection();
    const size = c.size();
    const values = [vint(5), vstring("x"), vcoll([vint(1)])];

    for (const v of values) c.addAll([v, v]);
    expect(size.value).toBe(6);

    for (const v of values) c.remove(v);
    expect(size.value).toBe(3);

    for (const v of values) c.remove(v);
    expect(size.value).toBe(0);
  });

  it("leaves other members untouched when a duplicate goes", () => {
    const c = new ReactiveCollection();
    const size = c.size();
    const a = vobj(1, "C");
    const b = vobj(2, "C");

    c.addAll([a, a, b]);
    expect(size.value).toBe(3);

    c.remove(a);
    expect(size.value).toBe(2);
    expect(c.snapshot().filter((v) => v.tag === "VObj" && v.oid === 1)).toHaveLength(1);
    expect(c.snapshot().filter((v) => v.tag === "VObj" && v.oid === 2)).toHaveLength(1);
  });

  it("keeps sum exact across duplicate adds and removes", () => {
    const c = new ReactiveCollection();
    const sum = c.sum();

    c.add(vint(5));
    c.add(vint(5));
    expect(sum.value).toBe(10);

    c.remove(vint(5));
    expect(sum.value).toBe(5);

    c.remove(vint(5));
    expect(sum.value).toBe(0);
  });

  it("propagates a duplicate removal through a derived view", () => {
    const c = new ReactiveCollection();
    const big = c.select((v) => v.tag === "VInt" && v.n >= 10);
    const bigSize = big.size();
    const o = vint(50);

    c.addAll([o, o, vint(1)]);
    expect(bigSize.value).toBe(2);

    c.remove(o);
    expect(bigSize.value).toBe(1);

    c.remove(o);
    expect(bigSize.value).toBe(0);
  });
});

describe("delta subscriptions", () => {
  it("an addition emits one ADD", () => {
    const c = new ReactiveCollection();
    const deltas: string[] = [];
    c.subscribe((d) => deltas.push(d.tag));
    c.add(vint(1));
    expect(deltas).toEqual(["ADD"]);
  });

  it("a removal emits one REMOVE", () => {
    const c = new ReactiveCollection([vint(1)]);
    const deltas: string[] = [];
    c.subscribe((d) => deltas.push(d.tag));
    c.remove(vint(1));
    expect(deltas).toEqual(["REMOVE"]);
  });

  it("a block emits one delta per element, and an empty block none", () => {
    const c = new ReactiveCollection([vint(1)]);
    const size = c.size();
    const deltas: string[] = [];
    c.subscribe((d) => deltas.push(d.tag));

    c.addAll([vint(2), vint(3)]);
    expect(deltas).toEqual(["ADD", "ADD"]);
    expect(size.value).toBe(3);

    c.addAll([]);
    expect(deltas).toEqual(["ADD", "ADD"]);
    expect(size.value).toBe(3);
  });

  it("an unsubscribed listener stops hearing deltas", () => {
    const c = new ReactiveCollection();
    const deltas: string[] = [];
    const unsubscribe = c.subscribe((d) => deltas.push(d.tag));
    unsubscribe();
    c.add(vint(1));
    expect(deltas).toEqual([]);
  });
});

describe("terminal aggregates over the initial content", () => {
  const c = new ReactiveCollection([vint(10), vint(20), vint(30), vint(40)]);
  const isInt = (n: (x: number) => boolean) => (v: { tag: string; n?: number }) =>
    v.tag === "VInt" ? n(v.n!) : null;

  it("forAll holds exactly when no element violates the predicate", () => {
    expect(c.forAll(isInt((n) => n > 0)).value).toBe(true);
    expect(c.forAll(isInt((n) => n > 25)).value).toBe(false);
  });

  it("exists holds exactly when some element matches", () => {
    expect(c.exists(isInt((n) => n > 35)).value).toBe(true);
    expect(c.exists(isInt((n) => n > 100)).value).toBe(false);
  });

  it("one holds for exactly one match", () => {
    expect(c.one(isInt((n) => n === 10)).value).toBe(true);
    expect(c.one(isInt((n) => n > 0)).value).toBe(false);
  });

  it("size counts the elements and sum totals them", () => {
    expect(c.size().value).toBe(4);
    expect(c.sum().value).toBe(100);
  });

  it("isEmpty and notEmpty answer opposite questions", () => {
    expect(c.isEmpty().value).toBe(false);
    expect(c.notEmpty().value).toBe(true);

    const empty = new ReactiveCollection();
    expect(empty.isEmpty().value).toBe(true);
    expect(empty.notEmpty().value).toBe(false);
  });

  it("isUnique fails exactly when a key repeats", () => {
    const key = (v: { tag: string; n?: number }) => (v.tag === "VInt" ? v.n! : null);
    expect(new ReactiveCollection([vint(1), vint(2), vint(3)]).isUnique(key).value).toBe(true);
    expect(new ReactiveCollection([vint(1), vint(2), vint(1)]).isUnique(key).value).toBe(false);
  });

  it("a key that is undefined on every element leaves isUnique holding", () => {
    expect(new ReactiveCollection([vint(1)]).isUnique(() => null).value).toBe(true);
  });
});

describe("aggregates fold each delta", () => {
  it("forAll flips to false when a violator arrives, and back when it leaves", () => {
    const c = new ReactiveCollection([vint(10), vint(20)]);
    const forAll = c.forAll((v) => (v.tag === "VInt" ? v.n > 0 : null));
    expect(forAll.value).toBe(true);

    c.add(vint(-5));
    expect(forAll.value).toBe(false);

    c.remove(vint(-5));
    expect(forAll.value).toBe(true);
  });

  it("exists flips as its last witness arrives and leaves", () => {
    const c = new ReactiveCollection([vint(1)]);
    const exists = c.exists((v) => (v.tag === "VInt" ? v.n > 10 : null));
    expect(exists.value).toBe(false);

    c.add(vint(20));
    expect(exists.value).toBe(true);

    c.remove(vint(20));
    expect(exists.value).toBe(false);
  });

  it("one stays false while more than one element matches", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    const one = c.one((v) => (v.tag === "VInt" ? v.n > 0 : null));
    expect(one.value).toBe(false);

    c.add(vint(3));
    expect(one.value).toBe(false);

    c.remove(vint(2));
    c.remove(vint(3));
    expect(one.value).toBe(true);
  });

  it("size follows additions and removals", () => {
    const c = new ReactiveCollection([vint(1)]);
    const size = c.size();
    c.add(vint(2));
    expect(size.value).toBe(2);
    c.remove(vint(1));
    expect(size.value).toBe(1);
  });

  it("sum follows the values that arrive", () => {
    const c = new ReactiveCollection([vint(5)]);
    const sum = c.sum();
    c.add(vint(10));
    expect(sum.value).toBe(15);
  });

  it("isEmpty and notEmpty follow the first and last element", () => {
    const c = new ReactiveCollection([]);
    const isEmpty = c.isEmpty();
    const notEmpty = c.notEmpty();
    expect(isEmpty.value).toBe(true);
    expect(notEmpty.value).toBe(false);

    c.add(vint(1));
    expect(isEmpty.value).toBe(false);
    expect(notEmpty.value).toBe(true);

    c.remove(vint(1));
    expect(isEmpty.value).toBe(true);
    expect(notEmpty.value).toBe(false);
  });

  it("isUnique reports a duplicate as it arrives and clears it as it goes", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    const unique = c.isUnique((v) => (v.tag === "VInt" ? v.n : null));
    expect(unique.value).toBe(true);

    c.add(vint(1));
    expect(unique.value).toBe(false);

    c.remove(vint(1));
    expect(unique.value).toBe(true);
  });

  it("isUnique reports duplicated objects too", () => {
    const c = new ReactiveCollection();
    const unique = c.isUnique((v) => (v.tag === "VObj" ? v.oid : null));
    const o = vobj(7, "C");

    expect(unique.value).toBe(true);
    c.add(o);
    expect(unique.value).toBe(true);
    c.add(o);
    expect(unique.value).toBe(false);
    c.remove(o);
    expect(unique.value).toBe(true);
  });
});

describe("view-producing operators", () => {
  const gt = (limit: number) => (v: { tag: string; n?: number }) =>
    v.tag === "VInt" ? v.n! > limit : null;

  it("select keeps the matching elements", () => {
    const c = new ReactiveCollection([vint(1), vint(2), vint(3), vint(4)]);
    expect(c.select(gt(2)).signal.value).toEqual([vint(3), vint(4)]);
  });

  it("reject keeps exactly what select drops", () => {
    const c = new ReactiveCollection([vint(1), vint(2), vint(3)]);
    expect(c.reject(gt(1)).signal.value).toEqual([vint(1)]);
  });

  it("collect maps every element", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    const mapped = c.collect((v) => (v.tag === "VInt" ? vint(v.n * 10) : null));
    expect(mapped.signal.value).toEqual([vint(10), vint(20)]);
  });

  it("a select view forwards only the deltas it keeps", () => {
    const c = new ReactiveCollection([vint(1), vint(3)]);
    const view = c.select(gt(2));
    expect(view.signal.value).toEqual([vint(3)]);

    c.add(vint(5));
    expect(view.signal.value).toEqual([vint(3), vint(5)]);

    c.add(vint(0));
    expect(view.signal.value).toEqual([vint(3), vint(5)]);

    c.remove(vint(3));
    expect(view.signal.value).toEqual([vint(5)]);

    c.remove(vint(0));
    expect(view.signal.value).toEqual([vint(5)]);
  });

  it("a collect view maps each incoming delta", () => {
    const c = new ReactiveCollection([vint(1)]);
    const view = c.collect((v) => (v.tag === "VInt" ? vint(v.n * 10) : null));
    c.add(vint(2));
    expect(view.signal.value).toEqual([vint(10), vint(20)]);
  });
});

describe("disposal", () => {
  it("a disposed collection stops maintaining its aggregates", () => {
    const c = new ReactiveCollection();
    const size = c.size();

    c.add(vint(1));
    expect(size.value).toBe(1);

    c.dispose();
    c.add(vint(2));
    expect(size.value).toBe(1);
  });

  it("a disposed view detaches from its source, which carries on", () => {
    const c = new ReactiveCollection();
    const view = c.select(() => true);
    const viewSize = view.size();

    c.add(vint(1));
    expect(viewSize.value).toBe(1);

    view.dispose();
    c.add(vint(2));
    expect(viewSize.value).toBe(1);
    expect(c.snapshot()).toHaveLength(2);
  });
});

describe("the content signal", () => {
  it("repeated reads share one derivation", () => {
    const c = new ReactiveCollection();
    expect(c.signal).toBe(c.signal);
  });

  it("tracks the collection content", () => {
    const c = new ReactiveCollection();
    const s = c.signal;
    expect(s.value).toEqual([]);
    c.add(vint(3));
    expect(s.value).toEqual([vint(3)]);
  });
});

describe("construction aliases nothing", () => {
  it("mutating the seed array does not leak into the collection", () => {
    const seed = [vint(1)];
    const c = new ReactiveCollection(seed);
    seed.push(vint(2));
    expect(c.snapshot()).toHaveLength(1);
  });

  it("the content signal hands out copies, not the live array", () => {
    const c = new ReactiveCollection([vint(1)]);
    const first = c.signal.value;
    c.add(vint(2));
    expect(first).toHaveLength(1);
  });
});

describe("the version counter", () => {
  it("counts each mutation up", () => {
    const c = new ReactiveCollection();
    expect(c.version().value).toBe(0);
    c.add(vint(1));
    expect(c.version().value).toBe(1);
    c.addAll([vint(2)]);
    expect(c.version().value).toBe(2);
    c.remove(vint(1));
    expect(c.version().value).toBe(3);
  });

  it("an empty block is not a mutation", () => {
    const c = new ReactiveCollection([vint(1)]);
    const v = c.version().value;
    c.addAll([]);
    expect(c.version().value).toBe(v);
  });
});

describe("undefined predicates and images", () => {
  const gt3 = (v: OCLVal) => (isVInt(v) && v.n > 3 ? true : null);

  it("reject excludes elements whose predicate is undefined", () => {
    const c = new ReactiveCollection([vint(1)]);
    expect(c.reject(() => null).snapshot()).toHaveLength(0);
  });

  it("collect drops elements whose image is undefined, from the start and as they arrive", () => {
    const c = new ReactiveCollection([vint(1)]);
    const view = c.collect((v) => (isVInt(v) && v.n > 3 ? v : null));
    expect(view.snapshot()).toHaveLength(0);
    c.add(vint(2));
    expect(view.snapshot()).toHaveLength(0);
  });

  it("exists stays down while nothing matches", () => {
    const c = new ReactiveCollection();
    const e = c.exists(gt3);
    c.add(vint(1));
    expect(e.value).toBe(false);
  });

  it("one stays down while nothing matches", () => {
    const c = new ReactiveCollection();
    const o = c.one(gt3);
    c.add(vint(1));
    expect(o.value).toBe(false);
  });

  it("forAll holds when a satisfying element arrives", () => {
    const c = new ReactiveCollection();
    const f = c.forAll(gt3);
    expect(f.value).toBe(true);
    c.add(vint(5));
    expect(f.value).toBe(true);
  });

  it("size counts an arriving element", () => {
    const c = new ReactiveCollection();
    const s = c.size();
    c.add(vint(1));
    expect(s.value).toBe(1);
  });

  it("sum ignores non-integers even as they come and go", () => {
    const c = new ReactiveCollection([vint(5)]);
    const s = c.sum();
    c.add(vstring("x"));
    expect(s.value).toBe(5);
    c.add(vint(5));
    expect(s.value).toBe(10);
  });
});

describe("isUnique bookkeeping", () => {
  const keyOf = (v: OCLVal) => (isVInt(v) ? v.n : null);

  it("a key made unique again stays counted while it is unique", () => {
    const c = new ReactiveCollection([vint(1), vint(1)]);
    const u = c.isUnique(keyOf);
    expect(u.value).toBe(false);
    c.remove(vint(1));
    expect(u.value).toBe(true);
    c.add(vint(1));
    expect(u.value).toBe(false);
  });

  it("draining a duplicated key entirely leaves the counter consistent", () => {
    const c = new ReactiveCollection([vint(1), vint(1)]);
    const u = c.isUnique(keyOf);
    c.remove(vint(1));
    c.remove(vint(1));
    expect(u.value).toBe(true);
  });

  it("elements whose key is undefined never collide", () => {
    const c = new ReactiveCollection([vstring("a"), vstring("b")]);
    const u = c.isUnique(() => null);
    expect(u.value).toBe(true);
    c.add(vstring("c"));
    c.add(vstring("d"));
    expect(u.value).toBe(true);
  });
});

describe("disposal", () => {
  it("disposing is idempotent", () => {
    const c = new ReactiveCollection();
    c.dispose();
    expect(() => c.dispose()).not.toThrow();
  });
});
