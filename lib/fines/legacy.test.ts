import { describe, expect, it } from "vitest";
import { csvRows, legacyAmount, legacyDate, legacySpeed, legacyTime, parseLegacyList } from "./legacy";

/**
 * Reading the office's fines list from before the system, as Excel exports
 * it. The rows are shaped like the real list (13.11.2026), the names made up.
 */

const HEADER = "Kennzeichen;Datum;Zeit;Betrag;Ort;Fahrer;Nummer;Vergehen;Telefon";

describe("csvRows", () => {
  it("splits on semicolons, keeps quoted separators and doubled quotes", () => {
    expect(csvRows('﻿a;"b;c";"say ""hi"""\r\nd;e;f\n')).toEqual([
      ["a", "b;c", 'say "hi"'],
      ["d", "e", "f"],
    ]);
  });

  it("takes commas when the header has no semicolons", () => {
    expect(csvRows('a,"Doe, Jo",c')).toEqual([["a", "Doe, Jo", "c"]]);
  });
});

describe("the list's own ways of writing things", () => {
  it.each([
    ["16.05.2026", "2026-05-16"],
    ["1.7.26", "2026-07-01"],
    ["31.02.2026", null],
    ["2026-05-16", null],
  ])("date %s", (value, expected) => expect(legacyDate(value)).toBe(expected));

  it.each([
    ["22:24", "22:24"],
    ["16.10", "16:10"],
    ["9.55", "09:55"],
    ["25:00", null],
    ["abends", null],
  ])("time %s", (value, expected) => expect(legacyTime(value)).toBe(expected));

  it.each([
    ["100.-", 10000],
    ["85", 8500],
    ["70.18", 7018],
    ["1'250.00", 125000],
    ["40+90", null],
    ["70/50", null],
  ])("amount %s", (value, expected) => expect(legacyAmount(value)).toBe(expected));

  it("reads a speed as measured over limit", () => {
    expect(legacySpeed("60/50 kmh")).toEqual({ measured: 60, limit: 50 });
    expect(legacySpeed("+4 kmh")).toEqual({ measured: null, limit: null });
    expect(legacySpeed("Rotlicht")).toEqual({ measured: null, limit: null });
  });
});

describe("parseLegacyList", () => {
  it("reads rows as the list writes them", () => {
    const { rows, problems } = parseLegacyList(
      [
        HEADER,
        "ZH 615 166;14.07.2026;14:25;120;Birmensdorferstr. 660;Milo;2604659060011;60/50 kmh;044 411 76 76",
        'ZH 918 474;11.07.2026;03.26;120;Volketswil Autobahn;"DOE, Jon";8400791060529;98/80 kmh;',
        "ZH 589 864;10.05.2026;02.06;40+90;Buchs ZH;Ted;ST.2026.5418/DK;55/50 kmh;043 258 16 40",
        ";;;;;;;;",
      ].join("\n")
    );
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      line: 2,
      plate: "ZH 615 166",
      violationAt: new Date("2026-07-14T12:25:00Z"),
      timeKnown: true,
      amountCents: 12000,
      amountText: null,
      driver: "Milo",
      fineNumber: "2604659060011",
      speedMeasuredKmh: 60,
      speedLimitKmh: 50,
      phone: "044 411 76 76",
    });
    expect(rows[1]).toMatchObject({ driver: "DOE, Jon", phone: null, violationAt: new Date("2026-07-11T01:26:00Z") });
    expect(rows[2]).toMatchObject({ amountCents: null, amountText: "40+90" });
  });

  it("takes a row with no time as the day, without claiming a time", () => {
    const { rows } = parseLegacyList(`${HEADER}\nZH 615 132;30.06.2026;;40;Rosengartenstr. 62;Laz;288016210105;;`);
    expect(rows[0]).toMatchObject({ timeKnown: false, offence: null });
  });

  it("names every row it cannot read, with its line", () => {
    const { rows, problems } = parseLegacyList(
      [HEADER, "ZH 615 166;32.07.2026;10:00;40;x;A;1;x;", "Toyota;01.07.2026;10:00;40;x;A;1;x;", "ZH 615 166;01.07.2026;10:00;40;x;;1;x;"].join(
        "\n"
      )
    );
    expect(rows).toEqual([]);
    expect(problems.map((p) => [p.line, p.reason])).toEqual([
      [2, "date"],
      [3, "plate"],
      [4, "driver"],
    ]);
  });
});
