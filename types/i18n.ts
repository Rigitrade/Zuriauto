// types/i18n.ts

// Import your English translations
import en from "@/locales/en";

// Create a type that matches the structure but allows any string values
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends object ? DeepStringify<T[K]> : string;
};

// Create a type that matches the structure of your English translations
export type TranslationKeys = DeepStringify<typeof en>;

// Dynamic type that automatically creates individual namespace types
export type TranslationNamespace<T extends keyof TranslationKeys> =
  TranslationKeys[T];

// Utility type to create flattened colon notation keys (namespace:key)
export type FlattenKeys<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends object
    ? FlattenKeys<T[K], `${Prefix}${K & string}:`>
    : `${Prefix}${K & string}`;
}[keyof T];

// Create the flattened key type from your translations
export type FlatTranslationKey = FlattenKeys<TranslationKeys>;

// Or if you prefer to access them directly:
export type Translations = {
  [K in keyof TranslationKeys]: TranslationKeys[K];
};

// Example of how the flattened keys would look:
// "common:welcome" | "common:loading" | "navigation:home" | "carRental:benefits:title" | etc.
