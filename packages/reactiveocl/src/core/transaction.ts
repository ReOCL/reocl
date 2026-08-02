import { batch, untracked, type ReadonlySignal } from "./signal";
import { Store, type Heap } from "./store";

let currentPre: { heap: Heap; store: Store } | null = null;

let currentJournal: (() => void)[] | null = null;

export function recordUndo(undo: () => void): void {
  if (currentJournal) currentJournal.push(undo);
}

export function $pre(sid: string): ReturnType<Store["read"]> {
  if (!currentPre) return undefined;
  return currentPre.heap.get(sid) ?? currentPre.store.read(sid);
}

export class Transaction {
  private store: Store;
  private heap: Heap | null = null;
  private journal: (() => void)[] | null = null;
  private watched = new Set<ReadonlySignal<boolean>>();

  constructor(store: Store) {
    this.store = store;
  }

  watch(inv: ReadonlySignal<boolean>): void {
    this.watched.add(inv);
  }

  get preHeap(): Heap | null {
    return this.heap;
  }

  begin(): void {
    this.heap = this.store.beginRecording();
    this.journal = [];
    currentPre = { heap: this.heap, store: this.store };
    currentJournal = this.journal;
  }

  mutate(fn: () => void): void {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    batch(() => fn());
  }

  commit(): boolean {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    const allValid = untracked(() => {
      for (const inv of this.watched) {
        if (!inv.value) return false;
      }
      return true;
    });

    const { heap, journal } = this.finish();
    if (allValid) return true;
    this.undo(heap, journal);
    return false;
  }

  rollback(): void {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    const { heap, journal } = this.finish();
    this.undo(heap, journal);
  }

  private finish(): { heap: Heap; journal: (() => void)[] } {
    const heap = this.heap!;
    const journal = this.journal ?? [];
    this.store.endRecording();
    currentPre = null;
    currentJournal = null;
    this.heap = null;
    this.journal = null;
    return { heap, journal };
  }

  private undo(heap: Heap, journal: (() => void)[]): void {
    this.store.restore(heap);
    batch(() => {
      for (let i = journal.length - 1; i >= 0; i--) journal[i]!();
    });
  }

  $pre(sid: string): ReturnType<Store["read"]> {
    if (!this.heap) return undefined;
    return this.heap.get(sid) ?? this.store.read(sid);
  }
}
