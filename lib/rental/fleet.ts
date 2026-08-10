/**
 * The rental fleet as it appears on a signed pickup contract.
 *
 * These are legal identifiers printed on a document the customer signs — not
 * the entries in `components/car-rental/booking/data.tsx`, which are marketing
 * cards carrying euro prices and stock photography with no plate or chassis
 * number. The two lists are unrelated and should stay that way.
 *
 * Only vehicles with a real plate are offered in the picker: a customer must
 * never be able to sign a contract naming a plate that does not exist, so
 * incomplete entries are filtered out rather than shown disabled.
 */

export interface FleetVehicle {
  id: string;
  /** Marke und Modell, e.g. "Toyota Prius Hybrid". */
  model: string;
  /** Swiss registration as printed on the plate, e.g. "ZH 589 864". */
  plate: string;
  /**
   * Fahrgestell-Nr. — the chassis / VIN number.
   *
   * Optional because the office has supplied it for one vehicle so far. The
   * plate identifies the car unambiguously, so a contract is still valid
   * without it; the PDF omits the row rather than printing an empty field,
   * which would read as a defect in the document. Fill these in as they
   * arrive — see the note at the bottom of this file.
   */
  vin?: string;
  /**
   * Set when a vehicle has no valid plate yet or is out of service.
   * Placeholder entries never reach the picker or a contract.
   */
  placeholder?: boolean;
}

export const fleet: FleetVehicle[] = [
  {
    id: "prius-zh513925",
    model: "Toyota Prius Hybrid",
    plate: "ZH 513 925",
  },
  {
    id: "prius-zh401859",
    model: "Toyota Prius Hybrid",
    plate: "ZH 401 859",
  },
  {
    id: "prius-zh615166",
    model: "Toyota Prius Hybrid",
    plate: "ZH 615 166",
  },
  {
    id: "prius-zh589864",
    model: "Toyota Prius Hybrid",
    plate: "ZH 589 864",
    vin: "JTD KB2 0U8 001 332 49",
  },
  {
    id: "prius-zh615132",
    model: "Toyota Prius Hybrid",
    plate: "ZH 615 132",
  },
  {
    id: "prius-18-zh918474",
    model: "Toyota Prius Hybrid 1.8",
    plate: "ZH 918 474",
  },
  {
    id: "octavia-zh886530",
    model: "Skoda Octavia",
    plate: "ZH 886 530",
  },
  {
    id: "octavia-zh919906",
    model: "Skoda Octavia",
    plate: "ZH 919 906",
  },
];

// ---------------------------------------------------------------------
// OUTSTANDING — chassis numbers.
//
// Seven of the eight vehicles have no Fahrgestell-Nr. yet. Add `vin` to each
// as the office supplies it; nothing else needs changing, and the PDF starts
// printing the row automatically once the field is present.
//
// The client originally described a fleet of ten. Eight are listed here, so
// two are either still to come or no longer in service.
// ---------------------------------------------------------------------

/** The vehicles a customer may actually select. */
export const availableFleet: FleetVehicle[] = fleet.filter(
  (vehicle) => !vehicle.placeholder
);

/** Resolves a picker selection, refusing placeholders. */
export function findVehicle(id: string): FleetVehicle | undefined {
  return availableFleet.find((vehicle) => vehicle.id === id);
}

/**
 * Fuel gauge positions, as marked on the dashboard, low to high.
 *
 * `empty` is a real reading, not a missing value: a car can come back on the
 * reserve light, and without it the lowest recordable level is a quarter tank,
 * which would overstate what was returned and understate the refuelling charge.
 */
export const FUEL_LEVELS = ["empty", "1/4", "1/2", "3/4", "full"] as const;
export type FuelLevel = (typeof FUEL_LEVELS)[number];

/** How a level is printed on the contract. */
export function fuelLevelToFraction(level: FuelLevel): string {
  if (level === "empty") return "0/4";
  if (level === "full") return "4/4";
  return level;
}
