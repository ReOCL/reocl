import { render } from "preact";
import { useState } from "preact/hooks";
import "@preact/signals";

import { TabNav, type Tab } from "@/shared/TabNav";
import { DepartmentTab } from "@/tabs/invariant-checking/DepartmentTab";
import { TransactionsTab } from "@/tabs/transactions/TransactionsTab";
import { PipelineTab } from "@/tabs/chaining-pipelines/PipelineTab";
import { RegistrationTab } from "@/tabs/registration/RegistrationTab";

function App() {
  const [tab, setTab] = useState<Tab>("department");
  const [showCodes, setShowCodes] = useState(false);
  const toggleCodes = () => setShowCodes(!showCodes);

  return (
    <div class="container py-4">
      <h1 class="h4 mb-4">ReOCL demos</h1>
      <TabNav tab={tab} setTab={setTab} />

      {tab === "department" && <DepartmentTab showCodes={showCodes} onToggle={toggleCodes} />}
      {tab === "personaccount" && <TransactionsTab showCodes={showCodes} onToggle={toggleCodes} />}
      {tab === "pipeline" && <PipelineTab showCodes={showCodes} onToggle={toggleCodes} />}
      {tab === "session" && <RegistrationTab showCodes={showCodes} onToggle={toggleCodes} />}
    </div>
  );
}

render(<App />, document.getElementById("app")!);
