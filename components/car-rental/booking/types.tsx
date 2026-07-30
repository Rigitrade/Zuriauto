import { ReactNode } from "react";

export interface FormData {
  // Step 1
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  packageId: string; // Changed from packageType to packageId for consistency
  termsAccepted: boolean;

  // Step 2 (Previously Step 3)
  bookingType: string; // "person" | "company"
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  licenseSince: string;
  licenseNumber: string;
  street: string;
  postalCode: string;
  country: string;
  issuingCountry: string;
  issuingCity: string;

  // --- Commented out unused fields ---
  // packageType: string; // Use packageId instead
  // selectedVehicle: string;
  // residentAddress: string;
  // issuingAuthority: string;
  // insurance: boolean;
  // gps: boolean;
  // childSeat: boolean;
  // additionalDriver: boolean;

  // Index signature to allow dynamic property access
  [key: string]: string | boolean;
}

export interface Package {
  id: "taxi" | "tourist" | "business";
  name: string;
  description: string;
  price: string;
  extra?: string;
  features: string[];
}
export interface Vehicle {
  id: string;
  name: string;
  category: string;
  image: string;
  price: string;
  seats: number;
  doors: number;
  transmission: string;
  fuel: string;
  airConditioning: boolean;
  gps: boolean;
  features: string[];
  specs: {
    engine: string;
    consumption: string;
    luggage: string;
  };
}

export interface AdditionalService {
  id: "insurance" | "gps" | "childSeat" | "additionalDriver";
  name: string;
  price: string;
  description: string;
  icon: ReactNode;
}
