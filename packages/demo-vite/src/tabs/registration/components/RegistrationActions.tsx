import { cancel, open$, outcome$, outcomeOk$, staged$, start } from "@/tabs/registration/model";

export function RegistrationActions() {
  const open = open$.value;

  return (
    <div class="card border-0 bg-primary text-white mb-3">
      <div class="card-header fw-bold border-light">Registration</div>
      <div class="card-body">
        {!open && (
          <>
            <p class="small mb-3">
              Register your team for the conference in four steps. You can cancel at any point and
              nothing is saved.
            </p>
            <button class="btn btn-light w-100" onClick={start}>
              Start registration
            </button>
          </>
        )}

        {open && (
          <>
            <div class="small mb-3">
              Unsaved changes: <strong>{staged$.value.toLocaleString()}</strong>
            </div>
            <button class="btn btn-outline-light w-100" onClick={cancel}>
              Cancel registration
            </button>
          </>
        )}

        {outcome$.value && (
          <div
            class={`alert py-2 mb-0 mt-3 ${outcomeOk$.value ? "alert-success" : "alert-danger"}`}
          >
            {outcome$.value}
          </div>
        )}
      </div>
    </div>
  );
}
