import { describe, expect, it } from "vitest";
import { nextServiceDueKm, SERVICE_INTERVAL_KM } from "@/lib/admin/service";
import {
  DEFAULT_KM_PER_DAY,
  forecastService,
  isServiceNoticeDue,
  kmPerDay,
  SERVICE_NOTICE_DAYS,
} from "./serviceForecast";

const NOW = new Date("2026-11-05T08:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("nextServiceDueKm", () => {
  it("is the last service plus 10'000 km when no due reading is typed", () => {
    expect(SERVICE_INTERVAL_KM).toBe(10_000);
    expect(nextServiceDueKm({ serviceDoneKm: 95_000, serviceDueKm: null })).toBe(105_000);
  });

  it("keeps a due reading the office typed from the sticker", () => {
    expect(nextServiceDueKm({ serviceDoneKm: 95_000, serviceDueKm: 110_000 })).toBe(110_000);
  });

  it("rolls a stale due reading forward once a newer service is recorded", () => {
    // Due at 105'000, then the service was done at 104'800: the old figure
    // describes the service that has just happened, not the next one.
    expect(nextServiceDueKm({ serviceDoneKm: 104_800, serviceDueKm: 105_000 })).toBe(105_000);
    expect(nextServiceDueKm({ serviceDoneKm: 105_200, serviceDueKm: 105_000 })).toBe(115_200);
  });

  it("says nothing when no service has been recorded and none is typed", () => {
    expect(nextServiceDueKm({ serviceDoneKm: null, serviceDueKm: null })).toBeNull();
    expect(nextServiceDueKm({ serviceDoneKm: null, serviceDueKm: 120_000 })).toBe(120_000);
  });
});

describe("kmPerDay", () => {
  it("falls back to 10'000 km in 45 to 60 days when there is no history", () => {
    // The owner's figure: one service interval takes 45 to 60 days.
    expect(DEFAULT_KM_PER_DAY).toBeGreaterThan(10_000 / 60);
    expect(DEFAULT_KM_PER_DAY).toBeLessThan(10_000 / 45);
    expect(kmPerDay([], NOW)).toEqual({ kmPerDay: DEFAULT_KM_PER_DAY, source: "default" });
  });

  it("measures the car's own pace from its odometer readings", () => {
    const rate = kmPerDay(
      [
        { km: 100_000, at: daysAgo(30) },
        { km: 106_000, at: daysAgo(0) },
      ],
      NOW
    );
    expect(rate.source).toBe("history");
    expect(rate.kmPerDay).toBeCloseTo(200, 5);
  });

  it("does not trust two readings a few days apart", () => {
    const rate = kmPerDay(
      [
        { km: 100_000, at: daysAgo(2) },
        { km: 101_500, at: daysAgo(0) },
      ],
      NOW
    );
    expect(rate.source).toBe("default");
  });

  it("ignores a pace no car can drive, which means a mistyped reading", () => {
    const rate = kmPerDay(
      [
        { km: 10_000, at: daysAgo(30) },
        { km: 106_000, at: daysAgo(0) },
      ],
      NOW
    );
    expect(rate.source).toBe("default");
  });
});

describe("forecastService", () => {
  it("projects today's odometer and the day the service falls due", () => {
    const forecast = forecastService(
      {
        serviceDoneKm: 100_000,
        serviceDueKm: null,
        serviceDoneOn: null,
        readings: [
          { km: 100_000, at: daysAgo(40) },
          { km: 108_000, at: daysAgo(0) },
        ],
      },
      NOW
    );
    expect(forecast).not.toBeNull();
    expect(forecast!.dueKm).toBe(110_000);
    expect(forecast!.estimatedKmNow).toBe(108_000);
    expect(forecast!.remainingKm).toBe(2_000);
    expect(forecast!.kmPerDay).toBeCloseTo(200, 5);
    // 2'000 km at 200 km a day: ten days.
    expect(forecast!.daysUntilDue).toBe(10);
    expect(forecast!.estimatedDueOn.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(forecast!.recordedOverdue).toBe(false);
  });

  it("drives the last reading forward when it is old", () => {
    const forecast = forecastService(
      {
        serviceDoneKm: 100_000,
        serviceDueKm: null,
        serviceDoneOn: null,
        readings: [{ km: 100_000, at: daysAgo(40) }],
      },
      NOW
    );
    // No pace of its own yet, so the default: 40 days at ~190 km.
    expect(forecast!.estimatedKmNow).toBe(100_000 + Math.round(40 * DEFAULT_KM_PER_DAY));
    expect(forecast!.rateSource).toBe("default");
  });

  it("uses the service invoice as a reading when nothing newer exists", () => {
    const forecast = forecastService(
      {
        serviceDoneKm: 100_000,
        serviceDueKm: null,
        serviceDoneOn: new Date("2026-10-06T00:00:00.000Z"),
        readings: [],
      },
      NOW
    );
    expect(forecast).not.toBeNull();
    expect(forecast!.lastReadingKm).toBe(100_000);
  });

  it("is overdue on the record only once a real reading has passed the due figure", () => {
    const forecast = forecastService(
      {
        serviceDoneKm: 100_000,
        serviceDueKm: 110_000,
        serviceDoneOn: null,
        readings: [{ km: 110_400, at: daysAgo(1) }],
      },
      NOW
    );
    expect(forecast!.recordedOverdue).toBe(true);
    expect(forecast!.remainingKm).toBeLessThan(0);
  });

  it("says nothing about a car with no service figures", () => {
    expect(
      forecastService(
        { serviceDoneKm: null, serviceDueKm: null, serviceDoneOn: null, readings: [{ km: 5, at: NOW }] },
        NOW
      )
    ).toBeNull();
  });

  it("says nothing about a car with a due figure but no reading at all", () => {
    expect(
      forecastService(
        { serviceDoneKm: null, serviceDueKm: 110_000, serviceDoneOn: null, readings: [] },
        NOW
      )
    ).toBeNull();
  });
});

describe("isServiceNoticeDue", () => {
  const base = {
    serviceDoneKm: 100_000,
    serviceDueKm: null,
    serviceDoneOn: null,
  };

  it("is quiet while the service is weeks away", () => {
    const forecast = forecastService(
      { ...base, readings: [{ km: 102_000, at: NOW }] },
      NOW
    )!;
    expect(isServiceNoticeDue(forecast)).toBe(false);
  });

  it(`warns ${SERVICE_NOTICE_DAYS} days ahead by the projected date`, () => {
    // 1'400 km left at the default ~190 km a day: about a week.
    const forecast = forecastService(
      { ...base, readings: [{ km: 108_600, at: NOW }] },
      NOW
    )!;
    expect(forecast.daysUntilDue).toBeLessThanOrEqual(SERVICE_NOTICE_DAYS);
    expect(isServiceNoticeDue(forecast)).toBe(true);
  });

  it("warns once the remaining distance is under 1'000 km, whatever the pace", () => {
    const forecast = forecastService(
      {
        ...base,
        readings: [
          { km: 109_000, at: daysAgo(60) },
          { km: 109_200, at: NOW },
        ],
      },
      NOW
    )!;
    expect(isServiceNoticeDue(forecast)).toBe(true);
  });
});
