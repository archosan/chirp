import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const SALT_ROUNDS = 10;
/**
 * Generate a simple ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hash password using SHA-256 (in production, use bcrypt)
 */
export async function hashPasswordLegacy(password: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(password + "salt");
  return hash.digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<{ isValid: boolean; isLegacy: boolean }> {
  if (hashedPassword.startsWith("$2b$") || hashedPassword.startsWith("$2a$")) {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return { isValid, isLegacy: false };
  }
  const hash = await hashPasswordLegacy(password);
  return { isValid: hash === hashedPassword, isLegacy: true };
}

/**
 * Convert Date to protobuf Timestamp
 */
export function toProtoTimestamp(date: Date): {
  seconds: bigint;
  nanos: number;
} {
  const ms = date.getTime();
  return {
    seconds: BigInt(Math.floor(ms / 1000)),
    nanos: (ms % 1000) * 1000000,
  };
}

/**
 * Convert protobuf Timestamp to Date
 */
export function fromProtoTimestamp(timestamp: {
  seconds: bigint;
  nanos: number;
}): Date {
  return new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1000000);
}
