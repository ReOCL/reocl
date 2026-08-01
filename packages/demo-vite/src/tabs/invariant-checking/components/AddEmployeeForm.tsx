import { useState } from "preact/hooks";
import { addEmployee, nameForIndex } from "@/tabs/invariant-checking/model";
import { MIN_SALARY } from "@/tabs/invariant-checking/config";

export function AddEmployeeForm() {
  const [count, setCount] = useState(4);
  const [salary, setSalary] = useState(MIN_SALARY);
  const ne = nameForIndex(count);
  const [name, setName] = useState(ne.name);

  const handleAdd = () => {
    if (name.trim()) {
      addEmployee(name.trim(), ne.isMale, salary);
      setCount((c) => c + 1);
      const next = nameForIndex(count + 1);
      setName(next.name);
    }
  };

  return (
    <div>
      <div class="mb-2">
        <label class="form-label">Name</label>
        <input
          type="text"
          class="form-control"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <div class="mb-2">
        <label class="form-label">Salary (€)</label>
        <input
          type="number"
          class="form-control"
          value={salary}
          onInput={(e) => setSalary(Number(e.currentTarget.value))}
          min={0}
        />
      </div>
      <button class="btn btn-light w-100" onClick={handleAdd}>
        Add Employee
      </button>
    </div>
  );
}
