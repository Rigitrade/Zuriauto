# Next.js Multilingual Starter with Theme Switching

A modern, feature-rich Next.js starter template built with TypeScript, Tailwind CSS, Shadcn UI, internationalization (i18n), and theme switching capabilities.

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)
![React](https://img.shields.io/badge/React-19.1.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8)
![i18n](https://img.shields.io/badge/i18n-multilingual-green)

## ✨ Features

- **Next.js 15** - The latest version of Next.js with App Router
- **React 19** - The latest version of React with improved performance
- **TypeScript** - Type-safe code for better developer experience
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Shadcn UI** - High-quality, accessible UI components built with Radix UI and Tailwind CSS
- **Internationalization (i18n)** - Multi-language support with:
  - English, Arabic (RTL), and French languages
  - Automatic language detection
  - Easy language switching
  - RTL support for Arabic
- **Theme Switching** - Light, dark, and system theme options
- **Responsive Design** - Mobile-first approach with responsive components
- **Turbopack** - Faster development experience with Turbopack

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn or pnpm

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/my-app.git
cd my-app
```

2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Start the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🌐 Internationalization

This project uses `i18next` and `react-i18next` for internationalization. The language files are located in the `locales` directory.

### Supported Languages

- English (en) - Default
- Arabic (ar) - Right-to-left support
- French (fr)

### Adding a New Language

1. Create a new file in the `locales` directory (e.g., `de.ts` for German)
2. Add the language to the `languages` array in `components/LanguageSwitcher.tsx`
3. Import and add the language to the resources in `lib/i18n.ts`

### Usage

Use the `useTranslation` hook to access translations:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('common:welcome')}</h1>;
}
```

## 🎨 Theme Switching

The project includes a theme provider that supports light, dark, and system themes. The theme is stored in localStorage and applied using CSS classes.

### Usage

Use the `useTheme` hook to access and change the theme:

```tsx
import { useTheme } from '@/lib/hooks/useTheme';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme('dark')}>
      Switch to dark mode
    </button>
  );
}
```

## 📁 Project Structure

```
├── app/                  # Next.js app directory
├── components/           # React components
│   ├── ui/               # Shadcn UI components
│   ├── Header.tsx        # Application header
│   ├── LanguageSwitcher.tsx # Language switcher component
│   ├── MainLayout.tsx    # Main layout wrapper
│   └── ThemeToggle.tsx   # Theme toggle component
├── lib/                  # Utility functions and hooks
│   ├── hooks/            # Custom React hooks
│   │   ├── use-i18n.tsx  # i18n hook
│   │   └── useTheme.tsx  # Theme hook
│   ├── i18n.ts           # i18n configuration
│   └── utils.ts          # Utility functions
├── locales/              # Translation files
│   ├── ar.ts             # Arabic translations
│   ├── en.ts             # English translations
│   └── fr.ts             # French translations
├── providers/            # React context providers
│   └── I18nProvider.tsx  # i18n provider
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

## 🛠️ Customization

### Tailwind CSS

You can customize the Tailwind configuration in `tailwind.config.js`.

### Shadcn UI

Shadcn UI components are located in the `components/ui` directory. You can customize them according to your needs.

### Adding New Components

Place new components in the `components` directory. For UI components that are part of your design system, add them to `components/ui`.

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - learn about Tailwind CSS.
- [Shadcn UI Documentation](https://ui.shadcn.com) - learn about Shadcn UI components.
- [i18next Documentation](https://www.i18next.com) - learn about i18next.
- [React i18next Documentation](https://react.i18next.com) - learn about React i18next.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
