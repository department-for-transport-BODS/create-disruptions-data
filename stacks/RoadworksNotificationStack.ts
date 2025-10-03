import { TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Cron, Function, StackContext, use } from "sst/constructs";
import { CognitoStack } from "./CognitoStack";
import { DynamoDBStack } from "./DynamoDBStack";
import { MonitoringStack } from "./MonitoringStack";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";
import { getRefDataApiUrl } from "./utils";

export const RoadworksNotificationStack = ({ stack }: StackContext) => {
    const { organisationsTableV2: organisationsTable } = use(DynamoDBStack);
    const { clientId, clientSecret, userPoolId, userPoolArn } = use(CognitoStack);
    const { alarmTopic } = use(MonitoringStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbHostSecret, dbPortSecret } =
        use(RdsStack);
    const { vpc, lambdaSg } = use(VpcStack);

    const apiUrl = getRefDataApiUrl(stack.stage);

    const url =
        stack.stage === "prod"
            ? "https://disruption-data.dft.gov.uk"
            : !["preprod", "test"].includes(stack.stage)
              ? "http://localhost:3000"
              : `https://${stack.stage}.cdd.dft-create-data.com`;

    const cancelledRoadworkNotification = new Function(stack, "cdd-roadworks-cancelled-notification", {
        functionName: `cdd-roadworks-cancelled-notification-${stack.stage}`,
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        environment: {
            ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
            API_BASE_URL: apiUrl,
            COGNITO_CLIENT_ID: clientId,
            COGNITO_CLIENT_SECRET: clientSecret.toString(),
            COGNITO_USER_POOL_ID: userPoolId,
            DOMAIN_NAME: url,
            STAGE: stack.stage,
        },
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/roadworks-notifier/cancelledNotifier.main",
        nodejs: {
            install: ["pg", "kysely"],
        },
        permissions: [
            new PolicyStatement({
                resources: ["*"],
                actions: ["ses:SendEmail", "ses:SendRawEmail"],
            }),
            new PolicyStatement({
                resources: [userPoolArn],
                actions: ["cognito-idp:ListUsersInGroup"],
            }),
        ],
        timeout: 60,
        memorySize: 1536,
        runtime: "nodejs22.x",
    });

    new Cron(stack, "cdd-roadworks-cancelled-notification-cron", {
        job: cancelledRoadworkNotification,
        schedule:
            stack.stage === "prod" || stack.stage === "preprod" ? "rate(5 minutes)" : "cron(0/10 8-18 ? * MON-FRI *)",
    });

    cancelledRoadworkNotification
        .metric("Errors")
        .createAlarm(stack, "cdd-cancelled-roadworks-notification-failure-alarm", {
            evaluationPeriods: 1,
            threshold: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `cdd-cancelled-roadworks-notification-failure-alarm-${stack.stage}`,
        })
        .addAlarmAction(new SnsAction(alarmTopic));

    const newRoadworkNotification = new Function(stack, "cdd-roadworks-new-notification", {
        functionName: `cdd-roadworks-new-notification-${stack.stage}`,
        environment: {
            API_BASE_URL: apiUrl,
            COGNITO_CLIENT_ID: clientId,
            COGNITO_CLIENT_SECRET: clientSecret.toString(),
            COGNITO_USER_POOL_ID: userPoolId,
            DOMAIN_NAME: url,
            STAGE: stack.stage,
            ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
        },
        handler: "packages/roadworks-notifier/newNotifier.main",
        permissions: [
            new PolicyStatement({
                resources: ["*"],
                actions: ["ses:SendEmail", "ses:SendRawEmail"],
            }),
            new PolicyStatement({
                resources: [organisationsTable.tableArn],
                actions: ["dynamodb:Scan"],
            }),
            new PolicyStatement({
                resources: [userPoolArn],
                actions: ["cognito-idp:ListUsers"],
            }),
        ],
        timeout: 60,
        memorySize: 1536,
        runtime: "nodejs22.x",
    });

    new Cron(stack, "cdd-roadworks-new-notification-cron", {
        job: newRoadworkNotification,
        schedule: "cron(0 8 * * ? *)",
    });

    newRoadworkNotification
        .metric("Errors")
        .createAlarm(stack, "cdd-new-roadworks-notification-failure-alarm", {
            evaluationPeriods: 1,
            threshold: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `cdd-new-roadworks-notification-failure-alarm-${stack.stage}`,
        })
        .addAlarmAction(new SnsAction(alarmTopic));

    const cleanupRoadworks = new Function(stack, "cdd-cleanup-roadworks", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
        functionName: `cdd-cleanup-roadworks-${stack.stage}`,
        handler: "packages/cleanup-roadworks/index.main",
        runtime: "nodejs22.x",
        timeout: 600,
        memorySize: 1024,
        environment: {
            STAGE: stack.stage,
        },
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        nodejs: {
            install: ["pg", "kysely"],
        },
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
        permissions: [
            new PolicyStatement({
                actions: ["cloudwatch:PutMetricData"],
                resources: ["*"],
            }),
            new PolicyStatement({
                actions: ["ssm:PutParameter"],
                resources: ["*"],
            }),
        ],
    });

    const enableSchedule = stack.stage === "prod" || stack.stage === "preprod" || stack.stage === "test";

    new Cron(stack, "cdd-cleanup-roadworks-cron", {
        job: cleanupRoadworks,
        enabled: enableSchedule,
        schedule: "cron(0 1 * * ? *)",
    });
};
