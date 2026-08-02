export const POOL_SIZE = 100_000;

export const POOL_PAGE = 12;

export const SEAT_PRICE = 450;
export const PASS_PRICE = 120;

export const MAX_ATTENDEES = 4_500;
export const MAX_CONTRACTORS = 400;

export const BULK_SIZES = [100, 1_000];

export const INITIAL_BUDGET = 2_000_000;
export const BUDGET_STEP = 500_000;

export const STEPS = ["Details", "Attendees", "Extras", "Review"] as const;
export type Step = 0 | 1 | 2 | 3;

export const REGISTRATION_PUML = `@startuml
skinparam classBackgroundColor White
skinparam classBorderColor Black
class Registration {
  team: String
  budget: Int
  passes: Int
}
class Staff {
  name: String
  accredited: Bool
}
class Contractor
Registration "1" *-- "*" Staff : attendees
Staff <|-- Contractor
@enduml`;
