import { NextRequest, NextResponse } from "next/server";

const SECRET_BYTE_LENGTH = 18;
const SALT_BYTE_LENGTH = 8;
const IGNORE_METHODS = ["GET", "HEAD", "OPTIONS"];
const RESPONSE_HEADER = "X-CSRF-Token";

export class CsrfError extends Error {}

interface CookieOptions {
    name: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    httpOnly?: boolean;
    path?: string;
}

interface CsrfProtectOptions {
    cookie: CookieOptions;
    token?: {
        value?: (req: NextRequest) => Promise<string> | string;
    };
    excludePathPrefixes?: string[];
}

const randomBytes = (length: number): Uint8Array => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
};

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
const fromBase64 = (str: string): Uint8Array => Buffer.from(str, "base64");

const hash = async (secret: Uint8Array, salt: Uint8Array): Promise<Uint8Array> => {
    const message = new Uint8Array(secret.length + salt.length);
    message.set(secret);
    message.set(salt, secret.length);
    const digest = await crypto.subtle.digest("SHA-1", message);
    return new Uint8Array(digest);
};

const createToken = async (secret: Uint8Array): Promise<Uint8Array> => {
    const salt = randomBytes(SALT_BYTE_LENGTH);
    const hashed = await hash(secret, salt);
    const token = new Uint8Array(2 + SALT_BYTE_LENGTH + hashed.byteLength);
    token[0] = 0;
    token[1] = SALT_BYTE_LENGTH;
    token.set(salt, 2);
    token.set(hashed, 2 + salt.length);
    return token;
};

const verifyToken = async (token: Uint8Array, secret: Uint8Array): Promise<boolean> => {
    if (token.byteLength < 22) {
        return false;
    }

    const saltLength = token[1];
    const salt = token.subarray(2, 2 + saltLength);
    const providedHash = token.subarray(2 + saltLength);
    const expectedHash = await hash(secret, salt);

    if (providedHash.byteLength !== expectedHash.byteLength) {
        return false;
    }

    let mismatch = 0;

    for (let i = 0; i < providedHash.byteLength; i++) {
        mismatch |= providedHash[i] ^ expectedHash[i];
    }

    return mismatch === 0;
};

const defaultTokenValue = (req: NextRequest): string => req.headers.get(RESPONSE_HEADER) ?? "";

export const createCsrfProtect = (options: CsrfProtectOptions) => {
    const { cookie, token, excludePathPrefixes = ["/_next/"] } = options;
    const getSubmittedToken = token?.value ?? defaultTokenValue;

    return async (request: NextRequest, response: NextResponse): Promise<void> => {
        if (excludePathPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) return;

        const existing = request.cookies.get(cookie.name)?.value;
        let secret: Uint8Array;

        if (existing) {
            secret = fromBase64(existing);
        } else {
            secret = randomBytes(SECRET_BYTE_LENGTH);
            response.cookies.set(cookie.name, toBase64(secret), {
                httpOnly: cookie.httpOnly ?? true,
                path: cookie.path ?? "/",
                secure: cookie.secure ?? true,
                sameSite: cookie.sameSite ?? "strict",
            });
        }

        if (!IGNORE_METHODS.includes(request.method)) {
            const submitted = await getSubmittedToken(request);
            const tokenValid = await verifyToken(fromBase64(submitted), secret);

            if (!tokenValid) {
                throw new CsrfError("Invalid CSRF token");
            }
        }

        response.headers.set(RESPONSE_HEADER, toBase64(await createToken(secret)));
    };
};
