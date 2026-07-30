import WhatsAppButton from "@/components/WhatsAppButton";
import { I18nProvider } from "@/providers/I18nProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SEO Configuration - Updated with real business details
const siteUrl = "https://zuriauto.ch"; // Updated to actual domain
const siteName = "ZURIAUTO Car Rental";

export const metadata: Metadata = {
  // Basic Meta Tags - Optimized for actual business
  title: {
    default:
      "ZURIAUTO - Car Rental Zurich | Taxi, Uber, Tourist & Business Rentals",
    template: "%s | ZURIAUTO Car Rental",
  },
  description:
    "Professional car rental in Zurich for taxi drivers, Uber partners, tourists and businesses. All-inclusive packages with unlimited kilometers, full insurance, and 24/7 support. Modern fleet including Skoda Octavia, Mercedes E-Class, Tesla Model 3.",

  // Enhanced Keywords based on actual services
  keywords: [
    // German Primary Keywords
    "Autovermietung Zürich",
    "Auto mieten Zürich",
    "Taxi Auto mieten Zürich",
    "Uber Fahrzeug mieten",
    "Langzeitmiete Auto Zürich",
    "All-inclusive Automiete",
    "Skoda Octavia mieten",
    "Mercedes E-Klasse mieten",
    "Tesla Model 3 mieten",
    "Touristen Autovermietung Schweiz",
    "Business Autovermietung",
    "Unbegrenzte Kilometer Schweiz",
    "Vollkasko Versicherung inklusive",
    "24/7 Autovermietung Zürich",
    "BPT zugelassenes Taxi",
    "Uber Partner Fahrzeug",
    "CHF 1450 Monatsmiete Auto",
    "Professionelle Autovermietung",

    // English Primary Keywords
    "car rental Zurich",
    "rent car Zurich Switzerland",
    "taxi car rental",
    "Uber vehicle rental",
    "long term car rental Zurich",
    "all inclusive car rental",
    "unlimited mileage Switzerland",
    "professional car rental",
    "business car rental Zurich",
    "tourist car hire Switzerland",
    "monthly car rental",
    "weekly car rental",
    "rent Skoda Octavia",
    "rent Mercedes E-Class",
    "rent Tesla Model 3",
    "full insurance included",
    "24/7 car rental service",

    // Location-based Keywords
    "Autovermietung Embrach",
    "car rental near Zurich Airport",
    "Zürich Hauptbahnhof Autovermietung",
    "Swiss car rental service",
    "nationwide car delivery Switzerland",

    // Service-specific Keywords
    "Taxi lizenzierte Fahrzeuge",
    "BPT approved vehicles",
    "Uber compliant cars Switzerland",
    "hybrid car rental Switzerland",
    "electric car rental Zurich",
    "family car rental Switzerland",
    "luxury car rental Zurich",
  ],

  // Author and Publisher - Updated
  authors: [{ name: "ZURIAUTO - Digihome Swiss AG" }],
  creator: "Digihome Swiss AG",
  publisher: "ZURIAUTO Car Rental",

  // Robots and Indexing
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Language and Region - Updated for Swiss market
  alternates: {
    canonical: siteUrl,
  },

  // Open Graph - Updated with real business value proposition
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: siteUrl,
    siteName: siteName,
    title:
      "ZURIAUTO - Professional Car Rental Zurich | Taxi, Uber & Tourist Rentals",
    description:
      "Switzerland's leading car rental service for professionals and tourists. All-inclusive packages from CHF 69/day (tourists) to CHF 1,450/month (taxi/Uber). Unlimited kilometers, full insurance, modern fleet including Tesla, Mercedes, Skoda.",
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "ZURIAUTO Car Rental Fleet - Professional Cars in Switzerland",
        type: "image/jpeg",
      },
    ],
  },

  // Twitter Card - Updated
  twitter: {
    card: "summary_large_image",
    site: "@zuriauto",
    creator: "@zuriauto",
    title: "ZURIAUTO - Car Rental Zurich | All-Inclusive Packages",
    description:
      "Professional car rental for taxi, Uber, tourism & business. Unlimited km, full insurance, modern fleet. From CHF 69/day.",
    images: [`${siteUrl}/twitter-image.jpg`],
  },

  // Additional Meta Tags - Updated
  metadataBase: new URL(siteUrl),
  category: "Car Rental & Vehicle Leasing",
  classification: "Transportation Services",

  // App-specific
  applicationName: siteName,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",

  // Verification codes (replace with actual when available)
  verification: {
    google: "0B0WXqjgPTnFGPh4QlHh2r_O86goBX9Js4NA6uavW4Q",
    // other: {
    //   "msvalidate.01": "bing-verification-code",
    // },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Enhanced Structured Data (JSON-LD) based on actual business
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CarRental",
    name: "ZURIAUTO Car Rental",
    alternateName: "Digihome Swiss AG",
    description:
      "Professional car rental services in Switzerland specializing in taxi-licensed vehicles, Uber-compatible cars, tourist rentals, and long-term business solutions with all-inclusive packages.",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    image: `${siteUrl}/og-image.jpg`,
    telephone: "+41-44-XXX-XX-XX", // Replace with actual number
    email: "info@zuriauto.ch",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tannenstrasse 16",
      addressLocality: "Embrach",
      addressRegion: "Zurich",
      postalCode: "8424",
      addressCountry: "CH",
    },
    // geo: {
    //   "@type": "GeoCoordinates",
    //   latitude: "47.5017", // Embrach coordinates
    //   longitude: "8.5967",
    // },
    openingHours: "Mo-Su 00:00-23:59",
    priceRange: "CHF 69 - CHF 1450",
    areaServed: [
      {
        "@type": "Country",
        name: "Switzerland",
      },
      {
        "@type": "State",
        name: "Zurich Canton",
      },
      {
        "@type": "City",
        name: "Zurich",
      },
    ],
    serviceType: [
      "Taxi Vehicle Rental",
      "Uber Car Rental",
      "Tourist Car Rental",
      "Long-term Car Rental",
      "Business Vehicle Leasing",
      "Electric Car Rental",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "ZURIAUTO Rental Packages",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Taxi & Uber Package",
          description:
            "Professional taxi and Uber vehicle rental with BPT approval",
          price: "1450",
          priceCurrency: "CHF",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "1450",
            priceCurrency: "CHF",
            unitText: "monthly",
          },
          itemOffered: {
            "@type": "Service",
            name: "Taxi & Uber Car Rental",
            description:
              "All-inclusive package with unlimited kilometers, full insurance, maintenance, and BPT-approved vehicles",
          },
        },
        {
          "@type": "Offer",
          name: "Tourist Package",
          description:
            "Daily and weekly rentals for tourists exploring Switzerland",
          price: "69",
          priceCurrency: "CHF",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "69",
            priceCurrency: "CHF",
            unitText: "daily",
          },
          itemOffered: {
            "@type": "Service",
            name: "Tourist Car Rental",
            description:
              "Unlimited kilometers, full insurance, and modern vehicles for exploring Switzerland",
          },
        },
        {
          "@type": "Offer",
          name: "Business Package",
          description: "Customized fleet solutions for corporate clients",
          price: "Contact for pricing",
          itemOffered: {
            "@type": "Service",
            name: "Business Car Rental",
            description:
              "Tailored packages including luxury vehicles, vans, and hybrid/electric options",
          },
        },
      ],
    },
    vehicleFleet: [
      {
        "@type": "Car",
        name: "Skoda Octavia Combi",
        brand: "Skoda",
        model: "Octavia",
        bodyType: "Estate",
        fuelType: "Petrol",
      },
      {
        "@type": "Car",
        name: "Mercedes E-Class",
        brand: "Mercedes-Benz",
        model: "E-Class",
        bodyType: "Sedan",
        fuelType: "Petrol",
      },
      {
        "@type": "Car",
        name: "Tesla Model 3",
        brand: "Tesla",
        model: "Model 3",
        bodyType: "Sedan",
        fuelType: "Electric",
      },
      {
        "@type": "Car",
        name: "Toyota Prius",
        brand: "Toyota",
        model: "Prius",
        bodyType: "Hatchback",
        fuelType: "Hybrid",
      },
    ],
    sameAs: [
      "https://facebook.com/zuriauto",
      "https://instagram.com/zuriauto",
      "https://linkedin.com/company/zuriauto",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "127",
      bestRating: "5",
    },
    review: [
      {
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: "5",
        },
        author: {
          "@type": "Person",
          name: "Ahmed K.",
        },
        reviewBody:
          "Thanks to the fixed-price package, I have full control of my Uber costs. Car was modern & ready to drive immediately!",
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* Enhanced Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        {/* Additional Meta Tags - Updated */}
        <meta name="theme-color" content="#1e293b" />
        <meta name="color-scheme" content="light dark" />
        <meta name="format-detection" content="telephone=no" />

        {/* Swiss/German specific meta tags */}
        <meta name="geo.region" content="CH-ZH" />
        <meta name="geo.placename" content="Zurich, Switzerland" />
        <meta name="geo.position" content="47.3769;8.5417" />
        <meta name="ICBM" content="47.3769, 8.5417" />

        {/* Business specific tags */}
        <meta name="rating" content="General" />
        <meta name="distribution" content="Global" />
        <meta name="revisit-after" content="7 days" />

        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Enhanced Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Preload critical resources */}
        <link rel="preload" href="/hero-image.webp" as="image" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <Toaster />
        <WhatsAppButton />
      </body>
    </html>
  );
}
