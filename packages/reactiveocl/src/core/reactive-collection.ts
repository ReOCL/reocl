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
import { valuesEqual, valKey } from "./values";

type Pred = (v: OCLVal) => boolean | null;
type Mapper = (v: OCLVal) => OCLVal | null;
type KeyFn = (v: OCLVal) => string | number | null;

export class ReactiveCollection {
  private _values: OCLVal[] = [];
  private _version: Signal<number> = signal(0);
  private subscribers = new Set<DeltaSubscriber>();

  private _index: Map<string, number> = new Map();

  constructor(initial?: OCLVal[]) {
    if (initial?.length) {
      this._values = initial.slice();
      for (let i = 0; i < this._values.length; i++) {
        this._index.set(valKey(this._values[i]!), i);
      }
    }
  }

  snapshot(): readonly OCLVal[] {
    return this._values;
  }

  get value(): OCLVal[] {
    return this._values;
  }

  get signal(): ReadonlySignal<OCLVal[]> {
    return computed(() => {
      void this._version.value;
      return this._values.slice();
    });
  }

  version(): ReadonlySignal<number> {
    return this._version;
  }

  add(v: OCLVal): void {
    batch(() => {
      this._index.set(valKey(v), this._values.length);
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
        this._index.set(valKey(v), this._values.length);
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
      const idx = this._index.get(valKey(v));
      if (idx !== undefined) {
        this._removeAt(idx);
      } else if (v.tag !== "VObj") {
        // Objects are always indexed, so a miss means "not a member".
        this._removeByScan(v);
      }
    });
  }

  /** Swap-remove the element at `idx`, keeping the key index consistent. */
  private _removeAt(idx: number): void {
    const removed = this._values[idx]!;
    const lastIdx = this._values.length - 1;

    // Delete first, so that a duplicate moved into `idx` re-registers its key.
    this._index.delete(valKey(removed));

    if (idx !== lastIdx) {
      const last = this._values[lastIdx]!;
      this._values[idx] = last;
      this._index.set(valKey(last), idx);
    }

    this._values.pop();
    this._version.value++;

    for (const sub of this.subscribers) {
      sub({ tag: "REMOVE", val: removed });
    }
  }

  private _removeByScan(v: OCLVal): void {
    const idx = this._values.findIndex((w) => valuesEqual(w, v));
    if (idx === -1) return;
    this._removeAt(idx);
  }

  subscribe(fn: DeltaSubscriber): () => void {
    this.subscribers.add(fn);
    return () => void this.subscribers.delete(fn);
  }

  select(p: Pred): ReactiveCollection {
    const result = new ReactiveCollection();
    for (const v of this.snapshot()) {
      const b = p(v);
      if (b === true) result.add(v);
    }
    this.subscribe((d: Delta) => {
      if (d.tag === "ADD") {
        const b = p(d.val);
        if (b === true) result.add(d.val);
      } else {
        const b = p(d.val);
        if (b === true) result.remove(d.val);
      }
    });
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
    this.subscribe((d: Delta) => {
      if (d.tag === "ADD") {
        const w = f(d.val);
        if (w !== null) result.add(w);
      } else {
        const w = f(d.val);
        if (w !== null) result.remove(w);
      }
    });
    return result;
  }

  /** ForAllAggregate: violators are counted, so the result is a zero test. */
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

  /** MatchingAggregate: matches are counted, so the result is a positivity test. */
  exists(p: Pred): ReadonlySignal<boolean> {
    const agg: MatchingAggregate = { matchingCount: 0 };
    for (const v of this.snapshot()) {
      if (p(v) === true) agg.matchingCount++;
    }
    const result = signal(agg.matchingCount > 0);
    this.subscribe((d: Delta) => {
      if (p(d.val) === true) {
        if (d.tag === "ADD") agg.matchingCount++;
        else agg.matchingCount--;
      }
      result.value = agg.matchingCount > 0;
    });
    return result;
  }

  /** MatchingAggregate: the same count, read back as an equality with one. */
  one(p: Pred): ReadonlySignal<boolean> {
    const agg: MatchingAggregate = { matchingCount: 0 };
    for (const v of this.snapshot()) {
      if (p(v) === true) agg.matchingCount++;
    }
    const result = signal(agg.matchingCount === 1);
    this.subscribe((d: Delta) => {
      if (p(d.val) === true) {
        if (d.tag === "ADD") agg.matchingCount++;
        else agg.matchingCount--;
      }
      result.value = agg.matchingCount === 1;
    });
    return result;
  }

  /** SizeAggregate: a counter, also read back by isEmpty and notEmpty. */
  size(): ReadonlySignal<number> {
    const agg: SizeAggregate = { size: this._values.length };
    const result = signal(agg.size);
    this.subscribe((d: Delta) => {
      if (d.tag === "ADD") agg.size++;
      else agg.size--;
      result.value = agg.size;
    });
    return result;
  }

  /**
   * Running total: non-integer elements are ignored and the result is always
   * defined. Incremental maintenance is exact for integer collections, which is
   * what the typing of sum requires of the source collection.
   */
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
    const agg: SizeAggregate = { size: this._values.length };
    const result = signal(agg.size === 0);
    this.subscribe((d: Delta) => {
      if (d.tag === "ADD") agg.size++;
      else agg.size--;
      result.value = agg.size === 0;
    });
    return result;
  }

  notEmpty(): ReadonlySignal<boolean> {
    const agg: SizeAggregate = { size: this._values.length };
    const result = signal(agg.size > 0);
    this.subscribe((d: Delta) => {
      if (d.tag === "ADD") agg.size++;
      else agg.size--;
      result.value = agg.size > 0;
    });
    return result;
  }

  /** IsUniqueAggregate: per-key occurrence counts, plus the duplicated-key count. */
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
