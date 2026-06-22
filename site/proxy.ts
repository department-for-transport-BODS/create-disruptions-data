import {
    AdminInitiateAuthCommand,
    AdminInitiateAuthCommandInput,
    AdminInitiateAuthCommandOutput,
    AdminUserGlobalSignOutCommand,
    AdminUserGlobalSignOutCommandInput,
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { UserGroups } from "@create-disruptions-data/shared-ts/enums";
import { CSRF_COOKIE_NAME, CSRF_HEADER, CsrfError, createCsrfToken, validateCsrfRequest } from "./utils/csrf";
import * as jose from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
    COOKIES_ID_TOKEN,
    COOKIES_LOGIN_REDIRECT,
    COOKIES_REFRESH_TOKEN,
    DASHBOARD_PAGE_PATH,
    LOGIN_PAGE_PATH,
    SOCIAL_MEDIA_ACCOUNTS_PAGE_PATH,
    SYSADMIN_MANAGE_ORGANISATIONS_PAGE_PATH,
} from "./constants";

const {
    COGNITO_CLIENT_ID: cognitoClientId,
    COGNITO_CLIENT_SECRET: cognitoClientSecret,
    COGNITO_USER_POOL_ID: userPoolId,
    MIDDLEWARE_AWS_ACCESS_KEY_ID: accessKeyId,
    MIDDLEWARE_AWS_SECRET_ACCESS_KEY: secretAccessKey,
} = process.env;

if (!cognitoClientSecret || !cognitoClientId || !userPoolId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cognito env vars not set");
}

const cognito = new CognitoIdentityProviderClient({
    region: "eu-west-2",
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

const calculateSecretHash = async (username: string): Promise<string> => {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(cognitoClientSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );

    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(username + cognitoClientId));
    return Buffer.from(String.fromCharCode(...new Uint8Array(sig)), "binary").toString("base64");
};

export const initiateRefreshAuth = async (
    username: string,
    refreshToken: string,
): Promise<AdminInitiateAuthCommandOutput> => {
    const params: AdminInitiateAuthCommandInput = {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: cognitoClientId,
        UserPoolId: userPoolId,
        AuthParameters: {
            REFRESH_TOKEN: refreshToken,
            SECRET_HASH: await calculateSecretHash(username),
        },
    };

    try {
        const response = await cognito.send(new AdminInitiateAuthCommand(params));

        return response;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to refresh user session: ${error.stack || ""}`);
        }

        throw error;
    }
};

const globalSignOut = async (username: string): Promise<void> => {
    const params: AdminUserGlobalSignOutCommandInput = {
        Username: username,
        UserPoolId: userPoolId,
    };

    try {
        await cognito.send(new AdminUserGlobalSignOutCommand(params));
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to perform global sign out: ${error.stack || ""}`);
        }

        throw error;
    }
};

const unauthenticatedRoutes = [
    "/login",
    "/api/login",
    "/register",
    "/api/register",
    "/expired-link",
    "/forgot-password",
    "/api/forgot-password",
    "/reset-password",
    "/api/reset-password",
    "/api/hootsuite-callback",
    "/api/nextdoor-callback",
    "/api/cookies",
    "/_next",
    "/assets",
    "/scripts",
    "/error",
    "/contact",
    "/cookies",
    "/cookie-details",
    "/accessibility",
    "/privacy",
    "/robots.txt",
    "/favicon.ico",
    "/500",
    "/404",
    "/changelog",
];

const allowedRoutesForSysadmin = [
    "/api/admin/resend-invite",
    "/api/admin/delete-user",
    "/api/sign-out",
    "/account-settings",
    "/change-password",
    "/api/change-password",
];

const JWKS = jose.createRemoteJWKSet(new URL(`${process.env.COGNITO_ISSUER ?? ""}/.well-known/jwks.json`), {
    timeoutDuration: 10000,
});

export async function proxy(request: NextRequest) {
    const domain = process.env.DOMAIN_NAME;

    // CSRF: validate mutating requests before doing anything else
    try {
        await validateCsrfRequest(request);
    } catch (err) {
        if (err instanceof CsrfError) {
            return new NextResponse("invalid csrf token", { status: 403 });
        }
        throw err;
    }

    // CSRF: generate a fresh signed token and forward it to getServerSideProps via request headers
    const csrf = await createCsrfToken(request);
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set(CSRF_HEADER, csrf.token);
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    response.cookies.set(CSRF_COOKIE_NAME, csrf.cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });

    if (
        request.nextUrl.pathname &&
        unauthenticatedRoutes.every((route) => !request.nextUrl.pathname.startsWith(route)) &&
        request.nextUrl.pathname !== "/"
    ) {
        const signOutUserAndRedirectToLogin = async (username?: string) => {
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log("Signing out user");

            if (username) {
                try {
                    await globalSignOut(username);
                } catch (_e) {}
            }

            const newResponse = NextResponse.redirect(new URL(LOGIN_PAGE_PATH, domain));

            const { pathname, search } = request.nextUrl;

            if (!request.headers.get("x-middleware-prefetch")) {
                const refererHeader = request.headers.get("referer");
                const referer = refererHeader ? new URL(refererHeader) : null;

                const apiRedirect = referer
                    ? `${referer.pathname}${referer.search}`
                    : new URL(DASHBOARD_PAGE_PATH, domain).toString();

                newResponse.cookies.set(
                    COOKIES_LOGIN_REDIRECT,
                    pathname.includes("/api/") ? apiRedirect : `${pathname}${search}`,
                    {
                        httpOnly: true,
                        secure: process.env.NODE_ENV !== "development",
                        sameSite: "strict",
                    },
                );
            }

            newResponse.cookies.delete(COOKIES_ID_TOKEN);
            newResponse.cookies.delete(COOKIES_REFRESH_TOKEN);

            return newResponse;
        };

        const idToken = request.cookies.get(COOKIES_ID_TOKEN);
        if (!idToken) {
            return signOutUserAndRedirectToLogin();
        }

        try {
            const decodedToken = await jose.jwtVerify(idToken.value, JWKS, {
                audience: process.env.COGNITO_CLIENT_ID,
                issuer: process.env.COGNITO_ISSUER,
                algorithms: ["RS256"],
            });
            const groups = z.array(z.nativeEnum(UserGroups)).parse(decodedToken.payload["cognito:groups"]);

            if (
                groups.includes(UserGroups.systemAdmins) &&
                !(
                    request.nextUrl.pathname.startsWith("/sysadmin/") ||
                    request.nextUrl.pathname.startsWith("/api/sysadmin/") ||
                    allowedRoutesForSysadmin.includes(request.nextUrl.pathname)
                )
            ) {
                return NextResponse.redirect(new URL(SYSADMIN_MANAGE_ORGANISATIONS_PAGE_PATH, domain));
            }

            if (request.nextUrl.pathname === SOCIAL_MEDIA_ACCOUNTS_PAGE_PATH) {
                if (!groups.includes(UserGroups.orgAdmins) && !groups.includes(UserGroups.operators)) {
                    return NextResponse.redirect(new URL(DASHBOARD_PAGE_PATH, domain));
                }
            }

            if (request.nextUrl.pathname.startsWith("/admin/") || request.nextUrl.pathname.startsWith("/api/admin/")) {
                if (!groups.includes(UserGroups.orgAdmins)) {
                    if (!groups.includes(UserGroups.systemAdmins)) {
                        return NextResponse.redirect(new URL(DASHBOARD_PAGE_PATH, domain));
                    }
                    if (allowedRoutesForSysadmin.every((route) => !request.nextUrl.pathname.startsWith(route))) {
                        return NextResponse.redirect(new URL(SYSADMIN_MANAGE_ORGANISATIONS_PAGE_PATH, domain));
                    }
                }
            } else if (
                request.nextUrl.pathname.startsWith("/sysadmin/") ||
                request.nextUrl.pathname.startsWith("/api/sysadmin/")
            ) {
                if (!groups.includes(UserGroups.systemAdmins)) {
                    return NextResponse.redirect(new URL(DASHBOARD_PAGE_PATH, domain));
                }
            }

            return response;
        } catch (e) {
            const decodedToken = jose.decodeJwt(idToken.value);
            const username = (decodedToken["cognito:username"] as string) ?? null;

            const error = e as jose.errors.JWTExpired;

            if (error.code === "ERR_JWT_EXPIRED") {
                const refreshToken = request.cookies.get(COOKIES_REFRESH_TOKEN);

                if (refreshToken && username) {
                    try {
                        const refreshResult = await initiateRefreshAuth(username, refreshToken.value);
                        if (refreshResult.AuthenticationResult?.IdToken) {
                            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
                            console.log("Token refresh successful");
                            response.cookies.set(COOKIES_ID_TOKEN, refreshResult.AuthenticationResult.IdToken, {
                                sameSite: "lax",
                                httpOnly: true,
                            });

                            return response;
                        }
                    } catch (e) {
                        if (e instanceof Error) {
                            console.warn("Token refresh failed: ", e.stack);
                        }

                        return signOutUserAndRedirectToLogin(username);
                    }
                }
            }

            if (e instanceof Error) {
                console.error("Unexpected error when validating token: ", e.stack);
            }

            return signOutUserAndRedirectToLogin(username);
        }
    }

    return response;
}
