import type { EagerDepartment, Employee, Department } from "./model";

export class EagerDepartmentImpl implements Department {
  private dept: EagerDepartment;

  constructor(
    initialEmployees: Iterable<Employee>,
    public readonly capacity: number,
  ) {
    this.dept = {
      employees: new Set(initialEmployees),
      capacity,
    };
  }

  get activeCapacity(): boolean {
    const active = [...this.dept.employees].filter((e) => e.active);
    return active.length <= this.capacity;
  }

  addEmployee(e: Employee): void {
    this.dept.employees.add(e);
  }

  removeEmployee(e: Employee): void {
    this.dept.employees.delete(e);
  }
}
