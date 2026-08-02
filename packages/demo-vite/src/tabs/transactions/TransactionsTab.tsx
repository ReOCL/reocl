import { TabLayout } from "@/shared/TabLayout";
import { pa } from "@/tabs/transactions/model";
import { PA_PUML } from "@/tabs/transactions/config";
import { conservation, checkingNonNeg, savingsNonNeg } from "@/tabs/transactions/invariants";
import { PersonAccountCard } from "@/tabs/transactions/components/PersonAccountCard";
import { PersonAccountActions } from "@/tabs/transactions/components/PersonAccountActions";

export function TransactionsTab({
  showCodes,
  onToggle,
}: {
  showCodes: boolean;
  onToggle: () => void;
}) {
  return (
    <TabLayout
      showCodes={showCodes}
      onToggle={onToggle}
      actions={<PersonAccountActions />}
      widgetTitle="Widget"
      widget={<PersonAccountCard />}
      invariants={[conservation, checkingNonNeg, savingsNonNeg]}
      signals={[
        {
          name: "checking$",
          value: String(pa.checking$.value),
          code: `intSignal(obj, "checking")`,
        },
        { name: "savings$", value: String(pa.savings$.value), code: `intSignal(obj, "savings")` },
        {
          name: "conservation$",
          value: pa.conservation$.value ? "true" : "false",
          code: `computed(() => checking$.value + savings$.value === obj.preInt("checking") + obj.preInt("savings"))`,
        },
      ]}
      puml={PA_PUML}
    />
  );
}
