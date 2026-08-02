export type Tab = "department" | "personaccount" | "pipeline" | "session";

const TABS: { id: Tab; label: string }[] = [
  { id: "department", label: "Invariant Checking" },
  { id: "personaccount", label: "Transactions" },
  { id: "pipeline", label: "Chaining Pipelines" },
  { id: "session", label: "Registration Wizard" },
];

export function TabNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <ul class="nav nav-tabs mb-3">
      {TABS.map(({ id, label }) => (
        <li class="nav-item" key={id}>
          <button class={`nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}
