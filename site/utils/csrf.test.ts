import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { CsrfError, createCsrfProtect } from "./csrf";

const COOKIE_NAME = "_csrf";

const cookieConfig = {
    name: COOKIE_NAME,
    secure: false,
    sameSite: "lax" as const,
};

const csrfProtect = createCsrfProtect({
    cookie: cookieConfig,
    token: {
        value: async (req) => {
            const queryCsrf = req.url.match(/_csrf=(.[^&]*)/)?.[1];
            return queryCsrf
                ? decodeURIComponent(queryCsrf)
                : (await req.formData()).get("csrf_token")?.toString() ?? "";
        },
    },
});

const makeRequest = (
    url: string,
    init: { method?: string; cookie?: string; body?: BodyInit; headers?: Record<string, string> } = {},
): NextRequest => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);

    return new NextRequest(url, { method: init.method ?? "GET", headers, body: init.body });
};

const issue = async (url = "https://example.com/dashboard") => {
    const req = makeRequest(url);
    const res = NextResponse.next();
    await csrfProtect(req, res);
    const secretCookie = res.cookies.get(COOKIE_NAME)?.value;
    const token = res.headers.get("X-CSRF-Token");

    return { secretCookie, token };
};

const formBody = (token: string) => {
    const params = new URLSearchParams();
    params.set("csrf_token", token);

    return {
        body: params,
        headers: { "content-type": "application/x-www-form-urlencoded" },
    };
};

describe("csrf", () => {
    describe("token creation", () => {
        it("does not reset the secret cookie when one already exists", async () => {
            const { secretCookie } = await issue();
            const req = makeRequest("https://example.com/dashboard", { cookie: `${COOKIE_NAME}=${secretCookie}` });
            const res = NextResponse.next();
            await csrfProtect(req, res);
            // no new cookie issued when the secret is already present
            expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
            // but a fresh token is still emitted
            expect(res.headers.get("X-CSRF-Token")).toBeTruthy();
        });

        it("issues a different token each request for the same secret", async () => {
            const { secretCookie } = await issue();
            const tokenFor = async () => {
                const req = makeRequest("https://example.com/dashboard", {
                    cookie: `${COOKIE_NAME}=${secretCookie}`,
                });
                const res = NextResponse.next();
                await csrfProtect(req, res);
                return res.headers.get("X-CSRF-Token");
            };
            expect(await tokenFor()).not.toEqual(await tokenFor());
        });

        it("does not validate on GET even with a bad token in the query", async () => {
            const req = makeRequest("https://example.com/dashboard?_csrf=rubbish");
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).resolves.toBeUndefined();
        });
    });

    describe("token validation", () => {
        it("accepts a valid token submitted via form field", async () => {
            const { secretCookie, token } = await issue();
            const req = makeRequest("https://example.com/api/login", {
                method: "POST",
                cookie: `${COOKIE_NAME}=${secretCookie}`,
                ...formBody(token!),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).resolves.toBeUndefined();
            // a rotated token is still issued on success
            expect(res.headers.get("X-CSRF-Token")).toBeTruthy();
        });

        it("accepts a valid token submitted via the _csrf query param", async () => {
            const { secretCookie, token } = await issue();
            const req = makeRequest(`https://example.com/api/login?_csrf=${encodeURIComponent(token!)}`, {
                method: "POST",
                cookie: `${COOKIE_NAME}=${secretCookie}`,
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).resolves.toBeUndefined();
        });

        it("rejects when no token is submitted", async () => {
            const { secretCookie } = await issue();
            const req = makeRequest("https://example.com/api/login", {
                method: "POST",
                cookie: `${COOKIE_NAME}=${secretCookie}`,
                ...formBody(""),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).rejects.toBeInstanceOf(CsrfError);
        });

        it("rejects a malformed token", async () => {
            const { secretCookie } = await issue();
            const req = makeRequest("https://example.com/api/login", {
                method: "POST",
                cookie: `${COOKIE_NAME}=${secretCookie}`,
                ...formBody("not-a-real-token"),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).rejects.toBeInstanceOf(CsrfError);
        });

        it("rejects a token that was signed with a different secret", async () => {
            const { token: tokenA } = await issue(); // token from secret A
            const { secretCookie: secretCookieB } = await issue(); // cookie from secret B
            const req = makeRequest("https://example.com/api/login", {
                method: "POST",
                cookie: `${COOKIE_NAME}=${secretCookieB}`,
                ...formBody(tokenA!),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).rejects.toBeInstanceOf(CsrfError);
        });

        it("rejects when the secret cookie is absent", async () => {
            const { token } = await issue();
            const req = makeRequest("https://example.com/api/login", {
                method: "POST",
                ...formBody(token!),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).rejects.toBeInstanceOf(CsrfError);
        });
    });

    describe("excluded paths", () => {
        it("skips protection for /_next/ paths", async () => {
            const req = makeRequest("https://example.com/_next/static/chunk.js", {
                method: "POST",
                ...formBody("rubbish"),
            });
            const res = NextResponse.next();
            await expect(csrfProtect(req, res)).resolves.toBeUndefined();
            // nothing issued for excluded paths
            expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
            expect(res.headers.get("X-CSRF-Token")).toBeNull();
        });
    });
});
