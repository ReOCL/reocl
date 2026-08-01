// A transaction groups mutations of a store, records the pre-state they
// overwrite, and enforces the watched invariants when it commits: begin, then
// any number of mutations, then a commit that either keeps the new state or
// rolls the store back.

import { batch, untracked, type ReadonlySignal } from "./signal";
import { Store, type Heap } from "./store";

/** Global pre-state of the running transaction - set by Transaction.begin(),
 *  cleared by commit/rollback. Invariant signals read @pre values through it. */
let currentPre: { heap: Heap; store: Store } | null = null;

/**
 * Read a pre-state value from the running transaction.
 *
 * The heap only records locations that the transaction mutated, so a miss means
 * the store still holds the pre-transaction value. Reads therefore agree with a
 * full snapshot taken at transaction begin. Outside a transaction there is no
 * pre-state, hence undefined.
 */
export function $pre(sid: string): ReturnType<Store["read"]> {
  if (!currentPre) return undefined;
  return currentPre.heap.get(sid) ?? currentPre.store.read(sid);
}

export class Transaction {
  private store: Store;
  private heap: Heap | null = null;
  private watched = new Set<ReadonlySignal<boolean>>();

  constructor(store: Store) {
    this.store = store;
  }

  /** Register a watched invariant signal. */
  watch(inv: ReadonlySignal<boolean>): void {
    this.watched.add(inv);
  }

  /** The pre-state heap of the running transaction, or null outside one. */
  get preHeap(): Heap | null {
    return this.heap;
  }

  /**
   * Begin a transaction: start recording pre-state, set global heap for @pre reads.
   * The heap is filled lazily, as mutations happen; locations that are never
   * mutated keep their pre-state value in the store itself.
   */
  begin(): void {
    this.heap = this.store.beginRecording();
    currentPre = { heap: this.heap, store: this.store };
  }

  /** Apply mutations inside a batch. */
  mutate(fn: () => void): void {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    batch(() => fn());
  }

  /**
   * Commit the transaction.
   * Returns true if all invariants are valid, false if rolled back.
   */
  commit(): boolean {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    const allValid = untracked(() => {
      for (const inv of this.watched) {
        if (!inv.value) return false;
      }
      return true;
    });

    this.store.endRecording();

    if (allValid) {
      currentPre = null;
      this.heap = null;
      return true;
    } else {
      this.store.restore(this.heap);
      currentPre = null;
      this.heap = null;
      return false;
    }
  }

  /** Read pre-state value for a store cell during this transaction. */
  $pre(sid: string): ReturnType<Store["read"]> {
    if (!this.heap) return undefined;
    return this.heap.get(sid) ?? this.store.read(sid);
  }
}
