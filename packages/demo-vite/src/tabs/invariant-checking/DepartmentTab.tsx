import { TabLayout } from "@/shared/TabLayout";
import { employees$, fireEmployee, dept } from "@/tabs/invariant-checking/model";
import { DEPT_PUML } from "@/tabs/invariant-checking/config";
import { noUnpaid } from "@/tabs/invariant-checking/invariants";
import { EmployeeTable } from "@/tabs/invariant-checking/components/EmployeeTable";
import { AddEmployeeForm } from "@/tabs/invariant-checking/components/AddEmployeeForm";

export function DepartmentTab({
  showCodes,
  onToggle,
}: {
  showCodes: boolean;
  onToggle: () => void;
}) {
  const objs = employees$.objects.value;
  const count = dept.employeeCount$.value;
  const total = dept.totalSalaries$.value;
  const budget = dept.budget$.value;

  return (
    <TabLayout
      showCodes={showCodes}
      onToggle={onToggle}
      actions={
        <div class="card border-0 bg-primary text-white mb-3">
          <div class="card-header fw-bold border-light">Actions</div>
          <div class="card-body">
            <AddEmployeeForm />
          </div>
        </div>
      }
      widgetTitle="Widget"
      widgetFlush
      widget={
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
      }
      invariants={[noUnpaid]}
      signals={[
        { name: "budget$", value: String(budget), code: "self.budget" },
        {
          name: "totalSalaries$",
          value: String(total),
          code: "employees$.collect(e => e.salary$.value).sum()",
        },
        { name: "employeeCount$", value: String(count), code: "employees$.size()" },
      ]}
      puml={DEPT_PUML}
    />
  );
}
