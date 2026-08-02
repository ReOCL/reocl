import type { ReactiveObject } from "reactiveocl";
import {
  BUDGET_STEP,
  BULK_SIZES,
  MAX_ATTENDEES,
  MAX_CONTRACTORS,
  POOL_PAGE,
  PASS_PRICE,
  SEAT_PRICE,
  STEPS,
  type Step,
} from "@/tabs/registration/config";
import {
  allAccreditedOk$,
  attendeeCount$,
  attendees$,
  confirm,
  contractorCapOk$,
  contractorCount$,
  cost$,
  enrol,
  goTo,
  isPicked,
  open$,
  pool,
  query$,
  raiseBudget,
  reg,
  seatsAffordable$,
  setPasses,
  setTeam,
  step$,
  teamNamedOk$,
  teamSizeOk$,
  toggleAttendee,
  withinBudgetOk$,
} from "@/tabs/registration/model";

function Meter({
  label,
  value,
  limit,
  ok,
  format = (n: number) => n.toLocaleString(),
}: {
  label: string;
  value: number;
  limit: number;
  ok: boolean;
  format?: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  return (
    <div class="mb-3">
      <div class="d-flex justify-content-between small mb-1">
        <span class="text-secondary">{label}</span>
        <span class={`fw-bold ${ok ? "" : "text-danger"}`}>
          {format(value)} / {format(limit)}
        </span>
      </div>
      <div class="progress" style={{ height: "0.5rem" }}>
        <div
          class={`progress-bar ${ok ? "bg-success" : "bg-danger"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div class="mb-4">
      <div class="d-flex mb-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            class="btn btn-link flex-fill text-center text-decoration-none p-0"
            onClick={() => goTo(i as Step)}
          >
            <span
              class={`badge rounded-pill d-block mx-auto mb-1 ${
                i === step ? "text-bg-primary" : i < step ? "text-bg-success" : "text-bg-light"
              }`}
              style={{ width: "1.75rem", height: "1.75rem", lineHeight: "1.35rem" }}
            >
              {i + 1}
            </span>
            <span class={`small ${i === step ? "fw-bold text-body" : "text-secondary"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
      <div class="progress" style={{ height: "0.25rem" }}>
        <div class="progress-bar" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}

function Details() {
  return (
    <div>
      <div class="mb-3">
        <label class="form-label">Team name</label>
        <input
          class={`form-control ${teamNamedOk$.value ? "" : "is-invalid"}`}
          value={reg.team$.value}
          placeholder="e.g. Platform"
          onInput={(e) => setTeam(e.currentTarget.value)}
        />
        <div class="invalid-feedback">Enter a name for the team attending.</div>
      </div>

      <label class="form-label">Approved budget</label>
      <div class="input-group mb-1">
        <span class="input-group-text">€</span>
        <input class="form-control" readonly value={reg.budget$.value.toLocaleString()} />
        <button class="btn btn-outline-secondary" onClick={raiseBudget}>
          Request +€{BUDGET_STEP.toLocaleString()}
        </button>
      </div>
      <div class="form-text mb-3">Approved increases apply from your next registration.</div>

      <ul class="list-group list-group-flush">
        <li class="list-group-item d-flex justify-content-between px-0">
          <span class="text-secondary">Seats you can afford</span>
          <span class="fw-bold">{seatsAffordable$.value.toLocaleString()}</span>
        </li>
        <li class="list-group-item d-flex justify-content-between px-0">
          <span class="text-secondary">Price per seat</span>
          <span class="fw-bold">€{SEAT_PRICE}</span>
        </li>
      </ul>
    </div>
  );
}

function Attendees() {
  const q = query$.value.toLowerCase();
  const matches = (q ? pool.filter((o) => o.str("name").toLowerCase().includes(q)) : pool).slice(
    0,
    POOL_PAGE,
  );

  return (
    <div>
      <div class="input-group mb-3">
        <span class="input-group-text">Search</span>
        <input
          class="form-control"
          placeholder="Find people by name"
          value={query$.value}
          onInput={(e) => (query$.value = e.currentTarget.value)}
        />
        {BULK_SIZES.map((n) => (
          <button key={n} class="btn btn-outline-primary" onClick={() => enrol(n)}>
            Add {n.toLocaleString()}
          </button>
        ))}
      </div>

      <div class="d-flex flex-wrap gap-2 mb-3">
        {matches.map((o) => {
          const picked = isPicked(o);
          return (
            <button
              key={`${o.classId}:${o.oid}`}
              class={`btn btn-sm ${picked ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => toggleAttendee(o)}
            >
              {o.str("name")}
              {o.oclIsTypeOf("Contractor") && (
                <span class="badge text-bg-warning ms-2">contractor</span>
              )}
              {!o.bool("accredited") && <span class="badge text-bg-danger ms-2">unaccredited</span>}
            </button>
          );
        })}
      </div>

      <Meter
        label="Attendees"
        value={attendeeCount$.value}
        limit={MAX_ATTENDEES}
        ok={teamSizeOk$.value}
      />
      <Meter
        label="Contractors"
        value={contractorCount$.value}
        limit={MAX_CONTRACTORS}
        ok={contractorCapOk$.value}
      />
      {!allAccreditedOk$.value && (
        <div class="alert alert-danger py-2 mb-0">
          Someone selected is not accredited and cannot attend.
        </div>
      )}
    </div>
  );
}

function Extras() {
  const ok = withinBudgetOk$.value;
  return (
    <div>
      <label class="form-label">Workshop passes</label>
      <div class="input-group mb-3">
        <input
          type="number"
          class={`form-control ${ok ? "" : "is-invalid"}`}
          value={reg.passes$.value}
          onInput={(e) => setPasses(Number(e.currentTarget.value))}
        />
        <span class="input-group-text">× €{PASS_PRICE}</span>
        <div class="invalid-feedback">This takes the registration over the approved budget.</div>
      </div>

      <Meter
        label="Total cost"
        value={cost$.value}
        limit={reg.obj.preInt("budget")}
        ok={ok}
        format={(n) => `€${n.toLocaleString()}`}
      />
    </div>
  );
}

function Review() {
  const picked = attendees$.objects.value as ReactiveObject[];
  const rows: [string, string][] = [
    ["Team", reg.team$.value || "(unnamed)"],
    ["Attendees", attendeeCount$.value.toLocaleString()],
    ["Contractors", contractorCount$.value.toLocaleString()],
    ["Workshop passes", String(reg.passes$.value)],
    ["Total cost", `€${cost$.value.toLocaleString()}`],
    ["Approved budget", `€${reg.obj.preInt("budget").toLocaleString()}`],
  ];

  return (
    <div>
      <ul class="list-group mb-3">
        {rows.map(([k, v]) => (
          <li key={k} class="list-group-item d-flex justify-content-between">
            <span class="text-secondary">{k}</span>
            <span class="fw-bold">{v}</span>
          </li>
        ))}
      </ul>
      <div class="d-flex flex-wrap gap-1">
        {picked.slice(0, 40).map((o) => (
          <span key={`${o.classId}:${o.oid}`} class="badge text-bg-light border">
            {o.str("name")}
          </span>
        ))}
        {picked.length > 40 && (
          <span class="badge text-bg-secondary">+{(picked.length - 40).toLocaleString()} more</span>
        )}
      </div>
    </div>
  );
}

export function Wizard() {
  if (!open$.value) {
    return (
      <div class="text-center text-secondary py-5">
        <p class="mb-0">No registration in progress.</p>
        <p class="mb-0">Start one to begin.</p>
      </div>
    );
  }

  const step = step$.value;
  const last = step === STEPS.length - 1;

  return (
    <div>
      <Stepper step={step} />
      {step === 0 && <Details />}
      {step === 1 && <Attendees />}
      {step === 2 && <Extras />}
      {step === 3 && <Review />}

      <div class="btn-group w-100 mt-4">
        <button
          class="btn btn-outline-secondary"
          disabled={step === 0}
          onClick={() => goTo((step - 1) as Step)}
        >
          Back
        </button>
        {last ? (
          <button class="btn btn-success" onClick={confirm}>
            Confirm registration
          </button>
        ) : (
          <button class="btn btn-outline-primary" onClick={() => goTo((step + 1) as Step)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
