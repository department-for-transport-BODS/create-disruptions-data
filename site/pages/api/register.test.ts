import { ChallengeNameType } from "@aws-sdk/client-cognito-identity-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIES_REGISTER_ERRORS, DASHBOARD_PAGE_PATH, ERROR_PATH, REGISTER_PAGE_PATH } from "../../constants";
import * as cognito from "../../data/cognito";
import { ErrorInfo } from "../../interfaces";
import { getMockRequestAndResponse } from "../../testData/mockData";
import { destroyCookieOnResponseObject, setCookieOnResponseObject } from "../../utils/apiUtils";
import register from "./register.api";

describe("register", () => {
    const writeHeadMock = vi.fn();
    vi.mock("../../utils/apiUtils", async () => ({
        ...(await vi.importActual<object>("../../utils/apiUtils")),
        setCookieOnResponseObject: vi.fn(),
        destroyCookieOnResponseObject: vi.fn(),
    }));

    const initiateAuthSpy = vi.spyOn(cognito, "initiateAuth");

    vi.mock("../../data/cognito", () => ({
        initiateAuth: vi.fn(),
        respondToNewPasswordChallenge: vi.fn(),
        globalSignOut: vi.fn(),
    }));

    afterEach(() => {
        vi.resetAllMocks();
    });

    it.each(["test@example.com", "test+alias@example.com"])(
        "should redirect to register page when incorrect inputs are passed for %s",
        async (testEmail) => {
            const testKey = "";
            const testOrgId = "";

            const { req, res } = getMockRequestAndResponse({
                body: {
                    email: testEmail,
                    key: testKey,
                    orgId: testOrgId,
                },
                mockWriteHeadFn: writeHeadMock,
            });

            await register(req, res);

            const errors: ErrorInfo[] = [
                { errorMessage: "Enter a password", id: "password" },
                { errorMessage: "Required", id: "confirmPassword" },
                { errorMessage: "Invalid register link", id: "key" },
                { errorMessage: "Invalid organisation ID", id: "orgId" },
            ];

            expect(setCookieOnResponseObject).toHaveBeenCalledTimes(1);
            expect(setCookieOnResponseObject).toHaveBeenCalledWith(
                COOKIES_REGISTER_ERRORS,
                JSON.stringify({ inputs: req.body as object, errors }),
                res,
            );
            expect(writeHeadMock).toBeCalledWith(302, {
                Location: `${REGISTER_PAGE_PATH}?email=${encodeURIComponent(testEmail)}&key=${encodeURIComponent(testKey)}&orgId=${encodeURIComponent(testOrgId)}`,
            });
        },
    );

    it("should redirect to /dashboard page when valid inputs are passed", async () => {
        initiateAuthSpy.mockImplementation(() =>
            Promise.resolve({
                $metadata: {},
                ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
                ChallengeParameters: {
                    userAttributes: "test",
                },
                Session: "test",
            }),
        );

        const { req, res } = getMockRequestAndResponse({
            body: {
                email: "test@example.com",
                password: "dummyPassword1!",
                confirmPassword: "dummyPassword1!",
                key: "key123",
                orgId: "Org123",
            },
            mockWriteHeadFn: writeHeadMock,
        });

        await register(req, res);

        expect(destroyCookieOnResponseObject).toHaveBeenCalledTimes(3);
        expect(cognito.globalSignOut).toHaveBeenCalledTimes(2);

        expect(writeHeadMock).toBeCalledWith(302, { Location: DASHBOARD_PAGE_PATH });
    });

    it("should redirect to error page when invalid challenge is received", async () => {
        initiateAuthSpy.mockImplementation(() =>
            Promise.resolve({
                $metadata: {},
                ChallengeName: "INVALID" as ChallengeNameType,
                ChallengeParameters: {
                    userAttributes: "test",
                },
                Session: "test",
            }),
        );

        const { req, res } = getMockRequestAndResponse({
            body: {
                email: "test@example.com",
                password: "dummyPassword1!",
                confirmPassword: "dummyPassword1!",
                key: "key123",
                orgId: "Org123",
            },
            mockWriteHeadFn: writeHeadMock,
        });

        await register(req, res);

        expect(writeHeadMock).toBeCalledWith(302, { Location: ERROR_PATH });
    });

    it.each([
        [
            "pas",
            "Password must be a minimum of 8 characters, contain at least one uppercase letter, contain at least one number, and contain at least one special character.",
        ],
        [
            "password",
            "Password must contain at least one uppercase letter, contain at least one number, and contain at least one special character.",
        ],
        [
            "PASSWORD",
            "Password must contain at least one lowercase letter, contain at least one number, and contain at least one special character.",
        ],
        ["Password", "Password must contain at least one number and contain at least one special character."],
        ["Password1", "Password must contain at least one special character."],
    ])(
        "should redirect to register page when password doesn't meet requirements: %o",
        async (password, errorMessage) => {
            const testEmail = "test@example.com";
            const testOrgId = "Org123";
            const testKey = "Key123";

            const { req, res } = getMockRequestAndResponse({
                body: {
                    email: testEmail,
                    password: password,
                    confirmPassword: password,
                    key: testKey,
                    orgId: testOrgId,
                },
                mockWriteHeadFn: writeHeadMock,
            });

            await register(req, res);

            const errors: ErrorInfo[] = [{ errorMessage: errorMessage, id: "password" }];

            expect(setCookieOnResponseObject).toHaveBeenCalledTimes(1);
            expect(setCookieOnResponseObject).toHaveBeenCalledWith(
                COOKIES_REGISTER_ERRORS,
                JSON.stringify({ inputs: req.body as object, errors }),
                res,
            );
            expect(writeHeadMock).toBeCalledWith(302, {
                Location: `${REGISTER_PAGE_PATH}?email=${encodeURIComponent(testEmail)}&key=${encodeURIComponent(testKey)}&orgId=${encodeURIComponent(testOrgId)}`,
            });
        },
    );
});
