import { TranslationKeys } from "@/types/i18n";

// locales/de.ts
const de: TranslationKeys = {
  booking: {
    wizard: {
      toast: {
        loading: "Ihre Buchung wird übermittelt...",
        success:
          "Buchungsanfrage gesendet! Bitte prüfen Sie Ihre E-Mails für die Bestätigung.",
        error:
          "Übermittlung fehlgeschlagen. Bitte versuchen Sie es später erneut.",
      },
      errors: {
        correctFields:
          "Bitte korrigieren Sie die obigen Fehler, um fortzufahren.",
        acceptTerms:
          "Bitte akzeptieren Sie die AGB, um Ihre Buchung abzuschliessen.",
      },
      submitting: "Wird übermittelt...",
      title: "Auto Buchen",
      subtitle:
        "Schließen Sie Ihre Reservierung in {{totalSteps}} einfachen Schritten ab",
      previous: "Zurück",
      next: "Weiter",
      stepIndicator: "Schritt {{currentStep}} von {{totalSteps}}",
      total: "Totalbetrag",
      day: "Tag",
      day_other: "Tage", // for pluralization
      submitButton: "Buchungsanfrage Senden",
      submitMessage:
        "Ihre Buchungsanfrage wurde vorbereitet! Bitte senden Sie die E-Mail, die gerade in Ihrem E-Mail-Client geöffnet wurde. Wir antworten innerhalb von 24 Stunden mit Bestätigung und Zahlungsdetails.",
    },
    step1: {
      title: "Buchungsdetails",
      selectPackage: "Paket auswählen",
      pickupLocation: "Abholort",
      dropoffLocation: "Rückgabeort",
      selectPickupLocation: "Abholort auswählen",
      selectDropoffLocation: "Rückgabeort auswählen",
      chooseDates: "Datum wählen",
      from: "Von",
      till: "Bis",
      day: "Tag",
      day_other: "Tage", // for pluralization
      hideCalendar: "Kalender ausblenden",
      showCalendar: "Kalender anzeigen",
      selectPickupDate: "Abholdatum auswählen",
      selectDropoffDate: "Rückgabedatum auswählen",
      pickupDateTime: "Abholdatum & Uhrzeit",
      dropoffDateTime: "Rückgabedatum & Uhrzeit",
      timeRange: "Uhrzeit (09:00 - 21:00)",
      noPickupDateSelected: "Abholdatum auswählen",
      noDropoffDateSelected: "Rückgabedatum auswählen",
      noDateSelected: "MIETDAUER",
      to: "BIS",
      locations: [
        { value: "", label: "Standort wählen" },
        { value: "airport", label: "Flughafen Prag (PRG)" },
        { value: "central-station", label: "Prager Hauptbahnhof" },
        { value: "old-town", label: "Altstädter Ring" },
        { value: "wenceslas-square", label: "Wenzelsplatz" },
        { value: "hotel-delivery", label: "Hotel-Lieferung (+€10)" },
        { value: "hotel-pickup", label: "Hotel-Abholung (+€10)" },
      ],
    },
    step2: {
      title: "Ihr Fahrzeug auswählen",
      labels: {
        seats: "Sitze",
        doors: "Türen",
        hasAc: "Klimaanlage",
        noAc: "Keine Klimaanlage",
        hasGps: "GPS",
        noGps: "Kein GPS",
      },
      categories: {
        estate: "Kombi",
        luxury: "Luxus",
        hybrid: "Hybrid",
        compact: "Kompakt",
        suv: "SUV",
        electric: "Elektrisch",
      },
      transmissions: {
        manual: "Schaltgetriebe",
        automatic: "Automatik",
      },
      fuels: {
        petrol: "Benzin",
        hybrid: "Hybrid",
        electric: "Elektrisch",
      },
      specs: {
        engine: "Motor",
        consumption: "Verbrauch",
        luggage: "Kofferraum",
      },
      vehicles: {
        "skoda-octavia": {
          name: "Skoda Octavia Combi",
          features: ["Großer Kofferraum", "Sparsam", "Zuverlässig"],
        },
        "mercedes-e": {
          name: "Mercedes E-Klasse",
          features: ["Luxusausstattung", "Premium Soundsystem", "Ledersitze"],
        },
        "toyota-prius": {
          name: "Toyota Prius Hybrid",
          features: [
            "Umweltfreundlich",
            "Exzellenter Kraftstoffverbrauch",
            "Moderne Technologie",
          ],
        },
        "vw-golf": {
          name: "Volkswagen Golf",
          features: [
            "Sportliches Design",
            "Einfach zu parken",
            "Hervorragende Fahreigenschaften",
          ],
        },
        "skoda-kodiaq": {
          name: "Skoda Kodiaq SUV",
          features: ["7 Sitze", "Hohe Sitzposition", "Allwettertauglich"],
        },
        "tesla-model3": {
          name: "Tesla Model 3",
          features: [
            "Null Emissionen",
            "Autopilot",
            "Premium Innenausstattung",
          ],
        },
      },
    },
    step3: {
      title: "Persönliche Informationen",
      bookingType: "Buchung durch",
      person: "Person",
      company: "Unternehmen",
      companyName: "Firmenname",
      companyNamePlaceholder: "Firmennamen eingeben",
      familyName: "Familienname",
      familyNamePlaceholder: "Familiennamen eingeben",
      firstName: "Vorname",
      firstNamePlaceholder: "Vornamen eingeben",
      mobileNumber: "Mobilnummer",
      mobileNumberPlaceholder: "+49 123 456 789",
      email: "E-Mail",
      emailPlaceholder: "E-Mail-Adresse eingeben",
      dateOfBirth: "Geburtsdatum",
      selectDateOfBirth: "Geburtsdatum auswählen",
      residentAddress: "Wohnadresse",
      residentAddressPlaceholder: "Vollständige Wohnadresse eingeben",
      licenseSince: "Führerschein seit",
      selectLicenseSince: "Führerscheindatum auswählen",
      licenseNumber: "Führerschein Nr.",
      licenseNumberPlaceholder: "Führerscheinnummer eingeben",
      street: "Strasse, Haus-Nummer.",
      postal: "Postleitzahl, Ort",
      country: "Land",
      city: "Stadt",
      issuingCountry: "Ausstellungsland",
      issuingCity: "Ausstellungsstadt",
      issuingAuthority: "Ausstellende Behörde (Land, Stadt)",
      issuingAuthorityPlaceholder:
        "z.B. Deutschland, München, Kreisverwaltungsreferat",
      privacyNotice:
        "Ihre persönlichen Daten sind geschützt und werden nur für die Autovermietung verwendet, Um ein Fahrzeug zu mieten müssen Sie mindestens 18 Jahre alt sein und einen gültigen Führerschein besitzen, Alle Felder sind für die Buchungsbestätigung erforderlich.",
    },
    step4: {
      termsRequired:
        "Sie mussen den Allgemeinen Geschaftsbedingungen zustimmen.",
      title: "Zusammenfassung",
      bookingSummary: "Buchungszusammenfassung",
      package: "Paket:",
      vehicle: "Fahrzeug:",
      dailyRate: "Tagesrate:",
      pickup: "Abholung:",
      dropoff: "Rückgabe:",
      customer: "Kunde:",
      pickupDetails: "{{date}} um {{time}} Uhr",
      dropoffDetails: "{{date}} um {{time}} Uhr",
      optionalServices: "Optionale Dienstleistungen",
      services: {
        // Corresponds to id: "insurance"
        insurance: {
          name: "Vollkaskoversicherung",
          description:
            "Vollständiger Schutz für Ihre Miete ohne Selbstbeteiligung.",
        },
        // Corresponds to id: "gps"
        gps: {
          name: "GPS-Navigationssystem",
          description:
            "Professionelles GPS mit aktuellen Karten und Verkehrsinformationen.",
        },
        // Corresponds to id: "childSeat"
        childSeat: {
          name: "Kindersicherheitssitz",
          description:
            "EU-zugelassener Kindersicherheitssitz für Kinder bis zu 12 Jahre.",
        },
        // Corresponds to id: "additionalDriver"
        additionalDriver: {
          name: "Zusätzlicher Fahrer",
          description:
            "Fügen Sie Ihrem Mietvertrag einen weiteren autorisierten Fahrer hinzu.",
        },
      },
      iAgreeToThe: "Ich habe die",
      gtc: "AGB",
      and: "und die",
      privacyPolicy: "Datenschutzbestimmungen gelesen und stimme ihnen zu",
    },
    packages: {
      taxi: {
        name: "TAXI / UBER",
        description: "Wochenmiete",
        price: " CHF 340 / Woche",
        extra: "Voll ausgestattet: Fahrtenschreiber, Taxameter & Taxilampe",
        features: [
          "Unbegrenzte Kilometer",
          "Vollkaskoversicherung",
          "BPT-zugelassenes Fahrzeug",
        ],
      },
      tourist: {
        name: "Touristenmiete",
        description: "mit oder ohne Fahrer",
        price: "CHF 69 / Tag",
        features: [
          "100 km pro Tag inklusive",
          "Vollkaskoversicherung",
          "Attraktive Rabatte bei Monatsmiete",
        ],
      },
      business: {
        name: "Business / Firmenkunden",
        description: "Tages - Wochen - oder Monatsmiete",
        price: "Preis auf Anfrage",
        features: [
          "Individuelle Pakete",
          "Vollkaskoversicherung",
          "Vans für Gruppen",
          "Luxuslimousinen & Executive-Modelle",
          "Hybrid- & Elektrofahrzeuge",
          "Angebot innerhalb von 24 Stunden",
        ],
      },
    },
    date: "Abholdatum",
    office: "Unser Büro",
    at: "an",
    deliveryPickup: "Wir liefern das Fahrzeug an Ihren Wunschort",
    deliveryDropoff: "Wir holen das Fahrzeug an Ihrem Wunschort ab",
    deliveryNote:
      "Gegen eine Gebühr von CHF 2.00 pro gefahrenem Kilometer (berechnet ab unserem Standort). Nur gegen Vorauszahlung möglich (schweizweit)",
    time: "Uhrzeit",
  },
  common: {
    welcome: "Willkommen bei ZURIAUTO Luxusautos",
    hello: "Hallo {{name}}! Bereit, etwas Erstaunliches zu bauen?",
    loading: "Wird geladen...",
    error: "Etwas ist schief gelaufen",
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    close: "Schließen",
    open: "Öffnen",
    search: "Suchen",
    filter: "Filter",
    sort: "Sortieren",
    next: "Weiter",
    previous: "Zurück",
    home: "Startseite",
    about: "Über uns",
    contact: "Kontakt",
    contactUs: "Kontaktieren Sie uns für eine Probefahrt",
    testDrive: "Bereit zum Abheben",
    login: "Anmelden",
    logout: "Abmelden",
    register: "Registrieren",
    profile: "Profil",
    settings: "Einstellungen",
    dashboard: "Loslegen",
    currentLanguage: "Aktuelle Sprache",
    rtlModeActive: "RTL-Modus aktiv",
    learnMore: "Mehr erfahren",
    bookNow: "Jetzt buchen",
    viewDetails: "Details anzeigen",
    explore: "Erkunden",
    bookOnline: "Jetzt Fahrzeug online buchen",
    "404": {
      title: "404 - Seite nicht gefunden",
      subtitle: "Die von Ihnen gesuchte Seite existiert nicht.",
      cta: "Zurück zur Startseite",
    },
  },
  navigation: {
    home: "Startseite",
    about: "Über uns",
    cars: "Fahrzeuge",
    services: "Dienstleistungen",
    contact: "Kontakt",
    models: "Modelle",
    experience: "Erlebnis",
    blog: "Blog",
    carRental: "Autovermietung",
    vehicles: "Fahrzeuge",
    pricing: "Preise",
    faq: "FAQ",
    benefits: "Vorteile",
    testimonials: "Kundenstimmen",
  },

  language: {
    english: "Englisch",
    german: "Deutsch",
    change: "Sprachunterstützung",
    content:
      "Unterstützung für Englisch und Deutsch mit vollständigen i18n-Funktionen.",
    de: "Deutsch",
    en: "Englisch",
  },

  models: {
    title: "Modelle",
    sportlimousine: "ZURIAUTO e-Sportlimousine",
    q2concept: "ZURIAUTO Q2 Concept",
    cityEV: "ZURIAUTO City EV",
    suv: "ZURIAUTO SUV",
    roadster: "ZURIAUTO Roadster",
    hyperGT: "ZURIAUTO Hyper GT",
    luxurySedan: "ZURIAUTO Luxus Limousine",
  },
  company: {
    title: "Unternehmen",
    aboutUs: "Über uns",
    sustainability: "Nachhaltigkeit",
    careers: "Karriere",
    press: "Presse",
  },
  contact: {
    title: "Kontakt",
    address1: "1234 Luxury Drive",
    address2: "San Francisco, CA 94103",
    email: "info@zuriauto.ch",
    phone: "+1 (555) 123-4567",
    bookTestDrive: "JETZT BUCHEN ",
  },
  footer: {
    copyright: "© {{year}} ZURIAUTO Luxusfahrzeuge. Alle Rechte vorbehalten.",
    privacyPolicy: "Datenschutzrichtlinie",
    termsOfService: "Nutzungsbedingungen",
    cookiePolicy: "Cookie-Richtlinie",
  },
  carDetails: {
    blissTitle: "2.8S REINES VERGNÜGEN.",
    blissDescription:
      "0-100 Kilometer in knapp unter 3 Sekunden. Elegant, sportlich und mit einem außergewöhnlichen Design, das den besonderen Charakter dieses Autos als Plattform für eine revolutionäre neue Antriebstechnologie unterstreicht – das ist die ZURIAUTO e-Sportlimousine bei ihrer Weltpremiere.",
    jetLifeTitle: "DAS JET-LEBEN.",
    jetLifeDescription:
      "Zwei Sitzreihen im Cockpit-Stil. Monocoque-Konstruktion aus Kohlefaser. Windschutzscheiben-Display-Technologie mit mehr als 1,25 Metern Breite und 16 Zentimetern. Das ist moderner Luxus wie nie zuvor.",
    collectionTitle: "DIE ZURIAUTO KOLLEKTION",
    exploreInterior: "INNENRAUM ERKUNDEN",
    signUpTestDrive: "ANMELDEN ZUR PROBEFAHRT",
    creditCheckNotice:
      "* Alle Gäste, die das Auto Probe fahren möchten, werden einer Bonitätsprüfung unterzogen.",
    countdown: {
      peopleAhead: "PERSONEN VOR IHNEN",
      daysLeft: "TAGE ÜBRIG ZUM FAHREN",
    },
  },
  carRental: {
    hero: {
      title: [
        "Zürich Auto Vermietung",
        "TAXI UBER TOURISTEN",
        "ALL INKLUSIVE",
        "Kilometer unbegrenzt",
      ],
      subtitle:
        "Sofort online buchbar, Vollkasko-Schutz inklusive und eine topmoderne Flotte. Ihr perfektes Mietauto für Zürich und die ganze Schweiz.",
      cta: "Jetzt online buchen & sofort starten",
      ctaShort: "Jetzt online buchen",
      availability: "24/7 Verfügbarkeit",
    },
    vehicles: {
      title: "Unsere Fahrzeuge",
      subtitle:
        "Für jeden Zweck das richtige Fahrzeug – modern, top gewartet und perfekt auf Ihre Bedürfnisse zugeschnitten.",
      professionals: {
        title: "Für Profis (Taxi & Uber):",
        skodaOctavia: "Skoda Octavia Kombi – der zuverlässige Allrounder",
        mercedesE: "Mercedes E-Klasse – Premium-Komfort für Fahrgäste",
        toyotaPrius: "Toyota Prius (Hybrid) – effizient & umweltbewusst",
      },
      tourists: {
        title: "Für Touristen & Abenteurer:",
        vwGolf: "VW Golf – kompakt & sparsam",
        skodaKodiaq: "Skoda Kodiaq (SUV) – geräumig & sicher für Familien",
        teslaModel3: "Tesla Model 3 – nachhaltig & modern",
      },
    },
    services: {
      title: "Leistungen",
      subtitle: "Ein Paket, alles drin: Unser Rundum-Sorglos-Versprechen.",
      fullInsurance: "Vollkasko & Versicherung – immer inklusive",
      maintenance:
        "Wartung & Reparaturen – Reifen, Öl, Bremsen & mehr enthalten",
      unlimitedMileage:
        "Unbegrenzte Kilometer – grenzenlos fahren ohne Zusatzkosten",
      taxiUber: {
        title: "Taxi & Uber Fahrzeuge",
        description:
          "Sofort startklar, mit planbaren Fixkosten und Vollkasko inklusive.",
      },
      tourist: {
        title: "Touristische Autovermietung",
        description:
          "Schweiz entdecken – unbegrenzte Kilometer, moderne Fahrzeuge, maximale Freiheit.",
      },
      allInclusive: {
        title: "Rundum-Sorglos-Paket",
        description:
          "Versicherung, Wartungen & Reparaturen (Reifen, Öl, Bremsen usw.) inklusive.",
      },
    },
    benefits: {
      title: "Warum Sie bei uns genau richtig sind:",
      points: [
        "Sofort online buchbar",
        "Fixpreis – volle Kostenkontrolle",
        "Schweizweit mobil – von Zürich bis Genf",
        "Gesetzeskonform für Taxi & Uber",
        "Top-moderne Flotte",
      ],
      cta: "Jetzt online buchen & sofort starten",
    },
    pricing: {
      title: "Faire Preise & transparente Pakete – ohne Kleingedrucktes",
      packages: {
        taxiUber: {
          name: "Taxi & Uber",
          bestFor: "Berufsfahrer & Profis",
          example: "Skoda Octavia",
          price: "ab CHF 1'450 / Monat",
          included: "Unlimitiert km, Vollkasko, Wartung, Reparaturen, Reifen",
        },
        tourist: {
          name: "Touristik",
          bestFor: "Urlaub & Rundreisen",
          examples: {
            compact: "VW Golf (Kompakt) - ab CHF 75 / Tag",
            suv: "Skoda Kodiaq (SUV) - ab CHF 95 / Tag",
          },
          included: "Unlimitiert km, Vollkasko, Vignette, 24h-Pannenhilfe",
        },
        business: {
          name: "Business",
          bestFor: "Firmen & Langzeit",
          price: "Auf Anfrage",
          included: "Maßgeschneiderte Lösungen",
        },
      },
      cta: "Jetzt online buchen & sofort starten",
    },
    testimonials: {
      title: "Kundenstimmen",
      ahmed:
        "Dank des Fixpreis-Pakets habe ich meine Kosten als Uber-Fahrer voll im Griff. Fahrzeug topmodern & sofort einsatzbereit!",
      ahmedLocation: "Ahmed K., Zürich",
      emily:
        "Unbegrenzte Kilometer waren perfekt, um die ganze Schweiz zu erkunden. Einfach buchen, losfahren, genießen.",
      emilyLocation: "Emily R., England",
    },
    faq: {
      title: "Häufig gestellte Fragen",
      questions: [
        {
          question: "Sind die Kilometer wirklich unbegrenzt?",
          answer: "Ja, absolut.",
        },
        {
          question: "Welche Versicherung ist enthalten?",
          answer: "Vollkasko mit fairem Selbstbehalt.",
        },
        {
          question: "Was passiert bei einer Panne?",
          answer: "24h-Pannenhilfe, Werkstattkosten inklusive.",
        },
        {
          question: "Erfüllen die Fahrzeuge Uber-Anforderungen?",
          answer: "Ja, alle Fahrzeuge sind geprüft & zugelassen.",
        },
        {
          question: "Sind alle Kosten im Preis enthalten?",
          answer: "Ja – keine versteckten Gebühren.",
        },
      ],
    },
    contact: {
      title: "Kontakt & Buchung",
      location: "Musterstrasse 1, 8000 Zürich – Schweizweit verfügbar",
      email: "info@ihre-domain.ch",
      phone: "+41 44 XXX XX XX",
      cta: "Jetzt online buchen & sofort starten",
      response: "Wir antworten innerhalb von 24 Stunden",
    },
  },
  terms: {
    title: "Allgemeine Geschäftsbedingungen & Mietvertrag",
    company: "Zuriauto (Digihome Swiss AG)",

    sections: {
      parties: {
        title: "1. Vertragsparteien",
        owner:
          "Eigentümer / Vermieter: Digihome Swiss AG, Tannenstrasse 16, 8424 Embrach Handelsmarke: Zuriauto E-Mail: info@zuriauto.ch",
        renter:
          "Mieter / Halter / Fahrer: Die im Buchungsvorgang online oder im Vertrag angegebenen persönlichen Daten (Name, Adresse, Geburtsdatum, Führerscheindaten, Kontakt).",
      },

      subject: {
        title: "2. Vertragsgegenstand",
        content:
          "Zuriauto vermietet Fahrzeuge (inkl. taxi-lizenzierte und Uber-kompatible Autos, Ersatzfahrzeuge, Kurz- und Langzeitmieten, Business-Mietlösungen) an private und geschäftliche Kunden. Der Eigentümer überlässt dem Mieter das Fahrzeug gemäss Buchungsbestätigung (Marke/Modell, Fahrgestell-Nr., Kontrollschild). Das Fahrzeug bleibt jederzeit im Eigentum des Eigentümers.",
      },

      conclusion: {
        title: "3. Vertragsabschluss & Annahme der AGB",
        content:
          "Ein Mietvertrag kommt zustande, wenn Zuriauto eine elektronische Buchungsbestätigung ausstellt, oder der Kunde die Mietgebühr bezahlt, oder beide Parteien den Vertrag online oder offline bestätigen. Bei Online-Buchungen akzeptiert der Kunde die AGB aktiv (z. B. durch Ankreuzen 'Ich habe die AGB gelesen und stimme zu').",
      },

      duration: {
        title: "4. Vertragsdauer & Kündigung",
        content:
          "Der Vertrag wird für die in der Buchung vereinbarte Dauer geschlossen. Bei längerfristigen Verträgen gilt eine Mindestdauer von einem Jahr; er verlängert sich automatisch, sofern er nicht mit 7 Tagen Frist schriftlich gekündigt wird. Eine ausserordentliche Kündigung aus wichtigem Grund ist jederzeit möglich.",
      },

      rates: {
        title: "5. Preise & Zahlung",
        content:
          "Alle Preise verstehen sich in CHF inkl. MwSt., sofern nicht anders angegeben. Die Mietrate ist im Voraus fällig. Akzeptierte Zahlungsmethoden: Kredit-/Debitkarte, Twint, Banküberweisung, genehmigte Rechnungsstellung. Bei Zahlungsverzug fallen Mahngebühren, 7 % Verzugszinsen p.a. und Inkassokosten an. Ohne Zahlung erfolgt keine Fahrzeugübergabe.",
      },

      deposit: {
        title: "6. Kaution & Versicherung",
        content:
          "Bei Übergabe ist eine Kaution zu hinterlegen (abhängig von Fahrzeugklasse). Das Fahrzeug ist obligatorisch haftpflichtversichert; eine Vollkaskoversicherung besteht. Im Schadenfall trägt der Mieter den Selbstbehalt. Schäden durch grobe Fahrlässigkeit, illegale Nutzung oder Verstösse gegen Versicherungsbestimmungen gehen voll zulasten des Mieters. Bei Totalschaden wird der Fahrzeugwert durch die Versicherung an den Eigentümer ausbezahlt.",
      },

      use: {
        title: "7. Nutzung & Pflichten des Mieters",
        obligations: [
          "Über einen in der Schweiz anerkannten Führerschein verfügen.",
          "Fahrzeug ausschliesslich für den vereinbarten Zweck nutzen.",
          "Die Schweizer Verkehrsregeln einhalten.",
          "Keine Weitervermietung, Weitergabe oder Verkauf ohne Zustimmung.",
          "Keine illegale, sportliche oder Offroad-Nutzung.",
          "Fahrzeug pfleglich behandeln und regelmässig reinigen.",
          "Unfälle, Schäden oder Diebstahl unverzüglich melden.",
          "Rauchen im Fahrzeug ist untersagt.",
        ],
      },

      handover: {
        title: "8. Fahrzeugübergabe & Rückgabe",
        content:
          "Übergabe in sauberem, fahrbereitem Zustand mit dokumentiertem Kilometerstand. Rückgabe pünktlich, verkehrssicher, sauber und mit gleichem Tankstand. Normale Gebrauchsspuren sind zulässig; Schäden darüber hinaus trägt der Mieter. Bei verspäteter Rückgabe können zusätzliche Gebühren berechnet werden. Fahrzeugpapiere und Schlüssel sind vollständig zurückzugeben. Mit Übergabe (Ort, Datum, Uhrzeit) geht die Haftung auf den Mieter über.",
      },

      maintenance: {
        title: "9. Betriebskosten & Wartung",
        lessor:
          "Eigentümer trägt Kosten für: Steuern, Motorfahrzeugabgaben, Servicearbeiten, Pneuwechsel, mechanische Reparaturen (sofern nicht durch Mieter verursacht).",
        lessee:
          "Mieter trägt Kosten für: Treibstoff, Verbrauchsmaterialien, Reinigung, Selbstbehalte.",
      },

      cancellation: {
        title: "10. Stornierung & Rückerstattung",
        rules: [
          "Bis 7 Tage vor Mietbeginn: 100 % Rückerstattung minus CHF 50 Admin-Gebühr.",
          "3–6 Tage vor Mietbeginn: 50 % Rückerstattung.",
          "Weniger als 72 Stunden: keine Rückerstattung.",
          "Drittanbieter-Kosten (Versicherungen, Vignette etc.) sind nicht rückerstattbar.",
          "Nichterscheinen gilt als späte Stornierung ohne Anspruch auf Rückerstattung.",
          "Vorzeitige Rückgabe begründet keinen Anspruch auf Rückerstattung.",
        ],
      },

      liability: {
        title: "11. Haftung",
        content:
          "Der Mieter haftet für sämtliche während der Mietdauer entstehenden Schäden, Bussgelder und Ansprüche Dritter. Zuriauto haftet nur für vorsätzlich oder grob fahrlässig verursachte Schäden. Die Haftung von Zuriauto ist auf den Mietbetrag begrenzt.",
      },

      data: {
        title: "12. Datenschutz",
        content:
          "Die Verarbeitung personenbezogener Daten erfolgt gemäss Schweizer DSG und ggf. DSGVO. Details in der Datenschutzerklärung: www.zuriauto.ch/privacy.",
      },

      complaints: {
        title: "13. Reklamationen",
        content:
          "Beschwerden sind unverzüglich während der Mietdauer oder spätestens 7 Tage nach Rückgabe an info@zuriauto.ch zu richten.",
      },

      force: {
        title: "14. Höhere Gewalt",
        content:
          "Zuriauto haftet nicht für Ausfälle aufgrund von Naturkatastrophen, Streiks, Pandemien, behördlichen Massnahmen oder Ausfällen von Drittanbietern.",
      },

      final: {
        title: "15. Schlussbestimmungen",
        content:
          "Änderungen und Ergänzungen nur schriftlich. Gerichtsstand ist Zürich, Schweiz. Es gilt ausschliesslich Schweizer Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt der Rest gültig.",
      },
    },
    version: "09.09.2025",
  },
  privacy: {
    title: "Datenschutzerklärung – Zuriauto (Digihome Swiss AG)",
    sections: {
      introduction: {
        title: "1. Einleitung & Verantwortlicher",
        content:
          "Ihre Privatsphäre ist uns wichtig. Diese Datenschutzerklärung erklärt, wie Digihome Swiss AG, handelnd unter der Marke Zuriauto, Ihre Daten verarbeitet.",
        controller:
          "Digihome Swiss AG, Tannenstrasse 16, 8424 Embrach, Schweiz",
        email: "info@zuriauto.ch",
        dataProtectionContact:
          "Herr Katamesh, erreichbar unter info@zuriauto.ch",
      },
      childProtection: {
        title: "2. Kinder- & Jugendschutz",
        content:
          "Unsere Dienstleistungen richten sich ausschliesslich an volljährige Fahrer (18+). Eine Vermietung oder Datenerhebung von Minderjährigen erfolgt nicht.",
      },
      dataCollected: {
        title: "3. Welche Daten wir erheben",
        items: [
          "Identitäts- & Kontaktdaten (Name, Adresse, Geburtsdatum, Führerschein)",
          "Vertrags- & Buchungsdaten",
          "Zahlungs- & Finanzdaten",
          "Fahrzeug- & Telematikdaten (GPS, Kilometerstand, Zustand)",
          "Technische Website-Daten (IP, Cookies)",
          "Kommunikationsdaten",
        ],
      },
      purpose: {
        title: "4. Zwecke & Rechtsgrundlagen",
        content:
          "Wir verarbeiten Ihre Daten zur Vertragserfüllung, zur Erfüllung gesetzlicher Pflichten (z.B. Verkehrsbehörden), zur Wahrung berechtigter Interessen (z.B. Diebstahlschutz, Inkasso) und mit Ihrer Einwilligung.",
      },
      disclosure: {
        title: "5. Weitergabe an Dritte",
        content:
          "Daten werden nur an vertrauenswürdige Partner weitergegeben: Versicherungen, Zahlungsanbieter, Behörden, IT-Provider, Inkassodienste.",
      },
      transfers: {
        title: "6. Internationale Datenübermittlung",
        content:
          "Falls Daten ins Ausland übertragen werden, stellen wir durch Standardvertragsklauseln oder andere geeignete Garantien sicher, dass ein angemessenes Schutzniveau besteht.",
      },
      retention: {
        title: "7. Aufbewahrung",
        content:
          "Daten werden nur so lange gespeichert, wie es für die Zwecke erforderlich ist. Finanz- und Vertragsdaten: 10 Jahre. Fahrzeug-GPS-Daten: Löschung/Anonymisierung nach Mietende.",
      },
      security: {
        title: "8. Datensicherheit",
        content:
          "Wir schützen Ihre Daten mit technischen und organisatorischen Massnahmen (SSL, Zugriffskontrollen, regelmässige Prüfungen).",
      },
      rights: {
        title: "9. Ihre Rechte",
        content:
          "Sie haben Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit. Beschwerden: Eidg. Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB).",
      },
      cookies: {
        title: "10. Cookies",
        content:
          "Unsere Website nutzt sowohl notwendige Cookies (z.B. für Buchungsprozesse) als auch Analyse- und Marketing-Cookies (z.B. Google Analytics). Nutzer können ihre Zustimmung jederzeit im Cookie-Banner anpassen.",
      },
      changes: {
        title: "11. Änderungen & Versionierung",
        content:
          "Wir können diese Policy anpassen. Gültig ist die jeweils aktuelle Version auf unserer Website.",
      },
    },
    version: "09.09.2025",
  },
  legalNotice: {
    brandName: "ZuriAuto",
    ownedBy: "DIGIHOME SWISS AG",
    tradingRegister:
      "Handelsregister Zürich Nr. CHE-199.884.159 – Schweizer Aktiengesellschaft (AG)",
    address: "Tannenstrasse 1, 8424 Embrach, Zürich",
    headOffice: "Schaffhauserstrasse 550, 8052 Zürich, Schweiz",
    representedBy: "Ahmed Katamesh",
    email: "info@zuriauto.ch",
  },
} as const;

export default de;
