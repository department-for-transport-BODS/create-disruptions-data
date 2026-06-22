/**
 * Signed double-submit cookie CSRF protection (OWASP recommended pattern).
 *
 * Flow:
 *  - On every request, a random secret is generated (or the existing cookie secret is reused).
 *  - The secret is stored in an httpOnly cookie (`_csrf`).
 *  - A signed token (HMAC-SHA256 over a random salt, encoded as base64url) is placed in the
 *    forwarded `x-csrf-token` request header so that `getServerSideProps` can read it and pass
 *    it to the page as a prop.
 *  - On mutating requests (POST/PUT/PATCH/DELETE) the token from the form body (field `csrf_token`)
 *    or the `_csrf` query-string parameter is verified against the cookie secret.
 */

import type { NextRequest } from "next/server";

export const CSRF_COOKIE_NAME = "_csrf";
const CSRF_HEADER = "x-csrf-token";
const SECRET_BYTE_LENGTH = 18;
const SALT_BYTE_LENGTH = 8;
const TOKEN_DELIMITER = ".";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class CsrfError extends Error {
    constructor() {
        super("invalid csrf token");
        this.name = "CsrfError";
    }
}

// --- Encoding helpers ---

function toBase64Url(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from([...binary].map((c) => c.charCodeAt(0)));
}

// --- Crypto helpers ---

async function computeHmac(secret: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// --- Token helpers ---

/** Creates a signed token: base64url(HMAC(secret, salt)) + "." + base64url(salt) */
async function signToken(secret: Uint8Array): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
    const mac = await computeHmac(secret, salt);
    return `${toBase64Url(mac)}${TOKEN_DELIMITER}${toBase64Url(salt)}`;
}

/** Returns true only if the token was produced by signToken with the same secret. */
async function verifyToken(token: string, secret: Uint8Array): Promise<boolean> {
    const parts = token.split(TOKEN_DELIMITER);
    if (parts.length !== 2) return false;
    try {
        const mac = fromBase64Url(parts[0]);
        const salt = fromBase64Url(parts[1]);
        const expected = await computeHmac(secret, salt);
        return timingSafeEqual(mac, expected);
    } catch {
        return false;
    }
}

// --- Public API ---

export interface CsrfTokenResult {
    /** The signed token to be forwarded as the x-csrf-token request header. */
    token: string;
    /** The base64url-encoded secret to be stored in the httpOnly cookie. */
    cookieValue: string;
}

/**
 * Derives or generates the CSRF secret and produces a fresh signed token.
 * Call this on every request regardless of method.
 */
export async function createCsrfToken(request: NextRequest): Promise<CsrfTokenResult> {
    const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    let secret: Uint8Array;

    if (existing) {
        try {
            secret = fromBase64Url(existing);
            if (secret.length !== SECRET_BYTE_LENGTH) throw new Error("bad length");
        } catch {
            secret = crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH));
        }
    } else {
        secret = crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH));
    }

    return {
        token: await signToken(secret),
        cookieValue: toBase64Url(secret),
    };
}

/**
 * Validates the CSRF token on mutating requests.
 * Throws CsrfError if the token is absent or does not match the cookie secret.
 * Safe methods (GET, HEAD, OPTIONS) are skipped.
 */
export async function validateCsrfRequest(request: NextRequest): Promise<void> {
    if (SAFE_METHODS.has(request.method)) return;

    const secretCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!secretCookie) throw new CsrfError();

    let secret: Uint8Array;
    try {
        secret = fromBase64Url(secretCookie);
    } catch {
        throw new CsrfError();
    }

    const token = await getSubmittedToken(request);
    if (!token || !(await verifyToken(token, secret))) throw new CsrfError();
}

/** Reads the submitted CSRF token from the query string or form body. */
async function getSubmittedToken(request: NextRequest): Promise<string | null> {
    // Query-string token (used in some redirect flows)
    const queryCsrf = request.url.match(/_csrf=(.[^&]*)/)?.[1];
    if (queryCsrf) return decodeURIComponent(queryCsrf);

    // Form body token
    try {
        const formData = await request.formData();
        return formData.get("csrf_token")?.toString() ?? null;
    } catch {
        return null;
    }
}

export { CSRF_HEADER };
