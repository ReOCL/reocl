import { batch, signal, untracked, type Signal } from "./signal";
import { fieldStateId, type ClassId, type FieldId, type StateId } from "./types";
import type { OCLVal } from "./values";

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

  write(sid: StateId, val: OCLVal): void {
    const cell = this.cells.get(sid);
    if (!cell) throw new Error(`Cannot write to unregistered state cell "${sid}"`);
    this.record(sid, cell);
    cell.value = val;
  }

  beginRecording(): Heap {
    this.recorder = new Map();
    return this.recorder;
  }

  endRecording(): void {
    this.recorder = null;
  }

  private record(sid: StateId, cell: Signal<OCLVal>): void {
    if (!this.recorder || this.recorder.has(sid)) return;
    this.recorder.set(
      sid,
      untracked(() => cell.value),
    );
  }

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

  restore(heap: Heap): void {
    batch(() => {
      for (const [sid, val] of heap) {
        const cell = this.cells.get(sid);
        if (cell) cell.value = val;
      }
    });
  }
}

export type Heap = Map<StateId, OCLVal>;

export { fieldStateId };
