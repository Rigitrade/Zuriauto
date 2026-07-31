"use client";

/**
 * Three flags linking to the signed GTC PDFs, one per language.
 *
 * Flags are inline SVG rather than emoji: Windows does not render regional
 * indicator pairs as flags, so emoji would show as "DE" / "GB" / "FR" text on a
 * large share of visitors' machines.
 *
 * Every flag is drawn on the same 3:2 viewBox and fills it completely, so all
 * three render at an identical visible size. Their real-world ratios differ
 * (Germany 5:3, United Kingdom 2:1, France 3:2), and keeping those would
 * letterbox each one differently inside a fixed box.
 *
 * The PDFs live under /gtc-pdf/ and deliberately NOT /gtc/. The terms page route
 * is /GTC/, and on a case-insensitive filesystem a public/gtc/ folder merges with
 * it during export, leaving the directory lower-cased. A case-sensitive host
 * would then 404 on /GTC/.
 */

type Version = {
  code: "de" | "en" | "fr";
  label: string;
  file: string;
  Flag: () => React.ReactElement;
};

// A hairline border keeps the white bands of the French flag from bleeding into
// the page background.
const FLAG_CLASS = "h-8 w-12 border border-slate-300";

function GermanFlag() {
  return (
    <svg viewBox="0 0 60 40" className={FLAG_CLASS} aria-hidden="true">
      <rect width="60" height="40" fill="#FFCE00" />
      <rect width="60" height="26.667" fill="#DD0000" />
      <rect width="60" height="13.333" fill="#000000" />
    </svg>
  );
}

function BritishFlag() {
  return (
    <svg viewBox="0 0 60 40" className={FLAG_CLASS} aria-hidden="true">
      <clipPath id="gtc-uk-diagonals">
        <path d="M30,20 h30 v20 z v-20 h-30 z h-30 v-20 z v20 h30 z" />
      </clipPath>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8" />
      <path
        d="M0,0 L60,40 M60,0 L0,40"
        clipPath="url(#gtc-uk-diagonals)"
        stroke="#C8102E"
        strokeWidth="5.333"
      />
      <path d="M30,0 v40 M0,20 h60" stroke="#FFFFFF" strokeWidth="13.333" />
      <path d="M30,0 v40 M0,20 h60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );
}

function FrenchFlag() {
  return (
    <svg viewBox="0 0 60 40" className={FLAG_CLASS} aria-hidden="true">
      <rect width="60" height="40" fill="#ED2939" />
      <rect width="40" height="40" fill="#FFFFFF" />
      <rect width="20" height="40" fill="#002395" />
    </svg>
  );
}

const VERSIONS: Version[] = [
  {
    code: "de",
    label: "Deutsch",
    file: "/gtc-pdf/gtc-zuriauto-2026-07-30-de.pdf",
    Flag: GermanFlag,
  },
  {
    code: "en",
    label: "English",
    file: "/gtc-pdf/gtc-zuriauto-2026-07-30-en.pdf",
    Flag: BritishFlag,
  },
  {
    code: "fr",
    label: "Français",
    file: "/gtc-pdf/gtc-zuriauto-2026-07-30-fr.pdf",
    Flag: FrenchFlag,
  },
];

export default function GtcPdfFlags() {
  return (
    <div className="flex justify-center items-center gap-4">
      {VERSIONS.map(({ code, label, file, Flag }) => (
        <a
          key={code}
          href={file}
          target="_blank"
          rel="noopener noreferrer"
          title={`GTC PDF – ${label}`}
          aria-label={`GTC PDF – ${label}`}
          data-gtc-pdf={code}
          className="transition-opacity hover:opacity-70"
        >
          <Flag />
        </a>
      ))}
    </div>
  );
}
