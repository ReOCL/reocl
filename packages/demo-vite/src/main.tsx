import { render } from "preact";
import { useState } from "preact/hooks";
// Binds the signal graph to Preact: a component that reads `.value` while
// rendering re-renders on its own when that value changes.
import "@preact/signals";

import { InvariantStatus } from "./shared/InvariantStatus";
import { SignalValue } from "./shared/SignalValue";
import { Kroki } from "./shared/Kroki";
import { EyeOpen, EyeClosed } from "./shared/icons";

import { employees$, fireEmployee, dept } from "./tabs/invariant-checking/model";
import { DEPT_PUML } from "./tabs/invariant-checking/config";
import { noUnpaid } from "./tabs/invariant-checking/invariants";
import { EmployeeTable } from "./tabs/invariant-checking/components/EmployeeTable";
import { AddEmployeeForm } from "./tabs/invariant-checking/components/AddEmployeeForm";

import { pa } from "./tabs/transactions/model";
import { PA_PUML } from "./tabs/transactions/config";
import { conservation, checkingNonNeg, savingsNonNeg } from "./tabs/transactions/invariants";
import { PersonAccountCard } from "./tabs/transactions/components/PersonAccountCard";
import { PersonAccountActions } from "./tabs/transactions/components/PersonAccountActions";

import { inStock$, totalInventoryValue$, inventoryOk } from "./tabs/chaining-pipelines/invariants";
import { PIPELINE_PUML } from "./tabs/chaining-pipelines/config";
import { PipelineCard } from "./tabs/chaining-pipelines/components/PipelineCard";
import { PipelineActions } from "./tabs/chaining-pipelines/components/PipelineActions";

type Tab = "department" | "personaccount" | "pipeline";

function CodeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button class="btn btn-sm btn-outline-secondary border-0" onClick={onToggle}>
      {show ? <EyeOpen /> : <EyeClosed />}
    </button>
  );
}

function CardHeader({
  title,
  showCodes,
  onToggle,
}: {
  title: string;
  showCodes: boolean;
  onToggle: () => void;
}) {
  return (
    <div class="card-header fw-bold d-flex justify-content-between align-items-center">
      <span>{title}</span>
      <CodeToggle show={showCodes} onToggle={onToggle} />
    </div>
  );
}

function TabNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button
          class={`nav-link ${tab === "department" ? "active" : ""}`}
          onClick={() => setTab("department")}
        >
          Invariant Checking
        </button>
      </li>
      <li class="nav-item">
        <button
          class={`nav-link ${tab === "personaccount" ? "active" : ""}`}
          onClick={() => setTab("personaccount")}
        >
          Transactions
        </button>
      </li>
      <li class="nav-item">
        <button
          class={`nav-link ${tab === "pipeline" ? "active" : ""}`}
          onClick={() => setTab("pipeline")}
        >
          Chaining Pipelines
        </button>
      </li>
    </ul>
  );
}

function MetamodelCard({ source }: { source: string }) {
  return (
    <div class="card border mt-3">
      <div class="card-header fw-bold">Metamodel</div>
      <div class="card-body bg-white">
        <Kroki source={source} />
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("department");
  const [showCodes, setShowCodes] = useState(false);
  const toggleCodes = () => setShowCodes(!showCodes);

  const objs = employees$.objects.value;
  const count = dept.employeeCount$.value;
  const total = dept.totalSalaries$.value;
  const budget = dept.budget$.value;

  return (
    <div class="container py-4">
      <h1 class="h4 mb-4">ReOCL demos</h1>
      <TabNav tab={tab} setTab={setTab} />

      {tab === "department" && (
        <div class="row">
          <div class="col-md-3">
            <div class="card border-0 bg-primary text-white mb-3">
              <div class="card-header fw-bold border-light">Actions</div>
              <div class="card-body">
                <AddEmployeeForm />
              </div>
            </div>
          </div>
          <div class="col-md-5">
            <div class="card border mb-3">
              <div class="card-header fw-bold">Widget</div>
              <div class="card-body p-0">
                <div class="card border-0 mb-0">
                  <div class="card-header fw-bold d-flex justify-content-between align-items-center">
                    <span>"{dept.name$.value}" department</span>
                    <span class="fw-normal text-secondary">
                      Count: {count} | Total salaries: €{total.toLocaleString()}
                    </span>
                  </div>
                  <div class="card-body p-0">
                    <EmployeeTable items={objs} onRemove={(oid) => fireEmployee(oid)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border mb-3">
              <CardHeader title="Constraints" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <InvariantStatus
                  name={noUnpaid.name}
                  satisfied={noUnpaid.value$.value}
                  code={noUnpaid.code}
                  showCode={showCodes}
                />
              </div>
            </div>
            <div class="card border mb-3">
              <CardHeader title="Signals" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <SignalValue
                  name="budget$"
                  value={String(budget)}
                  code="self.budget"
                  showCode={showCodes}
                />
                <SignalValue
                  name="totalSalaries$"
                  value={String(total)}
                  code="employees$.collect(e => e.salary$.value).sum()"
                  showCode={showCodes}
                />
                <SignalValue
                  name="employeeCount$"
                  value={String(count)}
                  code="employees$.size()"
                  showCode={showCodes}
                />
              </div>
            </div>
            <MetamodelCard source={DEPT_PUML} />
          </div>
        </div>
      )}

      {tab === "personaccount" && (
        <div class="row">
          <div class="col-md-3">
            <PersonAccountActions />
          </div>
          <div class="col-md-5">
            <div class="card border">
              <div class="card-header fw-bold">Widget</div>
              <div class="card-body">
                <PersonAccountCard />
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border mb-3">
              <CardHeader title="Constraints" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <InvariantStatus
                  name={conservation.name}
                  satisfied={conservation.value$.value}
                  code={conservation.code}
                  showCode={showCodes}
                />
                <InvariantStatus
                  name={checkingNonNeg.name}
                  satisfied={checkingNonNeg.value$.value}
                  code={checkingNonNeg.code}
                  showCode={showCodes}
                />
                <InvariantStatus
                  name={savingsNonNeg.name}
                  satisfied={savingsNonNeg.value$.value}
                  code={savingsNonNeg.code}
                  showCode={showCodes}
                />
              </div>
            </div>
            <div class="card border mb-3">
              <CardHeader title="Signals" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <SignalValue
                  name="checking$"
                  value={String(pa.checking$.value)}
                  code="self.checking"
                  showCode={showCodes}
                />
                <SignalValue
                  name="savings$"
                  value={String(pa.savings$.value)}
                  code="self.savings"
                  showCode={showCodes}
                />
                <SignalValue
                  name="conservation$"
                  value={pa.conservation$.value ? "true" : "false"}
                  code="self.checking + self.savings = self.checking@pre + self.savings@pre"
                  showCode={showCodes}
                />
              </div>
            </div>
            <MetamodelCard source={PA_PUML} />
          </div>
        </div>
      )}

      {tab === "pipeline" && (
        <div class="row">
          <div class="col-md-3">
            <PipelineActions />
          </div>
          <div class="col-md-5">
            <div class="card border">
              <div class="card-header fw-bold">Widget</div>
              <div class="card-body">
                <PipelineCard />
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border mb-3">
              <CardHeader title="Constraints" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <InvariantStatus
                  name={inventoryOk.name}
                  satisfied={inventoryOk.value$.value}
                  code={inventoryOk.code}
                  showCode={showCodes}
                />
              </div>
            </div>
            <div class="card border mb-3">
              <CardHeader title="Signals" showCodes={showCodes} onToggle={toggleCodes} />
              <div class="card-body p-0">
                <SignalValue
                  name="totalInventoryValue$"
                  value={String(totalInventoryValue$.value)}
                  code="itemValues$.sum()"
                  showCode={showCodes}
                />
                <SignalValue
                  name="inStock$"
                  value={String(inStock$.objects.value.length)}
                  code="products$.select(p => p.quantity$.value > 0)"
                  showCode={showCodes}
                />
              </div>
            </div>
            <MetamodelCard source={PIPELINE_PUML} />
          </div>
        </div>
      )}
    </div>
  );
}

render(<App />, document.getElementById("app")!);
