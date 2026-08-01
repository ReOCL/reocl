import { useState } from "preact/hooks";
import { pa, personAccount, store } from "@/tabs/transactions/model";

const tx = store.transaction(pa.conservation$, pa.checkingNonNeg$, pa.savingsNonNeg$);

export function PersonAccountActions() {
  const [amount, setAmount] = useState(50);
  const [result, setResult] = useState("");
  const [resultOk, setResultOk] = useState(true);

  const checkWhichFailed = () => {
    const failures: string[] = [];
    if (!pa.conservation$.value) failures.push("conservation");
    if (!pa.checkingNonNeg$.value) failures.push("checking >= 0");
    if (!pa.savingsNonNeg$.value) failures.push("savings >= 0");
    return failures.length > 0 ? failures.join(", ") : "unknown";
  };

  const doTransfer = (dir: "toChecking" | "toSavings") => {
    setResult("");
    tx.begin();
    tx.mutate(() => {
      if (dir === "toChecking") {
        personAccount.setInt("savings", pa.savings$.value - amount);
        personAccount.setInt("checking", pa.checking$.value + amount);
      } else {
        personAccount.setInt("checking", pa.checking$.value - amount);
        personAccount.setInt("savings", pa.savings$.value + amount);
      }
    });
    const failedBefore = checkWhichFailed();
    const ok = tx.commit();
    setResult(
      ok
        ? `Transferred €${amount} - all invariants preserved.`
        : `Rolled back - invariant violated (${failedBefore})`,
    );
    setResultOk(ok);
  };

  return (
    <div class="card border-0 bg-primary text-white mb-3">
      <div class="card-header fw-bold border-light">Actions</div>
      <div class="card-body">
        <div class="mb-2">
          <label class="form-label">Amount (€)</label>
          <input
            type="number"
            class="form-control"
            value={amount}
            onInput={(e) => setAmount(Number(e.currentTarget.value))}
          />
        </div>
        <button class="btn btn-light w-100 mb-2" onClick={() => doTransfer("toChecking")}>
          To Checking
        </button>
        <button class="btn btn-light w-100 mb-2" onClick={() => doTransfer("toSavings")}>
          To Savings
        </button>
        {result && (
          <div class={`alert py-2 mb-0 mt-2 ${resultOk ? "alert-success" : "alert-danger"}`}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
