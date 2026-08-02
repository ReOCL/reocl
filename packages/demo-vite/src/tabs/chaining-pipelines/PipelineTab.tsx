import { TabLayout } from "@/shared/TabLayout";
import { PIPELINE_PUML } from "@/tabs/chaining-pipelines/config";
import { inStock$, totalInventoryValue$, inventoryOk } from "@/tabs/chaining-pipelines/invariants";
import { PipelineCard } from "@/tabs/chaining-pipelines/components/PipelineCard";
import { PipelineActions } from "@/tabs/chaining-pipelines/components/PipelineActions";

export function PipelineTab({ showCodes, onToggle }: { showCodes: boolean; onToggle: () => void }) {
  return (
    <TabLayout
      showCodes={showCodes}
      onToggle={onToggle}
      actions={<PipelineActions />}
      widgetTitle="Widget"
      widget={<PipelineCard />}
      invariants={[inventoryOk]}
      signals={[
        {
          name: "totalInventoryValue$",
          value: String(totalInventoryValue$.value),
          code: "itemValues$.sum()",
        },
        {
          name: "inStock$",
          value: String(inStock$.objects.value.length),
          code: "products$.select(p => p.quantity$.value > 0)",
        },
      ]}
      puml={PIPELINE_PUML}
    />
  );
}
