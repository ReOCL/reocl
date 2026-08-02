import { TabLayout } from "@/shared/TabLayout";
import { REGISTRATION_PUML } from "@/tabs/registration/config";
import { attendeeCount$, contractorCount$, cost$ } from "@/tabs/registration/model";
import { registrationInvariants } from "@/tabs/registration/invariants";
import { RegistrationActions } from "@/tabs/registration/components/RegistrationActions";
import { Wizard } from "@/tabs/registration/components/Wizard";
import { EngineRace } from "@/tabs/registration/components/EngineRace";

export function RegistrationTab({
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
      actions={<RegistrationActions />}
      widgetTitle="Conference registration"
      widget={<Wizard />}
      invariants={registrationInvariants}
      signals={[
        {
          name: "attendeeCount$",
          value: String(attendeeCount$.value),
          code: `attendees$.size()`,
        },
        {
          name: "contractorCount$",
          value: String(contractorCount$.value),
          code: `attendees$.select(a => a.oclIsTypeOf("Contractor")).size()`,
        },
        {
          name: "cost$",
          value: `€${cost$.value.toLocaleString()}`,
          code: `computed(() => attendeeCount$.value * 450 + passes$.value * 120)`,
        },
      ]}
      extra={<EngineRace />}
      puml={REGISTRATION_PUML}
    />
  );
}
