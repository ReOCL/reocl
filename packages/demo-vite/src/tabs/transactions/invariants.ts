import { invariant } from "reactiveocl";
import { pa } from "./model";

export const conservation = invariant(
  "conservation",
  pa.conservation$,
  `self.checking + self.savings = self.checking@pre + self.savings@pre`,
);
export const checkingNonNeg = invariant("checkingNonNeg", pa.checkingNonNeg$, `self.checking >= 0`);
export const savingsNonNeg = invariant("savingsNonNeg", pa.savingsNonNeg$, `self.savings >= 0`);
