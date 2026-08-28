/**
 * Password hashing for the fleet dashboard's accounts.
 *
 * scrypt from `node:crypto`, which is the same module every other credential
 * in this codebase already goes through — `createHmac` for the session cookie,
 * `timingSafeEqual` for the write fence, `randomBytes` for action tokens. No
 * new dependency, and nothing native to fail on a serverless build.
 *
 * The stored value carries its own parameters:
 *
 *   scrypt$16384$8$1$<salt base64url>$<hash base64url>
 *
 * Reading the cost out of the hash rather than a constant is what lets it be
 * raised later: new passwords get the new cost, existing ones keep verifying.
 * A constant would silently invalidate every password the day somebody edited
 * it.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** What new passwords are hashed with. Raise freely; old hashes keep working. */
export const SCRYPT: Readonly<ScryptParams> = { N: 16384, r: 8, p: 1 };

const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * Bounds on scrypt parameters, and Node's memory ceiling.
 *
 * MAX_N and MAX_R are loose: together they allow ~4 GiB, so upfront bounds
 * reject the obviously absurd but are not the actual guard. Cost is roughly
 * `128 * N * r` bytes; anything that exceeds MAX_MEM is refused by Node's own
 * maxmem check inside derive(), caught and returned as false. Together, both
 * layers prevent a tampered row from turning a login into a memory bomb.
 */
const MAX_MEM = 64 * 1024 * 1024;
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptParams & { maxmem: number }
) => Promise<Buffer>;

function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  params: ScryptParams
): Promise<Buffer> {
  return scrypt(password, salt, keylen, { ...params, maxmem: MAX_MEM });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = SCRYPT
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function parseStored(
  stored: string
): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const params = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (
    !Number.isInteger(params.N) ||
    !Number.isInteger(params.r) ||
    !Number.isInteger(params.p) ||
    params.N < 2 ||
    params.r < 1 ||
    params.p < 1 ||
    params.N > MAX_N ||
    params.r > MAX_R ||
    params.p > MAX_P
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || key.length === 0) return null;

  return { params, salt, key };
}

/**
 * Returns false rather than throwing on a malformed stored value.
 *
 * The caller is a login handler, and a corrupt row should refuse the sign-in,
 * not return a 500 that tells an attacker they found something interesting.
 */
export async function passwordMatches(
  password: string,
  stored: string
): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;

  let actual: Buffer;
  try {
    actual = await derive(password, parsed.salt, parsed.key.length, parsed.params);
  } catch {
    return false;
  }

  // Guarded, because timingSafeEqual throws on a length mismatch — which would
  // itself leak the length.
  if (actual.length !== parsed.key.length) return false;
  return timingSafeEqual(actual, parsed.key);
}
