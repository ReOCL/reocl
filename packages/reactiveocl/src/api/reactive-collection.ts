import { ReactiveCollection } from "@core/reactive-collection";
import { batch, computed, type ReadonlySignal } from "@core/signal";
import { recordUndo } from "@core/transaction";
import type { OCLVal } from "@core/values";
import { vint } from "@core/values";
import { ReactiveObject } from "./reactive-object";

function key(obj: ReactiveObject): string {
  return `${obj.classId}:${obj.oid}`;
}

export class TypedReactiveCollection<T = ReactiveObject> {
  private coll: ReactiveCollection;
  private _map: Map<string, ReactiveObject> = new Map();
  private _objects: ReadonlySignal<T[]>;
  private _wrap: (obj: ReactiveObject) => T;

  constructor(initial: ReactiveObject[], wrap?: (obj: ReactiveObject) => T) {
    this._wrap = wrap ?? ((o: ReactiveObject) => o as unknown as T);
    for (const o of initial) this._map.set(key(o), o);
    this.coll = new ReactiveCollection(initial.map((o) => o.toVal()));
    this._objects = computed(() => {
      void this.coll.version().value;
      return Array.from(this._map.values(), (o) => this._wrap(o));
    });
  }

  get objects(): ReadonlySignal<T[]> {
    return this._objects;
  }

  numbers(): ReadonlySignal<number[]> {
    return computed(() => {
      void this.coll.version().value;
      return this.coll
        .snapshot()
        .filter((v) => v.tag === "VInt")
        .map((v) => v.n);
    });
  }

  wrapAs<U>(factory: (obj: ReactiveObject) => U): TypedReactiveCollection<U> {
    const t = new TypedReactiveCollection<U>([], factory);
    t._map = this._map;
    t.coll = this.coll;
    t._objects = computed(() => {
      void t.coll.version().value;
      return Array.from(t._map.values(), factory);
    });
    return t;
  }

  add(obj: ReactiveObject): void {
    this._map.set(key(obj), obj);
    this.coll.add(obj.toVal());
    recordUndo(() => this.removeByOid(obj.classId, obj.oid));
  }

  addAll(objs: ReactiveObject[]): void {
    for (const obj of objs) {
      this._map.set(key(obj), obj);
    }
    this.coll.addAll(objs.map((o) => o.toVal()));
    recordUndo(() => {
      for (const obj of objs) this.removeByOid(obj.classId, obj.oid);
    });
  }

  removeByOid(classId: string, oid: number): void {
    const k = `${classId}:${oid}`;
    const obj = this._map.get(k);
    if (!obj) return;
    batch(() => {
      this.coll.remove(obj.toVal());
      this._map.delete(k);
    });
    recordUndo(() => this.add(obj));
  }

  private objFrom(v: OCLVal): ReactiveObject | undefined {
    if (v.tag !== "VObj") return undefined;
    return this._map.get(`${v.classId}:${v.oid}`);
  }

  forAll(pred: (obj: T) => boolean | null): ReadonlySignal<boolean> {
    return this.coll.forAll((v) => {
      const obj = this.objFrom(v);
      return obj ? pred(this._wrap(obj)) : null;
    });
  }

  exists(pred: (obj: T) => boolean | null): ReadonlySignal<boolean> {
    return this.coll.exists((v) => {
      const obj = this.objFrom(v);
      return obj ? pred(this._wrap(obj)) : null;
    });
  }

  one(pred: (obj: T) => boolean | null): ReadonlySignal<boolean> {
    return this.coll.one((v) => {
      const obj = this.objFrom(v);
      return obj ? pred(this._wrap(obj)) : null;
    });
  }

  isUnique(keyFn: (obj: T) => string | number | null): ReadonlySignal<boolean> {
    return this.coll.isUnique((v) => {
      const obj = this.objFrom(v);
      return obj ? keyFn(this._wrap(obj)) : null;
    });
  }

  size(): ReadonlySignal<number> {
    return this.coll.size();
  }
  sum(): ReadonlySignal<number> {
    return this.coll.sum();
  }
  isEmpty(): ReadonlySignal<boolean> {
    return this.coll.isEmpty();
  }
  notEmpty(): ReadonlySignal<boolean> {
    return this.coll.notEmpty();
  }

  select(pred: (obj: T) => boolean | null): TypedReactiveCollection<T> {
    const wrap = this._wrap;
    const t = new TypedReactiveCollection<T>([], wrap);
    t._map = this._map;
    t.coll = this.coll.select((v) => {
      const obj = this.objFrom(v);
      return obj ? pred(wrap(obj)) : null;
    });
    t._objects = computed(() => {
      void t.coll.version().value;
      const objs: T[] = [];
      for (const v of t.coll.snapshot()) {
        const obj = t.objFrom(v);
        if (obj) objs.push(wrap(obj));
      }
      return objs;
    });
    return t;
  }

  collect(fn: (obj: T) => number | null): TypedReactiveCollection {
    const t = new TypedReactiveCollection([]);
    t._map = this._map;
    t.coll = this.coll.collect((v) => {
      const obj = this.objFrom(v);
      if (!obj) return null;
      const n = fn(this._wrap(obj));
      return n === null ? null : vint(n);
    });
    t._objects = computed(() => {
      void t.coll.version().value;
      const objs: ReactiveObject[] = [];
      for (const v of t.coll.snapshot()) {
        const obj = t.objFrom(v);
        if (obj) objs.push(obj);
      }
      return objs;
    });
    return t;
  }
}
