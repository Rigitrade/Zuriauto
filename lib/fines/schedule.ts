/**
 * Work that should start once the response has gone out.
 *
 * Reading a letter takes tens of seconds; the office should not watch a
 * spinner for it. Next's `after()` runs the task after the response, within
 * the same function invocation.
 *
 * Outside a request — a test calling the route handler, a script — `after()`
 * throws. Nothing is lost then: the document stays UPLOADED and the daily
 * retry pass reads it. So the failure is reported, not raised.
 */

import { after } from "next/server";

export function afterResponse(task: () => Promise<unknown>): boolean {
  try {
    after(task);
    return true;
  } catch {
    return false;
  }
}
