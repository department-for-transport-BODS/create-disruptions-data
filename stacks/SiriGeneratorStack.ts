import { Duration } from "aws-cdk-lib";
import { TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { EventType, Bucket as S3Bucket, StorageClass } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { Cron, Function, StackContext, use } from "sst/constructs";
import { DynamoDBStack } from "./DynamoDBStack";
import { MonitoringStack } from "./MonitoringStack";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";
import { createBucket, getRefDataApiUrl } from "./utils";

export const SiriGeneratorStack = ({ stack }: StackContext) => {
    const { organisationsTableV2: organisationsTable } = use(DynamoDBStack);
    const { siriGeneratorNamespace, siriPublishSuccessMetric, siriValidationFailureMetric, alarmTopic } =
        use(MonitoringStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret } = use(RdsStack);
    const { vpc, lambdaSg } = use(VpcStack);

    const siriSXBucket = createBucket(stack, "cdd-siri-sx", true, [
        {
            noncurrentVersionTransitions: [
                {
                    storageClass: StorageClass.INTELLIGENT_TIERING,
                    transitionAfter: Duration.days(30),
                },
            ],
        },
    ]);

    const siriSXUnvalidatedBucket = createBucket(stack, "cdd-siri-sx-unvalidated", false, [
        {
            expiration: Duration.days(30),
        },
    ]);
    const disruptionsJsonBucket = createBucket(stack, "cdd-disruptions-json", true, [
        {
            noncurrentVersionExpiration: Duration.days(30),
        },
    ]);
    const disruptionsCsvBucket = createBucket(stack, "cdd-disruptions-csv", true, [
        {
            noncurrentVersionExpiration: Duration.days(30),
        },
    ]);

    const apiUrl = getRefDataApiUrl(stack.stage);

    const siriGenerator = new Function(stack, "cdd-siri-sx-generator", {
        functionName: `cdd-siri-sx-generator-${stack.stage}`,
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        environment: {
            ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
            SIRI_SX_UNVALIDATED_BUCKET_NAME: siriSXUnvalidatedBucket.bucketName,
            DISRUPTIONS_JSON_BUCKET_NAME: disruptionsJsonBucket.bucketName,
            DISRUPTIONS_CSV_BUCKET_NAME: disruptionsCsvBucket.bucketName,
            STAGE: stack.stage,
            API_BASE_URL: apiUrl,
        },
        permissions: [
            new PolicyStatement({
                resources: [
                    `${siriSXUnvalidatedBucket.bucketArn}/*`,
                    `${disruptionsJsonBucket.bucketArn}/*`,
                    `${disruptionsCsvBucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
            }),
            new PolicyStatement({
                resources: [organisationsTable.tableArn],
                actions: ["dynamodb:GetItem"],
            }),
        ],
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        nodejs: {
            install: ["pg", "kysely"],
        },
        handler: "packages/siri-sx-generator/index.main",
        timeout: 60,
        memorySize: 1536,
        runtime: "nodejs22.x",
    });

    new Cron(stack, "cdd-siri-sx-generator-cron", {
        job: siriGenerator,
        schedule:
            stack.stage === "prod" || stack.stage === "preprod" ? "rate(1 minute)" : "cron(0/5 8-18 ? * MON-FRI *)",
    });

    const siriStatsGenerator = new Function(stack, "cdd-siri-stats-generator", {
        functionName: `cdd-siri-stats-generator-${stack.stage}`,
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        environment: {
            ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
            STAGE: stack.stage,
        },
        permissions: [
            new PolicyStatement({
                resources: [organisationsTable.tableArn],
                actions: ["dynamodb:Scan", "dynamodb:TransactWriteItem", "dynamodb:PutItem"],
            }),
        ],
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        nodejs: {
            install: ["pg", "kysely"],
        },
        handler: "packages/siri-sx-stats-generator/index.main",
        timeout: 60,
        memorySize: 1536,
        runtime: "nodejs22.x",
    });

    new Cron(stack, "cdd-siri-stats-generator-cron", {
        job: siriStatsGenerator,
        schedule:
            stack.stage === "prod" || stack.stage === "preprod" ? "rate(1 minute)" : "cron(0/5 8-18 ? * MON-FRI *)",
    });

    siriGenerator
        .metric("Errors")
        .createAlarm(stack, "cdd-siri-generator-failure-alarm", {
            evaluationPeriods: 1,
            threshold: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `cdd-siri-generator-failure-alarm-${stack.stage}`,
        })
        .addAlarmAction(new SnsAction(alarmTopic));

    const siriValidator = new Function(stack, "cdd-siri-sx-validator", {
        functionName: `cdd-siri-sx-validator-${stack.stage}`,
        environment: {
            SIRI_SX_BUCKET_NAME: siriSXBucket.bucketName,
            SIRI_SX_UNVALIDATED_BUCKET_NAME: siriSXUnvalidatedBucket.bucketName,
            METRIC_NAMESPACE: siriGeneratorNamespace,
            VALIDATION_FAILURE_METRIC: siriValidationFailureMetric.metricName,
            SIRI_PUBLISH_METRIC: siriPublishSuccessMetric.metricName,
            STAGE: stack.stage,
        },
        permissions: [
            new PolicyStatement({
                resources: [`${siriSXUnvalidatedBucket.bucketArn}/*`],
                actions: ["s3:GetObject"],
            }),
            new PolicyStatement({
                resources: [`${siriSXBucket.bucketArn}/*`],
                actions: ["s3:PutObject"],
            }),
            new PolicyStatement({
                resources: ["*"],
                actions: ["cloudwatch:PutMetricData"],
            }),
        ],
        handler: "packages/siri-sx-validator/index.main",
        timeout: 60,
        memorySize: 1536,
        runtime: "python3.11",
        enableLiveDev: false,
    });

    const validatorBucket = S3Bucket.fromBucketName(
        stack,
        "cdd-siri-sx-unvalidated-bucket",
        siriSXUnvalidatedBucket.bucketName,
    );

    validatorBucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(siriValidator));

    return {
        siriSXBucket,
        disruptionsJsonBucket,
        disruptionsCsvBucket,
    };
};
