import { invariant } from "reactiveocl";
import { dept } from "./model";
import { MIN_SALARY } from "./config";

export const noUnpaid = invariant(
  "noUnpaid",
  dept.noUnpaid$,
  `self.employees -> forAll(e | e.salary >= ${MIN_SALARY})`,
);
