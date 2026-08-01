import { batch, signal, untracked, type Signal } from "./signal";
import { fieldStateId, type ClassId, type FieldId, type StateId } from "./types";
import type { OCLVal } from "./values";

/** A reactive store: maps state identifiers to mutable signals. */
export class Store {
  private readonly cells: Map<StateId, Signal<OCLVal>>;
  private recorder: Heap | null;

  constructor() {
    this.cells = new Map();
    this.recorder = null;
  }

  register(C: ClassId, oid: number, f: FieldId, initial: OCLVal): Signal<OCLVal> {
    const sid = fieldStateId(C, oid, f);
    const s = signal(initial);
    this.cells.set(sid, s);
    return s;
  }

  read(sid: StateId): OCLVal | undefined {
    return this.cells.get(sid)?.value;
  }

  getSignal(sid: StateId): Signal<OCLVal> | undefined {
    return this.cells.get(sid);
  }

  /** Write a value to a registered store cell, recording its pre-state first. */
  write(sid: StateId, val: OCLVal): void {
    const cell = this.cells.get(sid);
    if (!cell) throw new Error(`Cannot write to unregistered state cell "${sid}"`);
    this.record(sid, cell);
    cell.value = val;
  }

  /**
   * Start recording pre-state values lazily: the returned heap grows to hold the
   * value each mutated cell had when the recording started. This captures the
   * pre-state without copying unmutated locations - an unrecorded location is one
   * whose current value still is its pre-state value.
   */
  beginRecording(): Heap {
    this.recorder = new Map();
    return this.recorder;
  }

  endRecording(): void {
    this.recorder = null;
  }

  /** Record the pre-mutation value of a cell, the first time it is written. */
  private record(sid: StateId, cell: Signal<OCLVal>): void {
    if (!this.recorder || this.recorder.has(sid)) return;
    this.recorder.set(
      sid,
      untracked(() => cell.value),
    );
  }

  /** Create a snapshot (Heap) of all current store values. */
  snapshot(): Heap {
    const h = new Map<StateId, OCLVal>();
    for (const [sid, cell] of this.cells) {
      h.set(
        sid,
        untracked(() => cell.value),
      );
    }
    return h;
  }

  /** Restore store cells from a heap snapshot. */
  restore(heap: Heap): void {
    batch(() => {
      for (const [sid, val] of heap) {
        const cell = this.cells.get(sid);
        if (cell) cell.value = val;
      }
    });
  }
}

/** A heap / snapshot: maps state identifiers to pre-transaction values. */
export type Heap = Map<StateId, OCLVal>;

/** Full snapshot: every state id maps to its current value. */
export function fullSnapshot(store: Store): Heap {
  return store.snapshot();
}

/** Restore: for each sid in the heap set the store, otherwise keep the store. */
export function restore(store: Store, heap: Heap): void {
  store.restore(heap);
}

export { fieldStateId };
