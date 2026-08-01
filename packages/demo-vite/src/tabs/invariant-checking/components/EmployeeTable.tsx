import { CompiledEmployee } from "@/tabs/invariant-checking/compiled";
import { MIN_SALARY } from "@/tabs/invariant-checking/config";
import { GenderIcon, TrashIcon } from "@/shared/icons";

interface Props {
  items: readonly CompiledEmployee[];
  onRemove: (oid: number) => void;
}

export function EmployeeTable({ items, onRemove }: Props) {
  return (
    <table class="table table-bordered mb-0">
      <thead class="table-dark">
        <tr>
          <th></th>
          <th>Name</th>
          <th>Salary (€)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => {
          const salary = e.salary$.value;
          const violate = salary < MIN_SALARY;
          return (
            <tr key={e.obj.oid} class={violate ? "table-danger" : undefined}>
              <td class="text-center">
                <GenderIcon isMale={e.isMale$.value} />
              </td>
              <td class={violate ? "fw-bold text-danger" : ""}>{e.name$.value}</td>
              <td class={violate ? "fw-bold text-danger" : ""}>{salary.toLocaleString()}</td>
              <td class="text-center">
                <button class="btn btn-sm" onClick={() => onRemove(e.obj.oid)} title="Remove">
                  <TrashIcon />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
