import { Duration } from "aws-cdk-lib";
import {
    AccountRecovery,
    CfnUserPoolGroup,
    ClientAttributes,
    OAuthScope,
    StringAttribute,
    UserPool,
    UserPoolClient,
    UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";
import { Function, StackContext } from "sst/constructs";
import { UserGroups } from "../shared-ts/enums";
import { getDomain } from "../shared-ts/utils/domain";
import { isUserEnv } from "./utils";

export const CognitoStack = ({ stack }: StackContext) => {
    const domain = isUserEnv(stack.stage) ? "localhost:3000" : getDomain(stack.stage);
    const scheme = isUserEnv(stack.stage) ? "http://" : "https://";

    const customEmailLambda = new Function(stack, "cdd-custom-email-cognito-trigger", {
        functionName: `cdd-custom-email-cognito-trigger-${stack.stage}`,
        environment: {
            REGISTRATION_LINK: `${scheme}${domain}/register`,
            FORGOTTEN_PASSWORD_LINK: `${scheme}${domain}/reset-password`,
            CONTACT_LINK: `${scheme}${domain}/contact`,
        },
        handler: "packages/cognito-triggers/custom-email-trigger/index.main",
        timeout: 30,
        memorySize: 256,
        runtime: "python3.13",
        enableLiveDev: false,
        python: { noDocker: isUserEnv(stack.stage) },
    });

    const userPool = new UserPool(stack, "cdd-user-pool", {
        userPoolName: `cdd-user-pool-${stack.stage}`,
        customAttributes: {
            orgId: new StringAttribute({ minLen: 1, mutable: true }),
            operatorOrgId: new StringAttribute({ mutable: true }),
            disruptionEmailPref: new StringAttribute({ mutable: true }),
            streetManagerPref: new StringAttribute({ mutable: true }),
        },
        standardAttributes: {
            email: {
                required: true,
            },
        },
        signInAliases: {
            email: true,
        },
        signInCaseSensitive: false,
        passwordPolicy: {
            minLength: 8,
            requireDigits: true,
            requireLowercase: true,
            requireSymbols: true,
            requireUppercase: true,
            tempPasswordValidity: Duration.days(3),
        },
        email:
            stack.stage === "prod"
                ? UserPoolEmail.withSES({
                      fromEmail: `noreply@${getDomain(stack.stage)}`,
                      fromName: "Create Transport Disruption Data Service",
                      sesVerifiedDomain: getDomain(stack.stage),
                  })
                : UserPoolEmail.withCognito(),
        selfSignUpEnabled: false,
        accountRecovery: AccountRecovery.EMAIL_ONLY,
        autoVerify: {
            email: true,
        },
        deletionProtection: stack.stage === "prod",
        lambdaTriggers: {
            customMessage: customEmailLambda,
        },
    });

    const client = new UserPoolClient(stack, "cdd-site-client", {
        userPool,
        userPoolClientName: `cdd-site-client-${stack.stage}`,
        accessTokenValidity: Duration.minutes(20),
        idTokenValidity: Duration.minutes(20),
        refreshTokenValidity: Duration.days(30),
        authFlows: {
            adminUserPassword: true,
        },
        generateSecret: true,
        readAttributes: new ClientAttributes()
            .withStandardAttributes({ email: true, emailVerified: true, givenName: true, familyName: true })
            .withCustomAttributes("orgId", "operatorOrgId"),
        writeAttributes: new ClientAttributes().withStandardAttributes({ email: true }).withCustomAttributes("orgId"),
        preventUserExistenceErrors: true,
        oAuth: {
            scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
            callbackUrls: [`${scheme}${domain}/api/auth/callback/cognito`],
            flows: {
                authorizationCodeGrant: true,
            },
        },
    });

    Object.values(UserGroups).forEach((group) => {
        new CfnUserPoolGroup(stack, `cdd-user-pool-${group}-group`, {
            userPoolId: userPool.userPoolId,
            groupName: group,
        });
    });

    return {
        clientId: client.userPoolClientId,
        clientSecret: client.userPoolClientSecret,
        userPoolId: userPool.userPoolId,
        userPoolArn: userPool.userPoolArn,
        cognitoIssuer: `https://cognito-idp.${stack.region}.amazonaws.com/${userPool.userPoolId}`,
    };
};
