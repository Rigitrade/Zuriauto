/**
 * A form's own error, shown next to the button that caused it.
 *
 * Dialog forms used to send their errors to the page banner, which sits
 * behind the open dialog where nobody can see it: pressing "erstellen" with a
 * short password looked like nothing happened.
 */
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-[var(--admin-crit-soft)] px-3 py-2 text-sm text-[var(--admin-crit)]">
      {message}
    </p>
  );
}
