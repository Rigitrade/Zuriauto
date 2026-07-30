"use client";

import React from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { AlertCircle } from "lucide-react";

interface PhoneInputComponentProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

const PhoneInputComponent: React.FC<PhoneInputComponentProps> = ({
  value,
  onChange,
  hasError = false,
  errorMessage = "",
  placeholder = "Search countries...",
}) => {
  return (
    <>
      {/* Custom CSS for phone input */}
      <style jsx global>{`
        .phone-input-container .react-tel-input {
          width: 100%;
        }

        .phone-input-container .react-tel-input .form-control {
          width: 100% !important;
          height: 40px !important;
          font-size: 14px !important;
          border: ${hasError
            ? "1px solid #fca5a5"
            : "1px solid #d1d5db"} !important;
          border-radius: 0 !important;
          padding-left: 48px !important;
          outline: none !important;
          transition: border-color 0.15s ease-in-out,
            box-shadow 0.15s ease-in-out !important;
        }

        .phone-input-container .react-tel-input .form-control:focus {
          border-color: ${hasError ? "#ef4444" : "#1f2937"} !important;
          box-shadow: ${hasError
            ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
            : "0 0 0 3px rgba(31, 41, 55, 0.1)"} !important;
        }

        .phone-input-container .react-tel-input .flag-dropdown {
          border: ${hasError
            ? "1px solid #fca5a5"
            : "1px solid #d1d5db"} !important;
          border-right: none !important;
          border-radius: 0 !important;
          background-color: #ffffff !important;
          height: 40px !important;
        }

        .phone-input-container .react-tel-input .flag-dropdown:hover {
          background-color: #f9fafb !important;
        }

        .phone-input-container .react-tel-input .flag-dropdown.open {
          background-color: #f3f4f6 !important;
        }

        .phone-input-container .react-tel-input .country-list {
          border-radius: 0 !important;
          border: 1px solid #d1d5db !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
        }

        .phone-input-container .react-tel-input .country-list .country:hover {
          background-color: #f3f4f6 !important;
        }

        .phone-input-container
          .react-tel-input
          .country-list
          .country.highlight {
          background-color: #1f2937 !important;
          color: white !important;
        }

        .phone-input-container .react-tel-input .search-box {
          padding: 8px !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0 !important;
          font-size: 14px !important;
          outline: none !important;
        }

        .phone-input-container .react-tel-input .search-box:focus {
          border-color: #1f2937 !important;
          box-shadow: 0 0 0 3px rgba(31, 41, 55, 0.1) !important;
        }
      `}</style>

      <div className="phone-input-container">
        <PhoneInput
          country={"ch"}
          value={value}
          onChange={(value) => onChange(value || "")}
          containerClass="react-tel-input"
          inputClass="form-control"
          buttonClass="flag-dropdown"
          dropdownClass="country-list"
          searchClass="search-box"
        />
      </div>
      {hasError && errorMessage && (
        <p className="text-xs text-red-600 flex items-center mt-1">
          <AlertCircle className="h-3 w-3 mr-1" />
          {errorMessage}
        </p>
      )}
    </>
  );
};

export default PhoneInputComponent;
