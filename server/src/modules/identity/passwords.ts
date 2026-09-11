import bcrypt from "bcrypt";

// 12 rounds: the security-and-hardening skill's own floor recommendation.
const SALT_ROUNDS = 12;

export function hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
}
