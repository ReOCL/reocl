import { describe, it, expect } from "bun:test";
import { ReactiveCollection } from "@core/reactive-collection";
import { vint } from "@core/values";

describe("ReactiveCollection", () => {
  it("initializes empty", () => {
    const c = new ReactiveCollection();
    expect(c.signal.value).toEqual([]);
  });

  it("initializes with values", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    expect(c.signal.value).toHaveLength(2);
  });

  describe("add / remove", () => {
    it("add pushes value", () => {
      const c = new ReactiveCollection();
      c.add(vint(5));
      expect(c.signal.value).toEqual([vint(5)]);
    });

    it("remove removes by equality", () => {
      const c = new ReactiveCollection([vint(1), vint(2), vint(3)]);
      c.remove(vint(2));
      expect(c.signal.value).toEqual([vint(1), vint(3)]);
    });

    it("remove non-existent does nothing", () => {
      const c = new ReactiveCollection([vint(1)]);
      c.remove(vint(99));
      expect(c.signal.value).toEqual([vint(1)]);
    });

    it("subscribe fires on add", () => {
      const c = new ReactiveCollection();
      const deltas: string[] = [];
      c.subscribe((d) => deltas.push(d.tag));
      c.add(vint(1));
      expect(deltas).toEqual(["ADD"]);
    });

    it("subscribe fires on remove", () => {
      const c = new ReactiveCollection([vint(1)]);
      const deltas: string[] = [];
      c.subscribe((d) => deltas.push(d.tag));
      c.remove(vint(1));
      expect(deltas).toEqual(["REMOVE"]);
    });

    it("addAll appends every element and emits one delta each", () => {
      const c = new ReactiveCollection([vint(1)]);
      const sz = c.size();
      const deltas: string[] = [];
      c.subscribe((d) => deltas.push(d.tag));
      c.addAll([vint(2), vint(3)]);
      expect(c.snapshot()).toEqual([vint(1), vint(2), vint(3)]);
      expect(deltas).toEqual(["ADD", "ADD"]);
      expect(sz.value).toBe(3);
      c.addAll([]);
      expect(sz.value).toBe(3);
    });

    it("removing a duplicate leaves the other occurrence removable", () => {
      const c = new ReactiveCollection([vint(7), vint(7), vint(9)]);
      const sz = c.size();
      c.remove(vint(7));
      expect(sz.value).toBe(2);
      c.remove(vint(7));
      expect(sz.value).toBe(1);
      expect(c.snapshot()).toEqual([vint(9)]);
      c.remove(vint(7));
      expect(sz.value).toBe(1);
    });

    it("unsubscribe works", () => {
      const c = new ReactiveCollection();
      const deltas: string[] = [];
      const unsub = c.subscribe((d) => deltas.push(d.tag));
      unsub();
      c.add(vint(1));
      expect(deltas).toEqual([]);
    });
  });

  describe("aggregates", () => {
    const c = new ReactiveCollection([vint(10), vint(20), vint(30), vint(40)]);

    it("forAll", () => {
      expect(c.forAll((v) => (v.tag === "VInt" ? v.n > 0 : null)).value).toBe(true);
      expect(c.forAll((v) => (v.tag === "VInt" ? v.n > 25 : null)).value).toBe(false);
    });

    it("exists", () => {
      expect(c.exists((v) => (v.tag === "VInt" ? v.n > 35 : null)).value).toBe(true);
      expect(c.exists((v) => (v.tag === "VInt" ? v.n > 100 : null)).value).toBe(false);
    });

    it("one", () => {
      expect(c.one((v) => (v.tag === "VInt" ? v.n === 10 : null)).value).toBe(true);
      expect(c.one((v) => (v.tag === "VInt" ? v.n > 0 : null)).value).toBe(false);
    });

    it("size", () => {
      expect(c.size().value).toBe(4);
    });

    it("isEmpty / notEmpty", () => {
      expect(c.isEmpty().value).toBe(false);
      expect(c.notEmpty().value).toBe(true);
      const empty = new ReactiveCollection();
      expect(empty.isEmpty().value).toBe(true);
      expect(empty.notEmpty().value).toBe(false);
    });

    it("sum", () => {
      expect(c.sum().value).toBe(100);
    });

    it("isUnique", () => {
      const d = new ReactiveCollection([vint(1), vint(2), vint(3)]);
      expect(d.isUnique((v) => (v.tag === "VInt" ? v.n : null)).value).toBe(true);
      const dup = new ReactiveCollection([vint(1), vint(2), vint(1)]);
      expect(dup.isUnique((v) => (v.tag === "VInt" ? v.n : null)).value).toBe(false);
    });
  });

  describe("view-producing", () => {
    it("select filters", () => {
      const c = new ReactiveCollection([vint(1), vint(2), vint(3), vint(4)]);
      const sel = c.select((v) => (v.tag === "VInt" ? v.n > 2 : null));
      expect(sel.signal.value).toEqual([vint(3), vint(4)]);
    });

    it("reject filters inverse", () => {
      const c = new ReactiveCollection([vint(1), vint(2), vint(3)]);
      const rej = c.reject((v) => (v.tag === "VInt" ? v.n > 1 : null));
      expect(rej.signal.value).toEqual([vint(1)]);
    });

    it("collect maps", () => {
      const c = new ReactiveCollection([vint(1), vint(2)]);
      const col = c.collect((v) => (v.tag === "VInt" ? vint(v.n * 10) : null));
      expect(col.signal.value).toEqual([vint(10), vint(20)]);
    });
  });

  describe("delta reactivity", () => {
    it("forAll updates on add", () => {
      const c = new ReactiveCollection([vint(10), vint(20)]);
      const fa = c.forAll((v) => (v.tag === "VInt" ? v.n > 0 : null));
      expect(fa.value).toBe(true);
      c.add(vint(-5));
      expect(fa.value).toBe(false);
    });

    it("exists updates on add", () => {
      const c = new ReactiveCollection([vint(1)]);
      const ex = c.exists((v) => (v.tag === "VInt" ? v.n > 10 : null));
      expect(ex.value).toBe(false);
      c.add(vint(20));
      expect(ex.value).toBe(true);
    });

    it("size updates on add/remove", () => {
      const c = new ReactiveCollection([vint(1)]);
      const sz = c.size();
      expect(sz.value).toBe(1);
      c.add(vint(2));
      expect(sz.value).toBe(2);
      c.remove(vint(1));
      expect(sz.value).toBe(1);
    });

    it("sum updates on add", () => {
      const c = new ReactiveCollection([vint(5)]);
      const s = c.sum();
      expect(s.value).toBe(5);
      c.add(vint(10));
      expect(s.value).toBe(15);
    });

    it("isUnique updates", () => {
      const c = new ReactiveCollection([vint(1), vint(2)]);
      const u = c.isUnique((v) => (v.tag === "VInt" ? v.n : null));
      expect(u.value).toBe(true);
      c.add(vint(1));
      expect(u.value).toBe(false);
    });
  });
});

describe("reactive-collection internal paths", () => {
  it("select view reacts to ADDs after init", () => {
    const src = new ReactiveCollection([vint(1), vint(3)]);
    const view = src.select((v) => (v.tag === "VInt" ? v.n > 2 : null));
    expect(view.signal.value).toEqual([vint(3)]);
    src.add(vint(5));
    expect(view.signal.value).toEqual([vint(3), vint(5)]);
  });

  it("select view reacts to REMOVEs after init", () => {
    const src = new ReactiveCollection([vint(1), vint(3), vint(5)]);
    const view = src.select((v) => (v.tag === "VInt" ? v.n > 2 : null));
    src.remove(vint(3));
    expect(view.signal.value).toEqual([vint(5)]);
  });

  it("collect view reacts to ADDs", () => {
    const src = new ReactiveCollection([vint(1)]);
    const view = src.collect((v) => (v.tag === "VInt" ? vint(v.n * 10) : null));
    src.add(vint(2));
    expect(view.signal.value).toEqual([vint(10), vint(20)]);
  });

  it("forAll / exists reactively update on remove", () => {
    const src = new ReactiveCollection([vint(-1), vint(5)]);
    const fa = src.forAll((v) => (v.tag === "VInt" ? v.n > 0 : null));
    expect(fa.value).toBe(false);
    src.remove(vint(-1));
    expect(fa.value).toBe(true);

    const src2 = new ReactiveCollection([vint(99), vint(1)]);
    const ex = src2.exists((v) => (v.tag === "VInt" ? v.n > 50 : null));
    src2.remove(vint(99));
    expect(ex.value).toBe(false);
  });

  it("isUnique reacts on remove / null key", () => {
    const src = new ReactiveCollection([vint(1), vint(1)]);
    const u = src.isUnique((v) => (v.tag === "VInt" ? v.n : null));
    expect(u.value).toBe(false);
    src.remove(vint(1));
    expect(u.value).toBe(true);

    const src2 = new ReactiveCollection([vint(1)]);
    expect(src2.isUnique((_v) => null).value).toBe(true);
  });

  it("select ADD/REMOVE with false predicate", () => {
    const src = new ReactiveCollection([vint(1)]);
    const view = src.select((v) => (v.tag === "VInt" ? v.n > 10 : null));
    src.add(vint(5));
    expect(view.signal.value).toEqual([]);

    const src2 = new ReactiveCollection([vint(1), vint(20)]);
    const view2 = src2.select((v) => (v.tag === "VInt" ? v.n > 10 : null));
    src2.remove(vint(1));
    expect(view2.signal.value).toEqual([vint(20)]);
  });

  it("one / isEmpty / notEmpty subscribe ADD", () => {
    const c = new ReactiveCollection([vint(1), vint(2)]);
    const o = c.one((v) => (v.tag === "VInt" ? v.n > 0 : null));
    expect(o.value).toBe(false); // 2 match
    c.add(vint(3));
    expect(o.value).toBe(false); // 3 match, still not 1

    const empty = new ReactiveCollection([]);
    const e = empty.isEmpty();
    expect(e.value).toBe(true);
    empty.add(vint(1));
    expect(e.value).toBe(false);

    const ne = empty.notEmpty();
    expect(ne.value).toBe(true);
    empty.remove(vint(1));
    expect(ne.value).toBe(false);
  });
});
