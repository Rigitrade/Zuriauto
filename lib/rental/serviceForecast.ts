/**
 * When a car's next oil service will fall due, in kilometres and as a date.
 *
 * The service falls due at a distance (every 10'000 km, see
 * SERVICE_INTERVAL_KM), but a renter plans by the calendar. So this projects
 * the odometer forward at the car's own pace, measured from its readings: the
 * pickup and return contracts, the office's dashboard readings, and the last
 * service invoice. A car without enough history is assumed to run the owner's
 * figure of 10'000 km in 45 to 60 days.
 *
 * Pure: the scheduler gathers the readings and this does the arithmetic, so
 * the tests can state the rules without a database.
 */

import {
  nextServiceDueKm,
  SERVICE_INTERVAL_KM,
  SERVICE_NOTICE_KM,
} from "@/lib/admin/service";
import { zurichDayString } from "./passes";

/** The owner's figure: one interval takes 45 to 60 days. The midpoint, ~190 km a day. */
export const SERVICE_INTERVAL_DAYS_MIN = 45;
export const SERVICE_INTERVAL_DAYS_MAX = 60;
export const DEFAULT_KM_PER_DAY =
  SERVICE_INTERVAL_KM / ((SERVICE_INTERVAL_DAYS_MIN + SERVICE_INTERVAL_DAYS_MAX) / 2);

/**
 * How many days before the projected date the renter and the office hear of
 * it. A week: enough to book a garage, short enough that the projection is
 * still close.
 */
export const SERVICE_NOTICE_DAYS = Number(process.env.SERVICE_NOTICE_DAYS ?? 7);

/** Readings closer together than this say too little about a car's pace. */
const MIN_SPAN_DAYS = 7;
/** The pace is the recent one: readings older than this are left out of it. */
const PACE_LOOKBACK_DAYS = 90;
/** No car in this fleet drives more. A faster "pace" is a mistyped reading. */
const MAX_PLAUSIBLE_KM_PER_DAY = 1_500;

const DAY_MS = 86_400_000;

export interface OdometerReading {
  km: number;
  at: Date;
}

export interface Pace {
  kmPerDay: number;
  /** "history" when measured from this car's readings. */
  source: "history" | "default";
}

/**
 * The car's recent pace, or the default when its readings cannot say.
 *
 * From the newest reading back to the oldest one inside the lookback, as long
 * as they are at least a week apart and the odometer went up at a pace a car
 * can drive. A reading that went down, or a car that sat still, falls back to
 * the default: assuming it is driven warns early, which is the safe mistake.
 */
export function kmPerDay(readings: OdometerReading[], now: Date): Pace {
  const fallback: Pace = { kmPerDay: DEFAULT_KM_PER_DAY, source: "default" };
  const usable = readings
    .filter((r) => Number.isFinite(r.km) && r.at.getTime() <= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (usable.length < 2) return fallback;

  const latest = usable[usable.length - 1];
  const since = latest.at.getTime() - PACE_LOOKBACK_DAYS * DAY_MS;
  const earliest = usable.find((r) => r.at.getTime() >= since) ?? latest;

  const days = (latest.at.getTime() - earliest.at.getTime()) / DAY_MS;
  if (days < MIN_SPAN_DAYS) return fallback;

  const rate = (latest.km - earliest.km) / days;
  if (!(rate > 0) || rate > MAX_PLAUSIBLE_KM_PER_DAY) return fallback;

  return { kmPerDay: rate, source: "history" };
}

export interface ServiceForecast {
  /** The odometer reading at which the service falls due. */
  dueKm: number;
  /** The newest real reading, and when it was taken. */
  lastReadingKm: number;
  lastReadingAt: Date;
  /** The odometer today, projected from the last reading at the car's pace. */
  estimatedKmNow: number;
  /** Kilometres left by that projection. Negative once passed. */
  remainingKm: number;
  kmPerDay: number;
  rateSource: Pace["source"];
  /** Whole days from today to the projected due day. Negative once passed. */
  daysUntilDue: number;
  /** The projected due day, as a calendar date (midnight UTC, like a DATE column). */
  estimatedDueOn: Date;
  /** A real reading, not a projection, has passed the due figure. */
  recordedOverdue: boolean;
}

export function forecastService(
  car: {
    serviceDoneKm: number | null;
    serviceDueKm: number | null;
    serviceDoneOn: Date | null;
    readings: OdometerReading[];
  },
  now: Date
): ServiceForecast | null {
  const dueKm = nextServiceDueKm(car);
  if (dueKm === null) return null;

  const readings = [...car.readings];
  // The invoice is a reading too: the odometer stood at serviceDoneKm that day.
  if (car.serviceDoneKm !== null && car.serviceDoneOn) {
    readings.push({ km: car.serviceDoneKm, at: car.serviceDoneOn });
  }
  const real = readings.filter(
    (r) => Number.isFinite(r.km) && r.at.getTime() <= now.getTime()
  );
  if (real.length === 0) return null;

  const last = real.reduce((a, b) => (b.at.getTime() > a.at.getTime() ? b : a));
  const pace = kmPerDay(real, now);

  const sinceDays = Math.max(0, (now.getTime() - last.at.getTime()) / DAY_MS);
  const estimatedKmNow = last.km + Math.round(sinceDays * pace.kmPerDay);
  const remainingKm = dueKm - estimatedKmNow;
  // Rounded down: a service called a day early costs nothing.
  const daysUntilDue = Math.floor(remainingKm / pace.kmPerDay);

  const today = Date.parse(`${zurichDayString(now)}T00:00:00Z`);
  const estimatedDueOn = new Date(today + daysUntilDue * DAY_MS);

  return {
    dueKm,
    lastReadingKm: last.km,
    lastReadingAt: last.at,
    estimatedKmNow,
    remainingKm,
    kmPerDay: pace.kmPerDay,
    rateSource: pace.source,
    daysUntilDue,
    estimatedDueOn,
    recordedOverdue: last.km >= dueKm,
  };
}

/** Time to tell the renter and the office: a week out, or under 1'000 km left. */
export function isServiceNoticeDue(forecast: ServiceForecast): boolean {
  return (
    forecast.remainingKm <= SERVICE_NOTICE_KM ||
    forecast.daysUntilDue <= SERVICE_NOTICE_DAYS
  );
}
