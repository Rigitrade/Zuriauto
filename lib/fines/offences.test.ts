import { describe, expect, it } from "vitest";
import { handlingFeeCents } from "./fee";
import { offenceWording, privateCategory } from "./offences";

describe("offenceWording", () => {
  it("keeps a German letter's own wording — it is the official text", () => {
    const wording = offenceWording({
      code: "303.1.a",
      original: "Überschreiten allgemeiner, fahrzeugbedingter oder signalisierter Höchstgeschwindigkeit innerorts",
      language: "de",
      issuerKind: "POLICE",
    });
    expect(wording.de).toBe(
      "Überschreiten allgemeiner, fahrzeugbedingter oder signalisierter Höchstgeschwindigkeit innerorts"
    );
    expect(wording.en).toContain("speed limit");
    expect(wording.en).toContain("built-up area");
  });

  it("gives a French letter's speeding code its German wording", () => {
    const wording = offenceWording({
      code: "303.2.b",
      original: "Dépassement de la vitesse maximale générale hors des localités",
      language: "fr",
      issuerKind: "POLICE",
    });
    expect(wording.de).toContain("Höchstgeschwindigkeit");
    expect(wording.de).toContain("ausserorts");
    expect(wording.de).toContain("6–10 km/h");
    expect(wording.fromCatalogue).toBe(true);
  });

  it("shows an unknown code's original text and says which language it is in", () => {
    const wording = offenceWording({
      code: "999.9",
      original: "Stationnement interdit",
      language: "fr",
      issuerKind: "POLICE",
    });
    expect(wording.de).toBe("Ziffer 999.9 (Originaltext, Französisch): Stationnement interdit");
    expect(wording.en).toBe("Item 999.9 (original text, French): Stationnement interdit");
    expect(wording.fromCatalogue).toBe(false);
  });

  it("names a private charge by category", () => {
    const wording = offenceWording({
      code: null,
      original: "ohne Berechtigung auf dem Privatparkplatz abgestellt",
      language: "de",
      issuerKind: "PRIVATE",
    });
    expect(wording.de).toBe("Parkieren ohne Berechtigung auf Privatgrund");
    expect(wording.en).toBe("Parking on private property without permission");
  });
});

describe("privateCategory", () => {
  it("sorts the common private charges", () => {
    expect(privateCategory("ohne Berechtigung abgestellt")).toBe("NO_PERMIT");
    expect(privateCategory("Höchstparkzeit überschritten")).toBe("OVERSTAY");
    expect(privateCategory("ohne gültiges Parkticket")).toBe("NO_TICKET");
    expect(privateCategory("stationnement sans autorisation")).toBe("NO_PERMIT");
    expect(privateCategory("something else")).toBe("OTHER");
  });
});

describe("handlingFeeCents", () => {
  it("charges the GTC fee to renters who accepted the GTC of 30.07.2026 or later", () => {
    expect(handlingFeeCents("30.07.2026", {})).toBe(2000);
    expect(handlingFeeCents("2026-07-31", {})).toBe(2000);
  });

  it("charges nothing under an older or unknown GTC", () => {
    expect(handlingFeeCents("15.03.2026", {})).toBe(0);
    expect(handlingFeeCents("", {})).toBe(0);
    expect(handlingFeeCents(null, {})).toBe(0);
  });

  it("follows the configuration, and 0 turns it off", () => {
    expect(handlingFeeCents("30.07.2026", { FINES_HANDLING_FEE_CENTS: "2500" })).toBe(2500);
    expect(handlingFeeCents("30.07.2026", { FINES_HANDLING_FEE_CENTS: "0" })).toBe(0);
    expect(handlingFeeCents("30.07.2026", { FINES_HANDLING_FEE_CENTS: "nonsense" })).toBe(2000);
  });
});
