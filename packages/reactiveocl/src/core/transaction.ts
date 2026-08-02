import { batch, untracked, type ReadonlySignal } from "./signal";
import { Store, type Heap } from "./store";

let begun: Transaction[] = [];

let recordingJournal: (() => void)[] | null = null;

let replaying = 0;

export function recordUndo(undo: () => void): void {
  if (replaying > 0) return;
  if (recordingJournal) {
    recordingJournal.push(undo);
  } else {
    begun[begun.length - 1]?.recordUndo(undo);
  }
}

export function $pre(sid: string): ReturnType<Store["read"]> {
  return begun[begun.length - 1]?.$pre(sid);
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
    if (this.heap) throw new Error("Transaction already begun");
    this.heap = this.store.beginRecording();
    this.journal = [];
    begun.push(this);
  }

  mutate(fn: () => void): void {
    if (!this.heap) throw new Error("Transaction not begun - call begin() first");
    const prev = recordingJournal;
    recordingJournal = this.journal;
    try {
      batch(() => fn());
    } finally {
      recordingJournal = prev;
    }
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

  recordUndo(undo: () => void): void {
    if (this.journal) this.journal.push(undo);
  }

  private finish(): { heap: Heap; journal: (() => void)[] } {
    const top = begun[begun.length - 1];
    if (top !== this) {
      throw new Error("Transaction finished out of order");
    }
    begun.pop();
    const heap = this.heap!;
    const journal = this.journal ?? [];
    this.store.endRecording();
    this.heap = null;
    this.journal = null;
    return { heap, journal };
  }

  private undo(heap: Heap, journal: (() => void)[]): void {
    this.store.restore(heap);
    replaying++;
    try {
      batch(() => {
        for (let i = journal.length - 1; i >= 0; i--) journal[i]!();
      });
    } finally {
      replaying--;
    }
  }

  $pre(sid: string): ReturnType<Store["read"]> {
    if (!this.heap) return undefined;
    return this.heap.get(sid) ?? this.store.read(sid);
  }
}
