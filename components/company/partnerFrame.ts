/**
 * Whether a partner's frame is on screen (multi-company phase C,
 * 16.11.2026), for the site-wide widgets in the root layout, which sits
 * outside the frame and so cannot be told by context. The WhatsApp button
 * reads it: ZURIAUTO's number must not appear on a partner's page.
 *
 * A count, not a flag, so two frames mounting and unmounting in either
 * order (a navigation between two partner pages) leave it right.
 */

let frames = 0;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

export function inPartnerFrame(): boolean {
  return frames > 0;
}

/** Marks a frame as on screen; the returned function marks it gone. */
export function enterPartnerFrame(): () => void {
  frames += 1;
  changed();
  let left = false;
  return () => {
    if (left) return;
    left = true;
    frames -= 1;
    changed();
  };
}

export function subscribePartnerFrame(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
