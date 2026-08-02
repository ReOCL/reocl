import { invariant } from "reactiveocl";
import {
  allAccreditedOk$,
  contractorCapOk$,
  teamNamedOk$,
  teamSizeOk$,
  uniqueNamesOk$,
  withinBudgetOk$,
} from "./model";
import { MAX_ATTENDEES, MAX_CONTRACTORS, PASS_PRICE, SEAT_PRICE } from "./config";

export const teamNamed = invariant("teamNamed", teamNamedOk$, `self.team <> ""`);

export const withinBudget = invariant(
  "withinBudget",
  withinBudgetOk$,
  `self.attendees -> size() * ${SEAT_PRICE} + self.passes * ${PASS_PRICE} <= self.budget@pre`,
);

export const teamSize = invariant(
  "teamSize",
  teamSizeOk$,
  `self.attendees -> size() >= 1 and self.attendees -> size() <= ${MAX_ATTENDEES}`,
);

export const allAccredited = invariant(
  "allAccredited",
  allAccreditedOk$,
  `self.attendees -> forAll(a | a.accredited)`,
);

export const uniqueNames = invariant(
  "uniqueNames",
  uniqueNamesOk$,
  `self.attendees -> isUnique(a | a.name)`,
);

export const contractorCap = invariant(
  "contractorCap",
  contractorCapOk$,
  `self.attendees -> select(a | a.oclIsTypeOf(Contractor)) -> size() <= ${MAX_CONTRACTORS}`,
);

export const registrationInvariants = [
  teamNamed,
  withinBudget,
  teamSize,
  allAccredited,
  uniqueNames,
  contractorCap,
];
