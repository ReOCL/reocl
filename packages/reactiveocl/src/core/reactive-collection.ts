import { batch, computed, signal, type ReadonlySignal, type Signal } from "./signal";
import type {
  Delta,
  DeltaSubscriber,
  ForAllAggregate,
  IsUniqueAggregate,
  MatchingAggregate,
  SizeAggregate,
  SumAggregate,
} from "./types";
import type { OCLVal } from "./values";
import { valKey } from "./values";

type Pred = (v: OCLVal) => boolean | null;
type Mapper = (v: OCLVal) => OCLVal | null;
type KeyFn = (v: OCLVal) => string | number | null;

export class ReactiveCollection {
  private _values: OCLVal[] = [];
  private _version: Signal<number> = signal(0);
  private subscribers = new Set<DeltaSubscriber>();

  private _index: Map<string, number[]> = new Map();

  private _teardown: (() => void)[] = [];

  private _signal?: ReadonlySignal<OCLVal[]>;

  constructor(initial?: OCLVal[]) {
    if (initial?.length) {
      this._values = initial.slice();
      for (let i = 0; i < this._values.length; i++) {
        this._indexAdd(valKey(this._values[i]!), i);
      }
    }
  }

  private _indexAdd(key: string, i: number): void {
    const at = this._index.get(key);
    if (at === undefined) this._index.set(key, [i]);
    else at.push(i);
  }

  private _indexDrop(key: string, i: number): void {
    const at = this._index.get(key);
    if (at === undefined) return;
    const pos = at.lastIndexOf(i);
    if (pos !== -1) at.splice(pos, 1);
    if (at.length === 0) this._index.delete(key);
  }

  private _indexMove(key: string, from: number, to: number): void {
    const at = this._index.get(key);
    if (at === undefined) return;
    const pos = at.lastIndexOf(from);
    if (pos !== -1) at[pos] = to;
  }

  private _positionOf(v: OCLVal): number | undefined {
    const at = this._index.get(valKey(v));
    return at !== undefined && at.length > 0 ? at[at.length - 1] : undefined;
  }

  snapshot(): readonly OCLVal[] {
    return this._values;
  }

  get value(): OCLVal[] {
    return this._values;
  }

  get signal(): ReadonlySignal<OCLVal[]> {
    if (this._signal === undefined) {
      this._signal = computed(() => {
        void this._version.value;
        return this._values.slice();
      });
    }
    return this._signal;
  }

  version(): ReadonlySignal<number> {
    return this._version;
  }

  add(v: OCLVal): void {
    batch(() => {
      this._indexAdd(valKey(v), this._values.length);
      this._values.push(v);
      this._version.value++;

      for (const sub of this.subscribers) {
        sub({ tag: "ADD", val: v });
      }
    });
  }

  addAll(vs: OCLVal[]): void {
    if (vs.length === 0) return;
    batch(() => {
      for (const v of vs) {
        this._indexAdd(valKey(v), this._values.length);
        this._values.push(v);
      }
      this._version.value++;

      for (const v of vs) {
        for (const sub of this.subscribers) {
          sub({ tag: "ADD", val: v });
        }
      }
    });
  }

  remove(v: OCLVal): void {
    batch(() => {
      const idx = this._positionOf(v);
      if (idx !== undefined) this._removeAt(idx);
    });
  }

  private _removeAt(idx: number): void {
    const removed = this._values[idx]!;
    const lastIdx = this._values.length - 1;

    this._indexDrop(valKey(removed), idx);

    if (idx !== lastIdx) {
      const last = this._values[lastIdx]!;
      this._values[idx] = last;
      this._indexMove(valKey(last), lastIdx, idx);
    }

    this._values.pop();
    this._version.value++;

    for (const sub of this.subscribers) {
      sub({ tag: "REMOVE", val: removed });
    }
  }

  subscribe(fn: DeltaSubscriber): () => void {
    this.subscribers.add(fn);
    return () => void this.subscribers.delete(fn);
  }

  dispose(): void {
    for (const off of this._teardown) off();
    this._teardown = [];
    this.subscribers.clear();
  }

  select(p: Pred): ReactiveCollection {
    const result = new ReactiveCollection();
    for (const v of this.snapshot()) {
      const b = p(v);
      if (b === true) result.add(v);
    }
    result._teardown.push(
      this.subscribe((d: Delta) => {
        if (d.tag === "ADD") {
          const b = p(d.val);
          if (b === true) result.add(d.val);
        } else {
          const b = p(d.val);
          if (b === true) result.remove(d.val);
        }
      }),
    );
    return result;
  }

  reject(p: Pred): ReactiveCollection {
    return this.select((v) => {
      const b = p(v);
      return b === null ? null : !b;
    });
  }

  collect(f: Mapper): ReactiveCollection {
    const result = new ReactiveCollection();
    for (const v of this.snapshot()) {
      const w = f(v);
      if (w !== null) result.add(w);
    }
    result._teardown.push(
      this.subscribe((d: Delta) => {
        if (d.tag === "ADD") {
          const w = f(d.val);
          if (w !== null) result.add(w);
        } else {
          const w = f(d.val);
          if (w !== null) result.remove(w);
        }
      }),
    );
    return result;
  }

  forAll(p: Pred): ReadonlySignal<boolean> {
    const agg: ForAllAggregate = { violatingCount: 0 };
    for (const v of this.snapshot()) {
      if (p(v) !== true) agg.violatingCount++;
    }
    const result = signal(agg.violatingCount === 0);
    this.subscribe((d: Delta) => {
      if (p(d.val) !== true) {
        if (d.tag === "ADD") agg.violatingCount++;
        else agg.violatingCount--;
      }
      result.value = agg.violatingCount === 0;
    });
    return result;
  }

  private matchingCount(p: Pred, want: (n: number) => boolean): ReadonlySignal<boolean> {
    const agg: MatchingAggregate = { matchingCount: 0 };
    for (const v of this.snapshot()) {
      if (p(v) === true) agg.matchingCount++;
    }
    const result = signal(want(agg.matchingCount));
    this.subscribe((d: Delta) => {
      if (p(d.val) === true) {
        if (d.tag === "ADD") agg.matchingCount++;
        else agg.matchingCount--;
      }
      result.value = want(agg.matchingCount);
    });
    return result;
  }

  exists(p: Pred): ReadonlySignal<boolean> {
    return this.matchingCount(p, (n) => n > 0);
  }

  one(p: Pred): ReadonlySignal<boolean> {
    return this.matchingCount(p, (n) => n === 1);
  }

  private countProject<R>(project: (n: number) => R): ReadonlySignal<R> {
    const agg: SizeAggregate = { size: this._values.length };
    const result = signal(project(agg.size));
    this.subscribe((d: Delta) => {
      agg.size += d.tag === "ADD" ? 1 : -1;
      result.value = project(agg.size);
    });
    return result;
  }

  size(): ReadonlySignal<number> {
    return this.countProject((n) => n);
  }

  sum(): ReadonlySignal<number> {
    const agg: SumAggregate = { total: 0 };
    for (const v of this.snapshot()) {
      if (v.tag === "VInt") agg.total += v.n;
    }
    const result = signal(agg.total);
    this.subscribe((d: Delta) => {
      if (d.val.tag === "VInt") {
        if (d.tag === "ADD") agg.total += d.val.n;
        else agg.total -= d.val.n;
      }
      result.value = agg.total;
    });
    return result;
  }

  isEmpty(): ReadonlySignal<boolean> {
    return this.countProject((n) => n === 0);
  }

  notEmpty(): ReadonlySignal<boolean> {
    return this.countProject((n) => n > 0);
  }

  isUnique(kf: KeyFn): ReadonlySignal<boolean> {
    const agg: IsUniqueAggregate = { counts: new Map(), duplicates: 0 };
    for (const v of this.snapshot()) {
      const key = kf(v);
      if (key === null) continue;
      const c = agg.counts.get(key) ?? 0;
      agg.counts.set(key, c + 1);
      if (c === 1) agg.duplicates++;
    }
    const result = signal(agg.duplicates === 0);
    this.subscribe((d: Delta) => {
      const key = kf(d.val);
      if (key === null) return;
      const c = agg.counts.get(key) ?? 0;
      if (d.tag === "ADD") {
        agg.counts.set(key, c + 1);
        if (c === 1) agg.duplicates++;
      } else {
        agg.counts.set(key, c - 1);
        if (c - 1 === 0) agg.counts.delete(key);
        if (c === 2) agg.duplicates--;
      }
      result.value = agg.duplicates === 0;
    });
    return result;
  }
}
