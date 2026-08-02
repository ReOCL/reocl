import type { ComponentChildren } from "preact";
import type { InvariantDef } from "reactiveocl";
import { CardHeader } from "@/shared/CardHeader";
import { InvariantStatus } from "@/shared/InvariantStatus";
import { SignalValue } from "@/shared/SignalValue";
import { MetamodelCard } from "@/shared/MetamodelCard";

export interface SignalRow {
  name: string;
  value: string;
  code: string;
}

interface Props {
  actions: ComponentChildren;
  widgetTitle: string;
  widget: ComponentChildren;
  widgetFlush?: boolean;
  invariants: InvariantDef[];
  signals: SignalRow[];
  extra?: ComponentChildren;
  puml: string;
  showCodes: boolean;
  onToggle: () => void;
}

export function TabLayout({
  actions,
  widgetTitle,
  widget,
  widgetFlush,
  invariants,
  signals,
  extra,
  puml,
  showCodes,
  onToggle,
}: Props) {
  return (
    <div class="row">
      <div class="col-md-3">{actions}</div>
      <div class="col-md-5">
        <div class="card border mb-3">
          <div class="card-header fw-bold">{widgetTitle}</div>
          <div class={widgetFlush ? "card-body p-0" : "card-body"}>{widget}</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card border mb-3">
          <CardHeader title="Constraints" showCodes={showCodes} onToggle={onToggle} />
          <div class="card-body p-0">
            {invariants.map((inv) => (
              <InvariantStatus
                key={inv.name}
                name={inv.name}
                satisfied={inv.value$.value}
                code={inv.code}
                showCode={showCodes}
              />
            ))}
          </div>
        </div>
        <div class="card border mb-3">
          <CardHeader title="Signals" showCodes={showCodes} onToggle={onToggle} />
          <div class="card-body p-0">
            {signals.map((s) => (
              <SignalValue
                key={s.name}
                name={s.name}
                value={s.value}
                code={s.code}
                showCode={showCodes}
              />
            ))}
          </div>
        </div>
        {extra}
        <MetamodelCard source={puml} />
      </div>
    </div>
  );
}
