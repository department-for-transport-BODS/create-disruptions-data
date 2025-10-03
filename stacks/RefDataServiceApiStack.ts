import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { Subscription, SubscriptionProtocol, Topic } from "aws-cdk-lib/aws-sns";
import { Api, Function, StackContext, use } from "sst/constructs";
import { getDomain } from "../shared-ts/utils/domain";
import { DnsStack } from "./DnsStack";
import { QueueStack } from "./QueueStack";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";
import { isUserEnv } from "./utils";

export function RefDataServiceApiStack({ stack }: StackContext) {
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret } = use(RdsStack);
    const { hostedZone } = use(DnsStack);
    const { vpc, lambdaSg } = use(VpcStack);
    const { streetManagerSqsQueue } = use(QueueStack);

    if (!hostedZone) {
        return;
    }

    const { ROOT_DOMAIN: rootDomain } = process.env;

    if (!rootDomain) {
        throw new Error("ROOT_DOMAIN must be set");
    }

    let prodDomain = "";

    if (stack.stage === "prod") {
        prodDomain = process.env.PROD_DOMAIN?.toString() ?? "";

        if (!prodDomain) {
            throw new Error("PROD_DOMAIN must be set in production");
        }
    }

    let streetManagerTestTopic: Topic | null = null;

    if (stack.stage !== "prod") {
        streetManagerTestTopic = new Topic(stack, "street-manager-test-topic", {
            topicName: `street-manager-test-topic-${stack.stage}`,
        });
    }

    const stopsFunction = new Function(stack, "ref-data-service-get-stops-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-stops-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-stops/index.main",
        timeout: 10,
        memorySize: 512,
        environment: {
            MAX_ATCO_CODES: "50",
            MAX_NAPTAN_CODES: "50",
            MAX_ADMIN_AREA_CODES: "50",
        },
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const operatorsFunction = new Function(stack, "ref-data-service-get-operators-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-operators-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-operators/index.main",
        timeout: 10,
        memorySize: 512,
        environment: {
            MAX_NOC_CODES: "50",
        },
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const servicesForOperatorFunction = new Function(stack, "ref-data-service-get-services-for-operator-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-services-for-operator-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-services-for-operator/index.main",
        timeout: 30,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const serviceByIdFunction = new Function(stack, "ref-data-service-get-service-by-id-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-service-by-id-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-service-by-id/index.main",
        timeout: 30,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const servicesFunction = new Function(stack, "ref-data-service-get-services-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-services-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-services/index.main",
        timeout: 30,
        memorySize: 512,
        environment: {
            MAX_ATCO_CODES: "100",
        },
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const serviceStopsFunction = new Function(stack, "ref-data-service-get-service-stops-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-service-stops-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-service-stops/index.main",
        timeout: 30,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const serviceJourneysFunction = new Function(stack, "ref-data-service-get-service-journeys-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-service-journeys-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-service-journeys/index.main",
        timeout: 30,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const serviceRoutesFunction = new Function(stack, "ref-data-service-get-service-routes-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-service-routes-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-service-routes/index.main",
        timeout: 30,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const areaCodeFunction = new Function(stack, "ref-data-service-get-admin-area-codes-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-admin-area-codes-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-admin-area-codes/index.main",
        timeout: 10,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const adminAreasFunction = new Function(stack, "ref-data-service-get-admin-areas-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-admin-areas-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-admin-areas/index.main",
        timeout: 10,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const postStreetManagerFunction = new Function(stack, "ref-data-service-post-street-manager-function", {
        bind: [streetManagerSqsQueue, dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-post-street-manager-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/post-street-manager/index.main",
        timeout: 10,
        memorySize: 512,
        environment: {
            STREET_MANAGER_SQS_QUEUE_URL: streetManagerSqsQueue.queueUrl,
            TEST_STREET_MANAGER_TOPIC_ARN: streetManagerTestTopic?.topicArn ?? "",
        },
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const roadworksFunction = new Function(stack, "ref-data-service-get-roadworks-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-roadworks-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-roadworks/index.main",
        timeout: 10,
        memorySize: 512,
        environment: {
            MAX_ADMIN_AREA_CODES: "50",
        },
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const roadworkByIdFunction = new Function(stack, "ref-data-service-get-roadwork-by-id-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
        functionName: `ref-data-service-get-roadwork-by-id-function-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/ref-data-service-api/get-roadwork-by-id/index.main",
        timeout: 10,
        memorySize: 512,
        runtime: "nodejs22.x",
        logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
    });

    const subDomain = isUserEnv(stack.stage)
        ? `ref-data-api.${stack.stage}.${getDomain(stack.stage)}`
        : `ref-data-api.${getDomain(stack.stage, true)}`;

    const allowedOrigins = [`https://${getDomain(stack.stage)}`];

    if (!["preprod", "prod"].includes(stack.stage)) {
        allowedOrigins.push("http://localhost:3000");
    }

    const api = new Api(stack, "ref-data-service-api", {
        routes: {
            "GET /stops": stopsFunction,
            "GET /operators": operatorsFunction,
            "GET /operators/{nocCode}": operatorsFunction,
            "GET /operators/{nocCode}/services": servicesForOperatorFunction,
            "GET /operators/{nocCode}/services/{serviceId}": serviceByIdFunction,
            "GET /services": servicesFunction,
            "GET /services/{serviceId}/stops": serviceStopsFunction,
            "GET /services/{serviceId}/journeys": serviceJourneysFunction,
            "GET /services/{serviceId}/routes": serviceRoutesFunction,
            "GET /area-codes": areaCodeFunction,
            "GET /admin-areas": adminAreasFunction,
            "POST /street-manager": postStreetManagerFunction,
            "GET /roadworks": roadworksFunction,
            "GET /roadworks/{permitReferenceNumber}": roadworkByIdFunction,
        },
        customDomain: {
            domainName: subDomain,
            hostedZone: hostedZone.zoneName,
            path: "v1",
        },
        cors: {
            allowMethods: ["GET"],
            allowHeaders: ["Accept", "Content-Type", "Authorization"],
            allowOrigins: allowedOrigins,
        },
        cdk: {
            httpApi: {
                apiName: `ref-data-service-api-${stack.stage}`,
            },
        },
    });

    if (streetManagerTestTopic) {
        new Subscription(stack, "street-manager-test-subscription", {
            endpoint: `${api.url}/street-manager`,
            protocol: SubscriptionProtocol.HTTPS,
            topic: streetManagerTestTopic,
        });
    }

    stack.addOutputs({
        ApiEndpoint: api.url,
    });
}
