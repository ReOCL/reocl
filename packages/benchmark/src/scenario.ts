import type { Employee } from "./model";
import { faker } from "@faker-js/faker";
import { setRandomSeed } from "bun:jsc";

setRandomSeed(42);
faker.seed(42);

export type Mutation = { kind: "add"; employee: Employee } | { kind: "remove"; employee: Employee };

export type Scenario = {
  initialEmployees: Employee[];
  mutations: Mutation[];
  capacity: number;
};

export function makeScenario(n: number, totalMutations: number, activeRatio = 0.5): Scenario {
  const initialEmployees: Employee[] = [];
  const live: Employee[] = [];

  let nextId = 0;

  for (let i = 0; i < n; i++) {
    const employee: Employee = {
      id: nextId++,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      active: Math.random() < activeRatio,
    };
    initialEmployees.push(employee);
    live.push(employee);
  }

  const mutations: Mutation[] = [];

  for (let i = 0; i < totalMutations; i++) {
    if (i % 2 === 0 && live.length > 0) {
      const idx = Math.floor(Math.random() * live.length);
      const employee = live[idx]!;

      mutations.push({ kind: "remove", employee });

      const last = live[live.length - 1]!;
      live[idx] = last;
      live.pop();
    } else {
      const employee: Employee = {
        id: nextId++,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        active: Math.random() < activeRatio,
      };

      mutations.push({ kind: "add", employee });
      live.push(employee);
    }
  }

  const capacity = Math.ceil(0.6 * n);

  return {
    initialEmployees,
    mutations,
    capacity,
  };
}
