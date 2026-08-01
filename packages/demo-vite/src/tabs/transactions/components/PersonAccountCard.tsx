import { pa } from "@/tabs/transactions/model";

export function PersonAccountCard() {
  return (
    <div>
      <div class="row">
        <div class="col">
          <div class="card border">
            <div class="card-body text-center">
              <div class="text-secondary">Checking</div>
              <div class="fs-4 fw-bold">€{pa.checking$.value}</div>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border">
            <div class="card-body text-center">
              <div class="text-secondary">Savings</div>
              <div class="fs-4 fw-bold">€{pa.savings$.value}</div>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border">
            <div class="card-body text-center">
              <div class="text-secondary">Total</div>
              <div class={`fs-4 fw-bold ${pa.conservation$.value ? "" : "text-danger"}`}>
                €{pa.checking$.value + pa.savings$.value}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
