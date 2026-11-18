import { NotAuthorizedException } from "@aws-sdk/client-cognito-identity-provider";
import { NextApiRequest, NextApiResponse } from "next";
import {
    COOKIES_ID_TOKEN,
    COOKIES_REFRESH_TOKEN,
    COOKIES_REGISTER_ERRORS,
    DASHBOARD_PAGE_PATH,
    EXPIRED_LINK_PAGE_PATH,
    REGISTER_PAGE_PATH,
} from "../../constants";
import { globalSignOut, initiateAuth, respondToNewPasswordChallenge } from "../../data/cognito";
import { RegisterSchema, registerSchemaRefined } from "../../schemas/register.schema";
import { flattenZodErrors } from "../../utils";
import {
    destroyCookieOnResponseObject,
    redirectTo,
    redirectToError,
    setCookieOnResponseObject,
} from "../../utils/apiUtils";
import { getSession } from "../../utils/apiUtils/auth";
import logger from "../../utils/logger";

const register = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const session = getSession(req);

        if (session) {
            try {
                await globalSignOut(session.username);
            } catch {}

            destroyCookieOnResponseObject(COOKIES_ID_TOKEN, res);
            destroyCookieOnResponseObject(COOKIES_REFRESH_TOKEN, res);
        }

        const validatedBody = registerSchemaRefined.safeParse(req.body);
        if (!validatedBody.success) {
            const body = req.body as RegisterSchema;

            setCookieOnResponseObject(
                COOKIES_REGISTER_ERRORS,
                JSON.stringify({
                    inputs: body,
                    errors: flattenZodErrors(validatedBody.error),
                }),
                res,
            );

            redirectTo(
                res,
                `${REGISTER_PAGE_PATH}?email=${encodeURIComponent(body.email)}&key=${encodeURIComponent(body.key)}&orgId=${encodeURIComponent(body.orgId)}`,
            );
            return;
        }

        const { ChallengeName, ChallengeParameters, Session } = await initiateAuth(
            validatedBody.data.email,
            validatedBody.data.key,
        );

        if (ChallengeName === "NEW_PASSWORD_REQUIRED" && ChallengeParameters?.userAttributes && Session) {
            await respondToNewPasswordChallenge(
                ChallengeParameters.USER_ID_FOR_SRP,
                validatedBody.data.password,
                Session,
            );
            await globalSignOut(validatedBody.data.email);

            logger.info("", {
                context: "api.register",
                message: "registration successful",
            });
        } else {
            throw new Error(`unexpected challenge: ${ChallengeName ?? ""}`);
        }

        destroyCookieOnResponseObject(COOKIES_REGISTER_ERRORS, res);

        redirectTo(res, DASHBOARD_PAGE_PATH);
        return;
    } catch (e) {
        if (e instanceof NotAuthorizedException) {
            redirectTo(res, EXPIRED_LINK_PAGE_PATH);
            return;
        }
        if (e instanceof Error) {
            const message = "There was a problem while registering.";
            redirectToError(res, message, "api.register", e);
            return;
        }

        redirectToError(res);
        return;
    }
};

export default register;
