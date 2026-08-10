// locales/en.ts
const en = {
  booking: {
    wizard: {
      toast: {
        loading: "Submitting your booking...",
        success:
          "Booking request sent! Please check your email for confirmation.",
        error: "Submission failed. Please try again later.",
      },
      errors: {
        correctFields: "Please correct the errors above to continue.",
        acceptTerms:
          "Please accept the terms and conditions to complete your booking.",
      },
      submitting: "Submitting...",
      title: "Book Your Car",
      subtitle: "Complete your reservation in {{totalSteps}} simple steps",
      previous: "Previous",
      next: "Next",
      stepIndicator: "Step {{currentStep}} of {{totalSteps}}",
      total: "Total",
      day: "day",
      day_other: "days", // for pluralization
      submitButton: "Send Booking Request",
      submitMessage:
        "Your booking request has been prepared! Please send the email that just opened in your email client. We will respond within 24 hours with confirmation and payment details.",
    },
    step1: {
      title: "Booking Details",
      selectPackage: "Select Package",
      pickupLocation: "Pickup Location",
      dropoffLocation: "Dropoff Location",
      selectPickupLocation: "Select pickup location",
      selectDropoffLocation: "Select dropoff location",
      chooseDates: "Choose Dates",
      from: "From",
      till: "Till",
      day: "day",
      day_other: "days", // for pluralization
      hideCalendar: "Hide Calendar",
      showCalendar: "Show Calendar",
      selectPickupDate: "Select Pickup Date",
      selectDropoffDate: "Select Dropoff Date",
      pickupDateTime: "Pickup Date & Time",
      dropoffDateTime: "Dropoff Date & Time",
      timeRange: "Time (09:00 - 21:00)",
      noPickupDateSelected: "Select Pickup date",
      noDropoffDateSelected: "Select Return date",
      noDateSelected: "Select your rental period",
      to: "To",
      locations: [
        { value: "", label: "Select location" },
        { value: "airport", label: "Prague Airport (PRG)" },
        { value: "central-station", label: "Prague Central Station" },
        { value: "old-town", label: "Old Town Square" },
        { value: "wenceslas-square", label: "Wenceslas Square" },
        { value: "hotel-delivery", label: "Hotel Delivery (+€10)" },
        { value: "hotel-pickup", label: "Hotel Pickup (+€10)" },
      ],
    },
    step2: {
      title: "Select Your Vehicle",
      labels: {
        seats: "Seats",
        doors: "Doors",
        hasAc: "A/C",
        noAc: "No A/C",
        hasGps: "GPS",
        noGps: "No GPS",
      },
      categories: {
        estate: "Estate",
        luxury: "Luxury",
        hybrid: "Hybrid",
        compact: "Compact",
        suv: "SUV",
        electric: "Electric",
      },
      transmissions: {
        manual: "Manual",
        automatic: "Automatic",
      },
      fuels: {
        petrol: "Petrol",
        hybrid: "Hybrid",
        electric: "Electric",
      },
      specs: {
        engine: "Engine",
        consumption: "Consumption",
        luggage: "Luggage",
      },
      vehicles: {
        "skoda-octavia": {
          name: "Skoda Octavia Combi",
          features: ["Large boot space", "Economical", "Reliable"],
        },
        "mercedes-e": {
          name: "Mercedes E-Class",
          features: [
            "Luxury interior",
            "Premium sound system",
            "Leather seats",
          ],
        },
        "toyota-prius": {
          name: "Toyota Prius Hybrid",
          features: [
            "Eco-friendly",
            "Excellent fuel economy",
            "Modern technology",
          ],
        },
        "vw-golf": {
          name: "Volkswagen Golf",
          features: ["Sporty design", "Easy to park", "Great handling"],
        },
        "skoda-kodiaq": {
          name: "Skoda Kodiaq SUV",
          features: ["7 seats", "High driving position", "All-weather capable"],
        },
        "tesla-model3": {
          name: "Tesla Model 3",
          features: ["Zero emissions", "Autopilot", "Premium interior"],
        },
      },
    },
    step3: {
      title: "Personal Information",
      bookingType: "Booking Through",
      person: "Person",
      company: "Company",
      companyName: "Company Name",
      companyNamePlaceholder: "Enter company name",
      familyName: "Family Name",
      familyNamePlaceholder: "Enter your family name",
      firstName: "First Name",
      firstNamePlaceholder: "Enter your first name",
      mobileNumber: "Mobile Nr.",
      mobileNumberPlaceholder: "+420 123 456 789",
      email: "Email",
      emailPlaceholder: "Enter your email address",
      dateOfBirth: "Date of Birth",
      selectDateOfBirth: "Select date of birth",
      residentAddress: "Resident Address",
      residentAddressPlaceholder: "Enter your full residential address",
      licenseSince: "Driving License Since",
      selectLicenseSince: "Select license date",
      licenseNumber: "Driving Licence Nr.",
      licenseNumberPlaceholder: "Enter your license number",
      issuingAuthority: "Issuing Country City Authority",
      street: "Street, House Nr.",
      postal: "Postal Code, City",
      country: "Country",
      city: "City",
      issuingCountry: "Issuing Country",
      issuingCity: "Issuing City",
      issuingAuthorityPlaceholder:
        "e.g., Czech Republic, Prague, Municipal Authority",
      privacyNotice:
        "Your personal data is protected and will only be used for car rental, You must be at least 18 years old and hold a valid driver’s license to rent a vehicle, All fields are required for booking confirmation.",
    },
    step4: {
      termsRequired: "You must agree to the General Terms and Conditions.",
      title: "Summary",
      bookingSummary: "Booking Summary",
      package: "Package:",
      vehicle: "Vehicle:",
      dailyRate: "Daily Rate:",
      pickup: "Pickup:",
      dropoff: "Dropoff:",
      customer: "Customer:",
      pickupDetails: "{{date}} at {{time}}",
      dropoffDetails: "{{date}} at {{time}}",
      optionalServices: "Optional Services",
      services: {
        // Corresponds to id: "insurance"
        insurance: {
          name: "Full Insurance Coverage",
          description:
            "Complete protection for your rental with zero deductible.",
        },
        // Corresponds to id: "gps"
        gps: {
          name: "GPS Navigation System",
          description:
            "Professional GPS with updated maps and traffic information.",
        },
        // Corresponds to id: "childSeat"
        childSeat: {
          name: "Child Safety Seat",
          description:
            "EU-approved child safety seat for children up to 12 years.",
        },
        // Corresponds to id: "additionalDriver"
        additionalDriver: {
          name: "Additional Driver",
          description:
            "Add an extra authorized driver to your rental agreement.",
        },
      },
      iAgreeToThe: "I have read and agree to the",
      gtc: "GTC",
      and: "and the",
      privacyPolicy: "Privacy Policy",
    },
    packages: {
      taxi: {
        name: "TAXI / UBER",
        description: "Weekly rental",
        price: "CHF 340 / week",
        extra: "Fully equipped: tachograph, taximeter & taxi light",
        features: [
          "Unlimited kilometers",
          "Comprehensive insurance",
          "BPT-approved vehicle",
        ],
      },
      tourist: {
        name: "Tourist rental",
        description: "With or without driver",
        price: "CHF 69 / day",
        features: [
          "100 km per day included",
          "Comprehensive insurance",
          "Attractive discounts for monthly rental",
        ],
      },
      business: {
        name: "Business / Corporate clients",
        description: "Daily, weekly, or monthly rental",
        price: "Price on request",
        features: [
          "Customized packages",
          "Comprehensive insurance",
          "Vans for groups",
          "Luxury limousines & executive models",
          "Hybrid & electric vehicles",
          "Offer within 24 hours",
        ],
      },
    },
    time: "Time",
    date: "Date",
    at: "at",
    office: "Our Office",
    deliveryPickup: "Vehicle delivery to your desired location",
    deliveryDropoff: "Vehicle pickup from any location in Switzerland",
    deliveryNote:
      "Against Fees CHF 2.00 per kilometer (calculated from our Zurich office location)",
  },
  common: {
    welcome: "Welcome to ZURIAUTO Luxury Cars",
    hello: "Hello {{name}}! Ready to build something amazing?",
    loading: "Loading...",
    error: "Something went wrong",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    open: "Open",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    next: "Next",
    previous: "Previous",
    home: "Home",
    about: "About",
    contact: "Contact",
    contactUs: "Contact us for a test drive",
    testDrive: "Prepare for takeoff",
    login: "Login",
    logout: "Logout",
    register: "Register",
    profile: "Profile",
    settings: "Settings",
    dashboard: "Get Started",
    currentLanguage: "Current language",
    rtlModeActive: "RTL Mode Active",
    learnMore: "Learn More",
    bookNow: "Book Now",
    viewDetails: "View Details",
    explore: "Explore",
    bookOnline: "Book your car online now",
    "404": {
      title: "404 - Page Not Found",
      subtitle: "The page you are looking for does not exist.",
      cta: "Go back to Home",
    },
  },
  navigation: {
    home: "Home",
    about: "About",
    cars: "Cars",
    services: "Services",
    contact: "Contact",
    models: "Models",
    experience: "Experience",
    blog: "Blog",
    carRental: "Car Rental",
    vehicles: "Vehicles",
    pricing: "Pricing",
    faq: "FAQ",
    benefits: "Benefits",
    testimonials: "Testimonials",
  },

  language: {
    change: "Change language",
    de: "German",
    en: "English",
    german: "German",
    english: "English",
    content: "Support for English and German with full i18n capabilities.",
  },

  models: {
    title: "Models",
    sportlimousine: "ZURIAUTO e-Sportlimousine",
    q2concept: "ZURIAUTO Q2 Concept",
    cityEV: "ZURIAUTO City EV",
    suv: "ZURIAUTO SUV",
    roadster: "ZURIAUTO Roadster",
    hyperGT: "ZURIAUTO Hyper GT",
    luxurySedan: "ZURIAUTO Luxury Sedan",
  },
  company: {
    title: "Company",
    aboutUs: "About Us",
    sustainability: "Sustainability",
    careers: "Careers",
    press: "Press",
  },
  contact: {
    title: "Contact",
    address1: "1234 Luxury Drive",
    address2: "San Francisco, CA 94103",
    email: "info@zuriauto.ch",
    phone: "+1 (555) 123-4567",
    bookTestDrive: "Book Now",
  },
  footer: {
    copyright: "© {{year}} ZURIAUTO Luxury Vehicles. All rights reserved.",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    cookiePolicy: "Cookie Policy",
  },
  carDetails: {
    blissTitle: "2.8S OF BLISS.",
    blissDescription:
      "0-100 Kilometers in just under 3 seconds. Elegant, sporty and with an extraordinary design that underscores the special character of this car as the platform for a revolutionary new powertrain technology – this is the ZURIAUTO e-Sportlimousine in its world premiere.",
    jetLifeTitle: "THE JET LIFE.",
    jetLifeDescription:
      "Two rows of seats, cockpit style. Carbon fiber monocoque construction. Windscreen display technology more than 1.25 meters wide and 16 centimeters. This is modern luxury like never before.",
    collectionTitle: "THE ZURIAUTO COLLECTION",
    exploreInterior: "EXPLORE INTERIOR",
    signUpTestDrive: "SIGN UP TO TEST DRIVE",
    creditCheckNotice:
      "* All guests who wish to test drive the car will be subject to a credit check.",
    countdown: {
      peopleAhead: "PEOPLE AHEAD OF YOU",
      daysLeft: "DAYS LEFT TO DRIVE",
    },
  },
  carRental: {
    hero: {
      title: [
        "Zurich Car Rental",
        "TAXI UBER TOURISTS",
        "ALL INCLUSIVE",
        "Unlimited Kilometers",
      ],

      subtitle:
        "Book instantly online, full insurance included, and a modern fleet. Your perfect rental car for Zurich and all of Switzerland.",
      cta: "Book online now & start driving immediately",
      ctaShort: "Book online now",
      availability: "24/7 Availability",
    },
    vehicles: {
      title: "Our Vehicles",
      subtitle:
        "The right car for every purpose – modern, well-maintained, and tailored to your needs.",
      professionals: {
        title: "For Professionals (Taxi & Uber):",
        skodaOctavia: "Skoda Octavia Combi – the reliable all-rounder",
        mercedesE: "Mercedes E-Class – premium comfort for passengers",
        toyotaPrius: "Toyota Prius (Hybrid) – efficient & eco-friendly",
      },
      tourists: {
        title: "For Tourists & Adventurers:",
        vwGolf: "VW Golf – compact & economical",
        skodaKodiaq: "Skoda Kodiaq (SUV) – spacious & safe for families",
        teslaModel3: "Tesla Model 3 – sustainable & modern",
      },
    },
    services: {
      title: "Services",
      subtitle:
        "One package, everything included: our all-round carefree promise.",
      fullInsurance: "Full insurance – always included",
      maintenance: "Maintenance & repairs – tires, oil, brakes & more covered",
      unlimitedMileage:
        "Unlimited mileage – drive without limits, no extra costs",
      taxiUber: {
        title: "Taxi & Uber Vehicles",
        description:
          "Ready to drive immediately, fixed monthly costs, full insurance included.",
      },
      tourist: {
        title: "Tourist Car Rental",
        description:
          "Discover Switzerland with unlimited mileage, modern cars & total freedom.",
      },
      allInclusive: {
        title: "All-Inclusive Package",
        description:
          "Insurance, maintenance & repairs included – from tires and oil to brakes.",
      },
    },
    benefits: {
      title: "Why rent with us:",
      points: [
        "Instant online booking",
        "Fixed price – full cost control",
        "Available across Switzerland – from Zurich to Geneva",
        "Legally approved for Taxi & Uber",
        "Modern fleet",
      ],
      cta: "Book online now & start driving immediately",
    },
    pricing: {
      title: "Fair prices & transparent packages – no hidden fees.",
      packages: {
        taxiUber: {
          name: "Taxi & Uber",
          bestFor: "Professional drivers",
          example: "Skoda Octavia",
          price: "CHF 1,450 / mo",
          included: "Unlimited km, full insurance, maintenance, tires",
        },
        tourist: {
          name: "Tourist",
          bestFor: "Holidays & trips",
          examples: {
            compact: "VW Golf (Compact) - CHF 75 / day",
            suv: "Skoda Kodiaq (SUV) - CHF 95 / day",
          },
          included:
            "Unlimited km, full insurance, motorway vignette, 24h assistance",
        },
        business: {
          name: "Business",
          bestFor: "Corporate clients",
          price: "Upon request",
          included: "Tailored fleet solutions",
        },
      },
      cta: "Book online now & start driving immediately",
    },
    testimonials: {
      title: "What Our Customers Say",
      ahmed:
        "Thanks to the fixed-price package, I have full control of my Uber costs. Car was modern & ready to drive immediately!",
      ahmedLocation: "Ahmed K., Zurich",
      emily:
        "Unlimited mileage was perfect to explore all of Switzerland. Booking was easy, the car in top condition.",
      emilyLocation: "Emily R., England",
    },
    faq: {
      title: "Frequently Asked Questions",
      questions: [
        {
          question: "Is mileage really unlimited?",
          answer: "Yes, absolutely.",
        },
        {
          question: "What insurance is included?",
          answer: "Full coverage with fair deductible.",
        },
        {
          question: "What happens in case of a breakdown?",
          answer: "24h roadside assistance, repairs included.",
        },
        {
          question: "Are vehicles Uber-compliant?",
          answer: "Yes, fully approved & licensed.",
        },
        {
          question: "Are all costs included in the price?",
          answer: "Yes – no hidden fees.",
        },
      ],
    },
    contact: {
      title: "Contact & Booking",
      location: "Musterstrasse 1, 8000 Zurich – Available across Switzerland",
      email: "info@your-domain.ch",
      phone: "+41 44 XXX XX XX",
      cta: "Book online now & start driving immediately",
      response: "We reply within 24 hours",
    },
  },
  privacy: {
    title: "Privacy Policy – Zuriauto (Rigitrade AG)",
    sections: {
      introduction: {
        title: "1. Introduction & Data Controller",
        content:
          "Your privacy is important to us. This Privacy Policy explains how Rigitrade AG, trading as Zuriauto, processes your data.",
        controller:
          "Rigitrade AG, Tannenstrasse 16, 8424 Embrach, Switzerland",
        email: "info@zuriauto.ch",
        dataProtectionContact: "Mr. Katamesh, reachable at info@zuriauto.ch",
      },
      childProtection: {
        title: "2. Child Protection",
        content:
          "Our services are exclusively intended for adult drivers (18+). We do not rent vehicles to or collect data from minors.",
      },
      dataCollected: {
        title: "3. Data We Collect",
        items: [
          "Identity & Contact Data (name, address, date of birth, driver’s license)",
          "Contract & Booking Data",
          "Payment & Financial Data",
          "Vehicle & Telematics Data (GPS, mileage, condition)",
          "Technical Website Data (IP, cookies)",
          "Communication Data",
        ],
      },
      purpose: {
        title: "4. Purpose and Legal Basis",
        content:
          "We process your data to fulfill the contract, to comply with legal obligations (e.g. traffic authorities), to protect legitimate interests (e.g. theft prevention, debt collection), and with your consent.",
      },
      disclosure: {
        title: "5. Disclosure to Third Parties",
        content:
          "Data is only shared with trusted partners: insurers, payment providers, authorities, IT providers, debt collection agencies.",
      },
      transfers: {
        title: "6. International Data Transfers",
        content:
          "If data is transferred abroad, we ensure adequate protection through standard contractual clauses or other safeguards.",
      },
      retention: {
        title: "7. Data Retention",
        content:
          "Data is only retained as long as necessary. Financial and contract data: 10 years. Vehicle GPS data: deleted/anonymized after rental ends.",
      },
      security: {
        title: "8. Data Security",
        content:
          "We protect your data with technical and organizational measures (SSL, access controls, regular audits).",
      },
      rights: {
        title: "9. Your Rights",
        content:
          "You have rights of access, rectification, erasure, restriction, data portability. Complaints: Swiss Federal Data Protection and Information Commissioner (FDPIC).",
      },
      cookies: {
        title: "10. Cookies",
        content:
          "Our website uses both necessary cookies (e.g. for booking processes) and analytics/marketing cookies (e.g. Google Analytics). Users can adjust their consent at any time in the cookie banner.",
      },
      changes: {
        title: "11. Changes & Versioning",
        content:
          "We may update this policy. The latest version is always available on our website.",
      },
    },
    version: "09.09.2025",
  },
  legalNotice: {
    brandName: "ZuriAuto",
    ownedBy: "RIGITRADE AG",
    tradingRegister:
      "Zurich Nr. CHE-199.884.159 - Swiss Public Limited Company (PLC)",
    address: "Tannenstrasse 1, 8424 Embrach, Zurich",
    headOffice: "Schaffhauserstrasse 550, 8052 Zürich, Switzerland",
    representedBy: "Ahmed Katamesh",
    email: "info@zuriauto.ch",
  },
} as const;

export default en;
