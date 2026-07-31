"use client";

/**
 * Three small country flags linking to the signed GTC PDFs, one per language.
 *
 * Flags are inline SVG rather than emoji: Windows does not render regional
 * indicator pairs as flags, so emoji would show as "DE" / "GB" / "FR" text on a
 * large share of visitors' machines.
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

const FLAG_CLASS = "h-5 w-8 border border-slate-300 shadow-sm";

function GermanFlag() {
  return (
    <svg viewBox="0 0 5 3" className={FLAG_CLASS} aria-hidden="true">
      <rect width="5" height="3" fill="#000" />
      <rect width="5" height="2" y="1" fill="#D00" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  );
}

function BritishFlag() {
  return (
    <svg viewBox="0 0 60 30" className={FLAG_CLASS} aria-hidden="true">
      <clipPath id="gtc-uk-clip">
        <path d="M30,15 h30 v15 z v-15 h-30 z h-30 v-15 z v15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#gtc-uk-clip)"
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

function FrenchFlag() {
  return (
    <svg viewBox="0 0 3 2" className={FLAG_CLASS} aria-hidden="true">
      <rect width="3" height="2" fill="#ED2939" />
      <rect width="2" height="2" fill="#fff" />
      <rect width="1" height="2" fill="#002395" />
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
    <div className="flex justify-center items-start gap-6">
      {VERSIONS.map(({ code, label, file, Flag }) => (
        <a
          key={code}
          href={file}
          target="_blank"
          rel="noopener noreferrer"
          title={`GTC PDF – ${label}`}
          aria-label={`GTC PDF – ${label}`}
          data-gtc-pdf={code}
          className="group flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
        >
          <Flag />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 group-hover:text-slate-800">
            PDF
          </span>
        </a>
      ))}
    </div>
  );
}
