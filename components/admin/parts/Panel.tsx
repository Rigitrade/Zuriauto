"use client";

/**
 * The card every section is made of.
 *
 * One component so the four screens cannot drift into four slightly different
 * headers — which is exactly what the previous dashboard did, with a
 * `rounded-2xl` here and a `rounded-lg` there and two different heading sizes
 * on the same page.
 *
 * `meta` is the quiet count beside the title; `action` is the one button a
 * panel is allowed. More than one button belongs on a row, not on a heading.
 */
export function Panel({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-rule)] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">
          {title}
          {meta && (
            <span className="ml-2 font-normal text-[var(--admin-faint)]">{meta}</span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
