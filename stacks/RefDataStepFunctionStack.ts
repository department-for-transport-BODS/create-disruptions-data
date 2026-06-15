import { Duration } from "aws-cdk-lib";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnSchedule } from "aws-cdk-lib/aws-scheduler";
import {
    Chain,
    DefinitionBody,
    DistributedMap,
    InputType,
    JsonPath,
    Parallel,
    S3ObjectsItemReader,
    StateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Config, Function, StackContext, use } from "sst/constructs";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";
import { createBucket } from "./utils";

export const RefDataStepFunctionStack = ({ stack }: StackContext) => {
    const { vpc, lambdaSg } = use(VpcStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret } = use(RdsStack);

    const tndsFtpHostSecret = new Config.Secret(stack, "TNDS_FTP_HOST");
    const tndsFtpUsernameSecret = new Config.Secret(stack, "TNDS_FTP_USERNAME");
    const tndsFtpPasswordSecret = new Config.Secret(stack, "TNDS_FTP_PASSWORD");

    const csvBucket = createBucket(stack, "cdd-ref-csv-data", false);
    const txcBucket = createBucket(stack, "cdd-ref-txc-data", false, [{ enabled: true, expiration: Duration.days(5) }]);
    const txcZippedBucket = createBucket(stack, "cdd-ref-txc-zipped-data", false, [
        { enabled: true, expiration: Duration.days(5) },
    ]);
    const nptgBucket = createBucket(stack, "cdd-ref-nptg-data", false, [
        { enabled: true, expiration: Duration.days(5) },
    ]);
    const bankHolidaysBucket = createBucket(stack, "cdd-ref-bank-holidays-data", false, [
        { enabled: true, expiration: Duration.days(5) },
    ]);

    const cleardownDbTask = new LambdaInvoke(stack, "cdd-ref-data-cleardown-db-task", {
        stateName: "Cleardown Database",
        lambdaFunction: new Function(stack, "cdd-ref-data-cleardown-db-function", {
            functionName: `cdd-db-cleardown-${stack.stage}`,
            bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            securityGroups: [lambdaSg],
            nodejs: {
                install: ["pg", "kysely"],
            },
            handler: "packages/db-cleardown/index.main",
            timeout: 120,
            memorySize: 1024,
            runtime: "nodejs22.x",
            enableLiveDev: false,
        }),
    });

    const nocRetrieverTask = new LambdaInvoke(stack, "cdd-noc-retriever-task", {
        stateName: "Retrieve NOC Data",
        lambdaFunction: new Function(stack, "cdd-noc-retriever-function", {
            functionName: `cdd-noc-retriever-${stack.stage}`,
            handler: "packages/ref-data-retriever/index.main",
            timeout: 60,
            memorySize: 256,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${csvBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                DATA_URL:
                    "https://www.travelinedata.org.uk/wp-content/themes/desktop/nocadvanced_download.php?reportFormat=csvFlatFile&allTable%5B%5D=table_noclines&allTable%5B%5D=table_noc_table&allTable%5B%5D=table_public_name&submit=Submit",
                BUCKET_NAME: csvBucket.bucketName,
                CONTENT_TYPE: "text/csv",
            },
            enableLiveDev: false,
        }),
    });

    const naptanRetrieverTask = new LambdaInvoke(stack, "cdd-naptan-retriever-task", {
        stateName: "Retrieve NaPTAN Data",
        lambdaFunction: new Function(stack, "cdd-naptan-retriever-function", {
            functionName: `cdd-naptan-retriever-${stack.stage}`,
            handler: "packages/ref-data-retriever/index.main",
            timeout: 60,
            memorySize: 512,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${csvBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                DATA_URL: "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv",
                BUCKET_NAME: csvBucket.bucketName,
                CONTENT_TYPE: "text/csv",
                TARGET_FILE: "Stops.csv",
            },
            enableLiveDev: false,
        }),
    });

    const nptgRetrieverTask = new LambdaInvoke(stack, "cdd-nptg-retriever-task", {
        stateName: "Retrieve NPTG Data",
        lambdaFunction: new Function(stack, "cdd-nptg-retriever-function", {
            functionName: `cdd-nptg-retriever-${stack.stage}`,
            handler: "packages/ref-data-retriever/index.main",
            timeout: 60,
            memorySize: 512,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${nptgBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                DATA_URL: "https://naptan.api.dft.gov.uk/v1/nptg",
                BUCKET_NAME: nptgBucket.bucketName,
                CONTENT_TYPE: "application/xml",
                TARGET_FILE: "nptg.xml",
            },
            enableLiveDev: false,
        }),
    });

    const bodsTxcRetrieverTask = new LambdaInvoke(stack, "cdd-bods-txc-retriever-task", {
        stateName: "Retrieve BODS TxC",
        lambdaFunction: new Function(stack, "cdd-bods-txc-retriever-function", {
            functionName: `cdd-bods-txc-retriever-${stack.stage}`,
            handler: "packages/bods-txc-retriever/index.main",
            timeout: 300,
            memorySize: 2048,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${txcZippedBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${txcBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                BODS_URL: "https://data.bus-data.dft.gov.uk/timetable/download/bulk_archive",
                BODS_COACH_URL: "https://coach.bus-data.dft.gov.uk/TxC-2.4.zip",
                TXC_ZIPPED_BUCKET_NAME: txcZippedBucket.bucketName,
                TXC_BUCKET_NAME: txcBucket.bucketName,
            },
            enableLiveDev: false,
        }),
        outputPath: "$.Payload",
    });

    const tndsTxcRetrieverTask = new LambdaInvoke(stack, "cdd-tnds-txc-retriever-task", {
        stateName: "Retrieve TNDS TxC",
        lambdaFunction: new Function(stack, "cdd-tnds-txc-retriever-function", {
            functionName: `cdd-tnds-txc-retriever-${stack.stage}`,
            bind: [tndsFtpHostSecret, tndsFtpUsernameSecret, tndsFtpPasswordSecret],
            handler: "packages/tnds-txc-retriever/index.main",
            timeout: 120,
            memorySize: 2048,
            diskSize: 1024,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${txcZippedBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                TXC_ZIPPED_BUCKET_NAME: txcZippedBucket.bucketName,
            },
            enableLiveDev: false,
        }),
        outputPath: "$.Payload",
    });

    const bankHolidaysRetrieverTask = new LambdaInvoke(stack, "cdd-bank-holidays-retriever-task", {
        stateName: "Retrieve Bank Holidays Data",
        lambdaFunction: new Function(stack, "cdd-bank-holidays-retriever-function", {
            functionName: `cdd-bank-holidays-retriever-${stack.stage}`,
            handler: "packages/bank-holidays-retriever/index.main",
            timeout: 60,
            memorySize: 256,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${bankHolidaysBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            environment: {
                BANK_HOLIDAYS_BUCKET_NAME: bankHolidaysBucket.bucketName,
            },
            enableLiveDev: false,
        }),
    });

    const unzipperTask = new LambdaInvoke(stack, "cdd-ref-data-unzipper-task", {
        stateName: "Unzip TxC File",
        lambdaFunction: new Function(stack, "cdd-ref-data-unzipper-function", {
            functionName: `cdd-ref-data-unzipper-${stack.stage}`,
            handler: "packages/unzipper/index.main",
            timeout: 120,
            memorySize: 2560,
            diskSize: 3072,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            permissions: [
                new PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${txcBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["s3:GetObject"],
                    resources: [`${txcZippedBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            retryAttempts: 0,
            environment: {
                UNZIPPED_BUCKET_NAME: txcBucket.bucketName,
            },
            enableLiveDev: false,
        }),
        outputPath: JsonPath.DISCARD,
        payload: {
            type: InputType.OBJECT,
            value: {
                Records: [
                    {
                        s3: {
                            bucket: {
                                name: txcZippedBucket.bucketName,
                            },
                            object: {
                                "key.$": "$.Key",
                            },
                        },
                    },
                ],
            },
        },
    });

    const csvRefDataUploaderTask = new LambdaInvoke(stack, "cdd-csv-ref-data-uploader-task", {
        stateName: "Upload CSV Ref Data",
        lambdaFunction: new Function(stack, "cdd-csv-ref-data-uploader-function", {
            functionName: `cdd-csv-ref-data-uploader-${stack.stage}`,
            handler: "packages/ref-data-csv-uploader/index.main",
            bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [lambdaSg],
            nodejs: {
                install: ["pg", "kysely"],
            },
            timeout: 600,
            memorySize: 3008,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            environment: {
                CSV_BUCKET_NAME: csvBucket.bucketName,
            },
            permissions: [
                new PolicyStatement({
                    actions: ["s3:GetObject"],
                    resources: [`${csvBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            enableLiveDev: false,
        }),
        resultPath: JsonPath.DISCARD,
    });

    const nptgUploaderTask = new LambdaInvoke(stack, "cdd-nptg-uploader-task", {
        stateName: "Upload NPTG Data",
        lambdaFunction: new Function(stack, "cdd-nptg-uploader-function", {
            functionName: `cdd-nptg-uploader-${stack.stage}`,
            handler: "packages/nptg-uploader/index.main",
            bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [lambdaSg],
            nodejs: {
                install: ["pg", "kysely"],
            },
            timeout: 300,
            memorySize: 2048,
            runtime: "nodejs22.x",
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            environment: {
                NPTG_BUCKET_NAME: nptgBucket.bucketName,
            },
            permissions: [
                new PolicyStatement({
                    actions: ["s3:GetObject"],
                    resources: [`${nptgBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            enableLiveDev: false,
        }),
        outputPath: JsonPath.DISCARD,
    });

    const txcUploaderTask = new LambdaInvoke(stack, "cdd-txc-uploader-task", {
        stateName: "Upload TxC Data",
        lambdaFunction: new Function(stack, "cdd-txc-uploader-function", {
            functionName: `cdd-txc-uploader-${stack.stage}`,
            handler: "packages/txc-uploader/index.main",
            bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [lambdaSg],
            timeout: 600,
            memorySize: 2048,
            runtime: "python3.12",
            reservedConcurrentExecutions: 50,
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            environment: {
                DATABASE_NAME_PARAM: `/sst/create-disruptions-data/${stack.stage}/Secret/DB_NAME/value`,
                DATABASE_HOST_PARAM: `/sst/create-disruptions-data/${stack.stage}/Secret/DB_HOST/value`,
                DATABASE_USERNAME_PARAM: `/sst/create-disruptions-data/${stack.stage}/Secret/DB_USERNAME/value`,
                DATABASE_PORT_PARAM: `/sst/create-disruptions-data/${stack.stage}/Secret/DB_PORT/value`,
                DATABASE_PASSWORD_PARAM: `/sst/create-disruptions-data/${stack.stage}/Secret/DB_PASSWORD/value`,
                BANK_HOLIDAYS_BUCKET_NAME: bankHolidaysBucket.bucketName,
            },
            permissions: [
                new PolicyStatement({
                    actions: ["s3:GetObject", "s3:HeadObject"],
                    resources: [`${txcBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["s3:GetObject"],
                    resources: [`${bankHolidaysBucket.bucketArn}/*`],
                }),
                new PolicyStatement({
                    actions: ["ssm:GetParameters", "ssm:GetParameter"],
                    resources: [
                        `arn:aws:ssm:${stack.region}:${stack.account}:parameter/sst/create-disruptions-data/${stack.stage}/Secret/DB_*`,
                    ],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
            enableLiveDev: true,
        }),
        payload: {
            type: InputType.OBJECT,
            value: {
                Records: [
                    {
                        s3: {
                            bucket: {
                                name: txcBucket.bucketName,
                            },
                            object: {
                                "key.$": "$.Key",
                            },
                        },
                    },
                ],
            },
        },
        outputPath: JsonPath.DISCARD,
    });

    const tableRenamerTask = new LambdaInvoke(stack, "cdd-ref-data-service-table-renamer-task", {
        stateName: "Table Renamer",
        lambdaFunction: new Function(stack, "cdd-ref-data-service-table-renamer-function", {
            functionName: `cdd-db-table-renamer-${stack.stage}`,
            bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
            securityGroups: [lambdaSg],
            nodejs: {
                install: ["pg", "kysely"],
            },
            handler: "packages/table-renamer/index.main",
            timeout: 120,
            memorySize: 1024,
            runtime: "nodejs22.x",
            enableLiveDev: false,
            environment: {
                STAGE: stack.stage,
            },
            permissions: [
                new PolicyStatement({
                    actions: ["ssm:GetParameters", "ssm:GetParameter"],
                    resources: [
                        `arn:aws:ssm:${stack.region}:${stack.account}:parameter/sst/create-disruptions-data/${stack.stage}/Secret/DB_*`,
                    ],
                }),
                new PolicyStatement({
                    actions: ["cloudwatch:PutMetricData"],
                    resources: ["*"],
                }),
            ],
        }),
    });

    const zippedObjectsMap = new DistributedMap(stack, "cdd-txc-unzipper-map", {
        stateName: "Get Zipped TxC",
        inputPath: "$[0]",
        itemReader: new S3ObjectsItemReader({
            bucketNamePath: txcZippedBucket.bucketName,
            prefix: JsonPath.stringAt("$.prefix"),
        }),
        resultPath: JsonPath.DISCARD,
        toleratedFailureCount: 10,
    });

    zippedObjectsMap.itemProcessor(unzipperTask);

    const txcObjectsMap = new DistributedMap(stack, "cdd-txc-objects-map", {
        stateName: "Get TxC Objects",
        inputPath: "$[0]",
        itemReader: new S3ObjectsItemReader({
            bucketNamePath: txcBucket.bucketName,
            prefix: JsonPath.stringAt("$.prefix"),
        }),
        maxConcurrency: stack.stage === "prod" ? 50 : 30,
        toleratedFailureCount: 10,
        outputPath: JsonPath.DISCARD,
    });

    txcObjectsMap.itemProcessor(txcUploaderTask);

    const refDataRetrievalParallel = new Parallel(stack, "cdd-ref-data-retrieval", {
        stateName: "Ref Data Retrieval",
    })
        .branch(tndsTxcRetrieverTask)
        .branch(bodsTxcRetrieverTask)
        .branch(nocRetrieverTask)
        .branch(naptanRetrieverTask)
        .branch(nptgRetrieverTask)
        .branch(bankHolidaysRetrieverTask);

    const refDataUploadingParallel = new Parallel(stack, "cdd-ref-data-uploading", {
        stateName: "Ref Data Uploading",
        resultPath: JsonPath.DISCARD,
    })
        .branch(csvRefDataUploaderTask)
        .branch(nptgUploaderTask);

    const chain = Chain.start(cleardownDbTask)
        .next(refDataRetrievalParallel)
        .next(zippedObjectsMap)
        .next(refDataUploadingParallel)
        .next(txcObjectsMap)
        .next(tableRenamerTask);

    const sfn = new StateMachine(stack, "ref-data-state-machine", {
        stateMachineName: `ref-data-ingestion-state-machine-${stack.stage}`,
        definitionBody: DefinitionBody.fromChainable(chain),
    });

    const sfnScheduleRole = new Role(stack, "ref-data-sfn-schedule-role", {
        assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    });

    const sfnSchedulePolicy = new ManagedPolicy(stack, "ref-data-sfn-schedule-policy", {
        statements: [
            new PolicyStatement({
                actions: ["states:StartExecution"],
                resources: [sfn.stateMachineArn],
            }),
        ],
    });

    sfnScheduleRole.addManagedPolicy(sfnSchedulePolicy);

    new CfnSchedule(stack, "ref-data-sfn-schedule", {
        target: {
            arn: sfn.stateMachineArn,
            roleArn: sfnScheduleRole.roleArn,
        },
        scheduleExpression: "cron(0 1 * * ? *)",
        flexibleTimeWindow: {
            mode: "OFF",
        },
        scheduleExpressionTimezone: "Europe/London",
        state: ["prod", "preprod"].includes(stack.stage) ? "ENABLED" : "DISABLED",
    });
};
