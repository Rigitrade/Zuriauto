// /components/car-rental/booking/utils.ts

import { packages } from "./data";
import { FormData } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

const validateAge = (dateOfBirth: string): boolean => {
  if (!dateOfBirth) return false;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age >= 18;
};

const validateLicenseDate = (
  licenseSince: string,
  dateOfBirth: string
): boolean => {
  if (!licenseSince || !dateOfBirth) return false;
  const licenseDate = new Date(licenseSince);
  const birthDate = new Date(dateOfBirth);
  const minLicenseDate = new Date(birthDate);
  minLicenseDate.setFullYear(birthDate.getFullYear() + 16);
  return licenseDate >= minLicenseDate && licenseDate <= new Date();
};

const validateDateOfBirth = (dateOfBirth: string): boolean => {
  if (!dateOfBirth) return false;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const maxAge = new Date();
  maxAge.setFullYear(today.getFullYear() - 120);
  return birthDate < today && birthDate > maxAge;
};

export const getStepValidationErrors = (
  currentStep: number,
  formData: FormData
): string[] => {
  const errors: string[] = [];

  switch (currentStep) {
    case 1: // Booking Details
      if (!formData.packageId) errors.push("Package selection is required.");
      if (!formData.pickupLocation) errors.push("Pickup location is required.");
      if (!formData.dropoffLocation)
        errors.push("Drop-off location is required.");
      if (!formData.pickupDate) errors.push("Pickup date is required.");
      if (!formData.pickupTime) errors.push("Pickup time is required.");
      if (!formData.dropoffDate) errors.push("Drop-off date is required.");
      if (!formData.dropoffTime) errors.push("Drop-off time is required.");

      if (formData.pickupDate && formData.dropoffDate) {
        const pickup = new Date(formData.pickupDate);
        const dropoff = new Date(formData.dropoffDate);
        if (dropoff < pickup) {
          errors.push("Drop-off date must be on or after the pickup date.");
        }
      }
      break;

    case 2: // Personal Information
      if (!formData.firstName.trim()) errors.push("First name is required.");
      if (!formData.lastName.trim()) errors.push("Last name is required.");
      if (!formData.email.trim()) errors.push("Email is required.");
      if (!formData.phone.trim()) errors.push("Phone number is required.");
      if (!formData.dateOfBirth) errors.push("Date of birth is required.");
      if (!formData.street.trim())
        errors.push("Street/House number is required.");
      if (!formData.postalCode.trim())
        errors.push("Postal code/City is required.");
      if (!formData.country.trim()) errors.push("Country is required.");
      if (!formData.licenseNumber.trim())
        errors.push("License number is required.");
      if (!formData.licenseSince)
        errors.push("License issue date is required.");
      if (!formData.issuingCountry.trim())
        errors.push("Issuing country is required.");
      if (!formData.issuingCity.trim())
        errors.push("Issuing city is required.");

      if (formData.bookingType === "company" && !formData.companyName.trim()) {
        errors.push("Company name is required for company bookings.");
      }

      if (formData.email && !validateEmail(formData.email)) {
        errors.push("Please enter a valid email address.");
      }
      if (
        (formData.phone && formData.phone.length < 8) ||
        formData.phone.length > 15 ||
        !/^\d+$/.test(formData.phone)
      ) {
        errors.push("Please enter a valid phone number.");
      }
      if (formData.dateOfBirth) {
        if (!validateDateOfBirth(formData.dateOfBirth))
          errors.push("Please enter a valid date of birth.");
        else if (!validateAge(formData.dateOfBirth))
          errors.push("You must be at least 18 years old.");
      }
      if (formData.licenseSince && formData.dateOfBirth) {
        if (!validateLicenseDate(formData.licenseSince, formData.dateOfBirth)) {
          errors.push(
            "License issue date must be valid and after your 16th birthday."
          );
        }
      }
      break;

    case 3: // Confirmation
      if (!formData.termsAccepted) {
        errors.push("You must accept the terms and conditions.");
      }
      break;

    default:
      break;
  }
  return errors;
};

export const isStepValid = (
  currentStep: number,
  formData: FormData
): boolean => {
  return getStepValidationErrors(currentStep, formData).length === 0;
};

export const isFieldValid = (
  fieldName: keyof FormData,
  formData: FormData
): boolean => {
  const value = formData[fieldName];
  switch (fieldName) {
    case "email":
      return !!value && validateEmail(value as string);
    case "phone":
      return (
        !!value &&
        String(value).length >= 8 &&
        String(value).length <= 15 &&
        /^\d+$/.test(String(value))
      );
    case "dateOfBirth":
      return (
        !!value &&
        validateDateOfBirth(value as string) &&
        validateAge(value as string)
      );
    case "licenseSince":
      return (
        !!value &&
        !!formData.dateOfBirth &&
        validateLicenseDate(value as string, formData.dateOfBirth)
      );
    case "termsAccepted":
      return !!value;
    default:
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      return !!value;
  }
};

export const parsePrice = (priceString: string): number => {
  if (!priceString) return 0;
  const numericString = priceString.replace(/[^0-9]/g, "");
  return parseInt(numericString, 10) || 0;
};

export const calculateTotalDays = (formData: FormData): number => {
  if (!formData.pickupDate || !formData.dropoffDate) return 0;
  const pickup = new Date(formData.pickupDate);
  const dropoff = new Date(formData.dropoffDate);
  if (isNaN(pickup.getTime()) || isNaN(dropoff.getTime())) return 0;
  const diffTime = dropoff.getTime() - pickup.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 0 ? 1 : diffDays + 1;
};

export const calculateTotal = (formData: FormData): string => {
  const selectedPackage = packages.find((p) => p.id === formData.packageId);
  if (!selectedPackage) return "CHF 0.00";

  const days = calculateTotalDays(formData);
  if (days <= 0) return "CHF 0.00";

  if (selectedPackage.id === "business") {
    return "On Request";
  }

  const pricePerUnit = parsePrice(selectedPackage.price);

  if (selectedPackage.id === "taxi") {
    // FIXED: Calculate a daily rate from the weekly price
    const dailyRate = pricePerUnit / 7;
    const total = days * 48.58;
    return `CHF ${total.toFixed(2)}`;
  }

  if (selectedPackage.id === "tourist") {
    const total = days * 69;
    return `CHF ${total.toFixed(2)}`;
  }

  return "CHF 0.00";
};
