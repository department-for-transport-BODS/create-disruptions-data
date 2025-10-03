import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { AccessKey, ManagedPolicy, PolicyStatement, User } from "aws-cdk-lib/aws-iam";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Cron, Function, NextjsSite, StackContext, use } from "sst/constructs";
import { getDomain } from "../shared-ts/utils/domain";
import { CognitoStack } from "./CognitoStack";
import { DynamoDBStack } from "./DynamoDBStack";
import { MonitoringStack } from "./MonitoringStack";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";
import { createBucket, getRefDataApiUrl, isUserEnv } from "./utils";

export const SiteStack = ({ stack }: StackContext) => {
    const { organisationsTableV2: organisationsTable } = use(DynamoDBStack);
    const { clientId, clientSecret, cognitoIssuer, userPoolId, userPoolArn } = use(CognitoStack);
    const { alarmTopic } = use(MonitoringStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbHostSecret, dbPortSecret } =
        use(RdsStack);
    const { vpc, siteSg } = use(VpcStack);

    const siteImageBucket = createBucket(stack, "cdd-image-bucket", true);

    let prodDomain = "";
    let prodCertArn = "";

    if (stack.stage === "prod") {
        prodDomain = process.env.PROD_DOMAIN?.toString() ?? "";
        prodCertArn = process.env.PROD_CERT_ARN?.toString() ?? "";

        if (!prodDomain) {
            throw new Error("PROD_DOMAIN must be set in production");
        }
    }

    const apiUrl = getRefDataApiUrl(stack.stage);

    const middlewareCognitoUser = new User(stack, "cdd-site-middleware-user", {
        userName: `cdd-site-middleware-user-${stack.stage}-${stack.region}`,
        managedPolicies: [
            new ManagedPolicy(stack, "cdd-site-middleware-user-policy", {
                statements: [
                    new PolicyStatement({
                        resources: [userPoolArn],
                        actions: ["cognito-idp:AdminInitiateAuth", "cognito-idp:AdminUserGlobalSignOut"],
                    }),
                ],
            }),
        ],
    });

    const middlewareCognitoUserAccessKey = new AccessKey(stack, "cdd-site-middleware-user-creds", {
        user: middlewareCognitoUser,
    });

    const middlewareCognitoUserSecret = new Secret(stack, "cdd-site-middleware-user-creds-secret", {
        secretStringValue: middlewareCognitoUserAccessKey.secretAccessKey,
    });

    const site = new NextjsSite(stack, "Site", {
        path: "site/",
        runtime: "nodejs22.x",
        warm: stack.stage === "prod" || stack.stage === "preprod" ? 50 : 10,
        memorySize: stack.stage === "prod" ? "3072 MB" : "1024 MB",
        cdk: {
            server: {
                vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [siteSg],
            },
        },
        dev: {
            deploy: false,
        },
        bind: [dbUsernameSecret, dbPasswordSecret, dbHostSecret, dbHostROSecret, dbPortSecret, dbNameSecret],
        environment: {
            ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
            STAGE: stack.stage,
            API_BASE_URL: apiUrl,
            MAP_BOX_ACCESS_TOKEN: process.env.MAP_BOX_ACCESS_TOKEN || "",
            FEEDBACK_EMAIL_ADDRESS: stack.stage === "prod" ? "bodshelpdesk@kpmg.co.uk" : "feedback@dft-create-data.com",
            AWS_SES_IDENTITY_ARN: process.env.AWS_SES_IDENTITY_ARN || "",
            COGNITO_CLIENT_ID: clientId,
            COGNITO_CLIENT_SECRET: clientSecret.toString(),
            COGNITO_ISSUER: cognitoIssuer,
            COGNITO_USER_POOL_ID: userPoolId,
            MIDDLEWARE_AWS_ACCESS_KEY_ID: middlewareCognitoUserAccessKey.accessKeyId,
            MIDDLEWARE_AWS_SECRET_ACCESS_KEY: middlewareCognitoUserSecret.secretValue.toString(),
            IMAGE_BUCKET_NAME: siteImageBucket.bucketName,
            DOMAIN_NAME: `${isUserEnv(stack.stage) ? "http://" : "https://"}${
                isUserEnv(stack.stage) ? "localhost:3000" : getDomain(stack.stage)
            }`,
        },
        customDomain: {
            domainName:
                stack.stage === "prod"
                    ? prodDomain
                    : isUserEnv(stack.stage)
                      ? `${stack.stage}.${getDomain(stack.stage)}`
                      : getDomain(stack.stage),
            hostedZone: stack.stage !== "prod" ? getDomain(stack.stage) : undefined,
            isExternalDomain: stack.stage === "prod",
            cdk:
                stack.stage === "prod"
                    ? {
                          certificate: Certificate.fromCertificateArn(stack, "cdd-prod-certificate", prodCertArn),
                      }
                    : undefined,
        },
        permissions: [
            new PolicyStatement({
                resources: [`${siteImageBucket.bucketArn}/*`],
                actions: ["s3:GetObject", "s3:PutObject"],
            }),
            new PolicyStatement({
                resources: [organisationsTable.tableArn],
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:BatchGetItem",
                    "dynamodb:BatchWriteItem",
                    "dynamodb:Scan",
                ],
            }),
            new PolicyStatement({
                resources: ["*"],
                actions: ["ses:SendEmail", "ses:SendRawEmail"],
            }),
            new PolicyStatement({
                resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter/social/*`],
                actions: ["ssm:GetParameter", "ssm:PutParameter", "ssm:DeleteParameter", "ssm:GetParametersByPath"],
            }),
            new PolicyStatement({
                resources: ["*"],
                actions: [
                    "cognito-idp:ForgotPassword",
                    "cognito-idp:ConfirmForgotPassword",
                    "cognito-idp:ChangePassword",
                    "cognito-idp:ListUserPools",
                ],
            }),
            new PolicyStatement({
                resources: [userPoolArn],
                actions: [
                    "cognito-idp:AdminInitiateAuth",
                    "cognito-idp:AdminUserGlobalSignOut",
                    "cognito-idp:DescribeUserPool",
                    "cognito-idp:AdminRespondToAuthChallenge",
                    "cognito-idp:AdminUpdateUserAttributes",
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:ListUserPoolClients",
                    "cognito-idp:DescribeUserPoolClient",
                    "cognito-idp:ListUsers",
                    "cognito-idp:ListGroups",
                    "cognito-idp:AdminAddUserToGroup",
                    "cognito-idp:AdminDeleteUser",
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:ListUsersInGroup",
                    "cognito-idp:AdminListGroupsForUser",
                    "cognito-idp:AdminRemoveUserFromGroup",
                ],
            }),
        ],
    });

    stack.addOutputs({
        URL: site.url || "",
    });

    const nextDoorTokenRefresher = new Function(stack, "cdd-nextdoor-token-refresher", {
        functionName: `cdd-nextdoor-token-refresher-${stack.stage}`,
        permissions: [
            new PolicyStatement({
                resources: [
                    `arn:aws:ssm:${stack.region}:${stack.account}:parameter/social/nextdoor*`,
                    `arn:aws:ssm:${stack.region}:${stack.account}:parameter/social/nextdoor/*`,
                ],
                actions: ["ssm:GetParameter", "ssm:PutParameter", "ssm:DeleteParameter", "ssm:GetParametersByPath"],
            }),
        ],
        handler: "packages/nextdoor-token-refresher/index.main",
        timeout: 60,
        memorySize: 1536,
        runtime: "nodejs22.x",
    });

    new Cron(stack, "nextdoor-token-refresher-cron", {
        job: nextDoorTokenRefresher,
        schedule: "rate(4 hours)",
    });

    nextDoorTokenRefresher
        .metric("Errors")
        .createAlarm(stack, "cdd-nextdoor-token-refresher-failure-alarm", {
            evaluationPeriods: 1,
            threshold: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `cdd-nextdoor-token-refresher-failure-alarm-${stack.stage}`,
        })
        .addAlarmAction(new SnsAction(alarmTopic));
};
