import {
  attendeeCount$,
  eagerMedianMs$,
  eagerMs$,
  lastDeltas$,
  reoclMedianMs$,
  reoclMs$,
  snapshotMs$,
} from "@/tabs/registration/model";

function ms(n: number): string {
  if (n === 0) return "-";
  return n < 1 ? `${(n * 1000).toFixed(0)} µs` : `${n.toFixed(1)} ms`;
}

export function EngineRace() {
  const reocl = reoclMedianMs$.value;
  const eager = eagerMedianMs$.value;
  const speedup = reocl > 0 ? eager / reocl : 0;

  return (
    <div class="border rounded p-3 mt-3 bg-light">
      <div class="d-flex justify-content-between align-items-baseline mb-2">
        <span class="fw-bold">
          Per click, over {attendeeCount$.value.toLocaleString()} attendees
        </span>
        <span class="text-secondary small">
          last edit: {lastDeltas$.value} delta{lastDeltas$.value === 1 ? "" : "s"} ·{" "}
          {ms(reoclMs$.value)} vs {ms(eagerMs$.value)}
        </span>
      </div>

      <div class="row text-center g-2">
        <div class="col">
          <div class="text-secondary small">ReOCL</div>
          <div class="fs-4 fw-bold text-success">{ms(reocl)}</div>
          <div class="text-secondary small">O(1) per delta</div>
        </div>
        <div class="col">
          <div class="text-secondary small">eager rescan</div>
          <div class="fs-4 fw-bold text-danger">{ms(eager)}</div>
          <div class="text-secondary small">O(N) per change</div>
        </div>
        <div class="col">
          <div class="text-secondary small">speedup</div>
          <div class="fs-4 fw-bold">{speedup > 0 ? `${speedup.toFixed(0)}×` : "-"}</div>
          <div class="text-secondary small">median of 15</div>
        </div>
      </div>

      <div class="form-text mt-2 mb-0">
        Cancel is free here too: the eager engine had to copy the whole attendee list at session
        start ({ms(snapshotMs$.value)}) because it has nothing else to restore from, while ReOCL
        records only what the transaction touches.
      </div>
    </div>
  );
}
