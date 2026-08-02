import { store } from "@/store";
import { CompiledDepartment, CompiledEmployee } from "./compiled";

export { store };

export const dept = new CompiledDepartment(store, "Sales", 100_000);

export const employees$ = dept.employees$;

const alice = new CompiledEmployee(store, "Alice", 35000, false);
const bob = new CompiledEmployee(store, "Bob", 40000, true);
const carol = new CompiledEmployee(store, "Carol", 40000, false);
const dave = new CompiledEmployee(store, "Dave", 30000, true);

for (const e of [alice, bob, carol, dave]) employees$.add(e.obj);

export function addEmployee(name: string, isMale: boolean, salary: number) {
  const emp = new CompiledEmployee(store, name, salary, isMale);
  employees$.add(emp.obj);
  return emp;
}

export function fireEmployee(oid: number) {
  employees$.removeByOid("Employee", oid);
}

export const NAME_POOL: { name: string; isMale: boolean }[] = [
  { name: "Alice", isMale: false },
  { name: "Bob", isMale: true },
  { name: "Carol", isMale: false },
  { name: "Dave", isMale: true },
  { name: "Eve", isMale: false },
  { name: "Frank", isMale: true },
  { name: "Grace", isMale: false },
  { name: "Henry", isMale: true },
  { name: "Ivan", isMale: true },
  { name: "Julia", isMale: false },
  { name: "Karl", isMale: true },
  { name: "Laura", isMale: false },
  { name: "Mike", isMale: true },
  { name: "Nora", isMale: false },
  { name: "Oscar", isMale: true },
  { name: "Paula", isMale: false },
  { name: "Quinn", isMale: true },
  { name: "Robert", isMale: true },
  { name: "Sarah", isMale: false },
  { name: "Tom", isMale: true },
  { name: "Uma", isMale: false },
  { name: "Victor", isMale: true },
  { name: "Wendy", isMale: false },
  { name: "Xavier", isMale: true },
  { name: "Yara", isMale: false },
  { name: "Zoe", isMale: false },
];

export function nameForIndex(i: number): { name: string; isMale: boolean } {
  if (i < NAME_POOL.length) return NAME_POOL[i]!;
  const extra = i - NAME_POOL.length;
  const idx = extra % NAME_POOL.length;
  const suffix = Math.floor(extra / NAME_POOL.length) + 2;
  const base = NAME_POOL[idx]!;
  return { name: `${base.name}-${suffix}`, isMale: base.isMale };
}
