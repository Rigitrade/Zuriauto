"use client";

import React from "react";
import Select, {
  components,
  OptionProps,
  SingleValueProps,
  DropdownIndicatorProps,
  StylesConfig,
  GroupBase,
} from "react-select";
import { getNames, getCodes } from "country-list";
import { ChevronDown, AlertCircle } from "lucide-react";
import Image from "next/image";

// Define the shape of our country option objects
interface CountryOptionType {
  value: string;
  label: string;
  code?: string;
}

// Define the props for our main component
interface CountrySelectComponentProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

// Create country options with flags
const createCountryOptions = (): CountryOptionType[] => {
  const countryNames = getNames();
  const countryCodes = getCodes();

  const countryOptions = countryNames.map((name: string) => ({
    value: name,
    label: name,
    code: getCodes()[getNames().indexOf(name)]?.toLowerCase(),
  }));

  // Sort with priority countries first
  const priorityCountries = [
    "Switzerland",
    "Germany",
    "Austria",
    "France",
    "Italy",
  ];
  const priority = countryOptions.filter((country) =>
    priorityCountries.includes(country.value)
  );
  const others = countryOptions
    .filter((country) => !priorityCountries.includes(country.value))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...priority, ...others];
};

const countryOptions: CountryOptionType[] = createCountryOptions();

// Custom option component with flag, now fully typed
const CountryOption = (props: OptionProps<CountryOptionType>) => {
  const { data, innerRef, innerProps } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
    >
      {data.code && (
        <Image
          src={`https://flagcdn.com/24x18/${data.code}.png`}
          alt={`${data.label} flag`}
          width={24}
          height={18}
          className="w-6 h-4 mr-2 object-cover"
        />
      )}
      <span className="text-sm">{data.label}</span>
    </div>
  );
};

// Custom single value component with flag, now fully typed
const CountrySingleValue = (props: SingleValueProps<CountryOptionType>) => {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div className="flex items-center">
        {data.code && (
          <Image
            width={24}
            height={18}
            src={`https://flagcdn.com/24x18/${data.code}.png`}
            alt={`${data.label} flag`}
            className="w-6 h-4 mr-2 object-cover"
          />
        )}
        <span className="text-sm">{data.label}</span>
      </div>
    </components.SingleValue>
  );
};

// Custom dropdown indicator, now fully typed
const DropdownIndicator = (
  props: DropdownIndicatorProps<CountryOptionType>
) => {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown className="h-4 w-4 text-gray-400" />
    </components.DropdownIndicator>
  );
};

const CountrySelectComponent: React.FC<CountrySelectComponentProps> = ({
  value,
  onChange,
  hasError = false,
  errorMessage = "",
  placeholder = "Select Country",
}) => {
  // Get current country option object based on the string value
  const getCurrentCountryOption = (
    countryName: string
  ): CountryOptionType | null => {
    return (
      countryOptions.find((option) => option.value === countryName) || null
    );
  };

  // Custom styles for react-select, now fully typed
  const selectStyles: StylesConfig<
    CountryOptionType,
    false,
    GroupBase<CountryOptionType>
  > = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: "0",
      border: hasError ? "1px solid #fca5a5" : "1px solid #d1d5db",
      boxShadow: state.isFocused
        ? hasError
          ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
          : "0 0 0 3px rgba(31, 41, 55, 0.1)"
        : "none",
      borderColor: state.isFocused
        ? hasError
          ? "#ef4444"
          : "#1f2937"
        : hasError
        ? "#fca5a5"
        : "#d1d5db",
      "&:hover": {
        borderColor: state.isFocused
          ? hasError
            ? "#ef4444"
            : "#1f2937"
          : "#9ca3af",
      },
      minHeight: "40px",
      fontSize: "14px",
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: "0",
      border: "1px solid #d1d5db",
      boxShadow:
        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    }),
    option: (provided, state) => ({
      ...provided,
      padding: "0",
      backgroundColor: state.isSelected
        ? "#1f2937"
        : state.isFocused
        ? "#f3f4f6"
        : "white",
      color: state.isSelected ? "white" : "#374151",
      fontSize: "14px",
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#374151",
      fontSize: "14px",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "#9ca3af",
      fontSize: "14px",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: "#6b7280",
      "&:hover": {
        color: "#374151",
      },
    }),
  };

  return (
    <>
      <Select
        value={getCurrentCountryOption(value)}
        onChange={(option) => onChange(option?.value || "")}
        options={countryOptions}
        styles={selectStyles}
        components={{
          Option: CountryOption,
          SingleValue: CountrySingleValue,
          DropdownIndicator: DropdownIndicator,
        }}
        placeholder={placeholder}
        isSearchable
        isClearable={false}
        className="country-select"
        classNamePrefix="react-select"
      />
      {hasError && errorMessage && (
        <p className="text-xs text-red-600 flex items-center mt-1">
          <AlertCircle className="h-3 w-3 mr-1" />
          {errorMessage}
        </p>
      )}
    </>
  );
};

export default CountrySelectComponent;
