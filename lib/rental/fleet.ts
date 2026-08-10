/**
 * The rental fleet as it appears on a signed pickup contract.
 *
 * These are legal identifiers printed on a document the customer signs — not
 * the entries in `components/car-rental/booking/data.tsx`, which are marketing
 * cards carrying euro prices and stock photography with no plate or chassis
 * number. The two lists are unrelated and should stay that way.
 *
 * Only vehicles with real data are offered in the picker: a customer must
 * never be able to sign a contract naming a placeholder plate, so incomplete
 * entries are filtered out rather than shown disabled.
 */

export interface FleetVehicle {
  id: string;
  /** Marke und Modell, e.g. "Toyota Prius". */
  model: string;
  /** Swiss registration as printed on the plate, e.g. "ZH 589 864". */
  plate: string;
  /** Fahrgestell-Nr. — the chassis / VIN number. */
  vin: string;
  /**
   * Set until the office supplies the real plate and chassis number.
   * Placeholder entries never reach the picker or a contract.
   */
  placeholder?: boolean;
}

export const fleet: FleetVehicle[] = [
  {
    id: "prius-zh589864",
    model: "Toyota Prius",
    plate: "ZH 589 864",
    vin: "JTD KB2 0U8 001 332 49",
  },

  // ---------------------------------------------------------------------
  // TO COMPLETE — nine of the ten cars are still missing.
  //
  // The office supplied details for one vehicle only. To put a car into
  // service: fill in `model`, `plate` and `vin`, then delete its
  // `placeholder` flag. Nothing else in the codebase needs to change.
  // ---------------------------------------------------------------------
  { id: "car-02", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-03", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-04", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-05", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-06", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-07", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-08", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-09", model: "", plate: "", vin: "", placeholder: true },
  { id: "car-10", model: "", plate: "", vin: "", placeholder: true },
];

/** The vehicles a customer may actually select. */
export const availableFleet: FleetVehicle[] = fleet.filter(
  (vehicle) => !vehicle.placeholder
);

/** Resolves a picker selection, refusing placeholders. */
export function findVehicle(id: string): FleetVehicle | undefined {
  return availableFleet.find((vehicle) => vehicle.id === id);
}

/** Fuel gauge positions, as marked on the dashboard. */
export const FUEL_LEVELS = ["1/4", "1/2", "3/4", "full"] as const;
export type FuelLevel = (typeof FUEL_LEVELS)[number];
