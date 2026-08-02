import { OclEngine } from "@stekoe/ocl.js";
import type { Employee, Department } from "./model";

type OclJsDepartmentModel = {
  employees: Employee[];
  capacity: number;
};

const ocl = OclEngine.create();
ocl.setTypeDeterminer(() => "Department");
const invariantString =
  "context Department inv: self.employees->select(e | e.active)->size() <= self.capacity";
ocl.addOclExpression(invariantString);

export class OclJsDepartment implements Department {
  private dept: OclJsDepartmentModel;

  constructor(
    initialEmployees: Iterable<Employee>,
    public readonly capacity: number,
  ) {
    this.dept = {
      employees: Array.from(initialEmployees),
      capacity,
    };
  }

  get activeCapacity(): boolean {
    return ocl.evaluate(this.dept).getResult();
  }

  addEmployee(e: Employee): void {
    this.dept.employees.push(e);
  }

  removeEmployee(e: Employee): void {
    const index = this.dept.employees.findIndex((emp) => emp.id === e.id);
    if (index > -1) {
      this.dept.employees.splice(index, 1);
    }
  }
}
