import { Duration } from "aws-cdk-lib";
import { AuthorizationType, AwsIntegration, MethodOptions, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { ApiGatewayV1Api, StackContext, use } from "sst/constructs";
import { DnsStack } from "./DnsStack";
import { DynamoDBStack } from "./DynamoDBStack";
import { RdsStack } from "./RdsStack";
import { SiriGeneratorStack } from "./SiriGeneratorStack";
import { VpcStack } from "./VpcStack";
import { getRefDataApiUrl, isUserEnv } from "./utils";

export const SiriAPIStack = ({ stack }: StackContext) => {
    const { siriSXBucket, disruptionsJsonBucket, disruptionsCsvBucket } = use(SiriGeneratorStack);
    const { hostedZone } = use(DnsStack);
    const { organisationsTableV2: organisationsTable } = use(DynamoDBStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret } = use(RdsStack);
    const { vpc, lambdaSg } = use(VpcStack);

    if (!hostedZone) {
        return;
    }

    const apiUrl = getRefDataApiUrl(stack.stage);

    const subDomain = ["sandbox", "test", "preprod", "prod"].includes(stack.stage) ? "api" : `api.${stack.stage}`;

    const apiGateway = new ApiGatewayV1Api(stack, "cdd-siri-sx-api", {
        customDomain: {
            domainName: `${subDomain}.${hostedZone.zoneName}`,
            hostedZone: hostedZone.zoneName,
            path: "v1",
            securityPolicy: "TLS 1.2",
            endpointType: "edge",
        },
        cdk: {
            restApi: {
                restApiName: `cdd-siri-sx-api-${stack.stage}`,
                description: "API to retrieve Siri SX XML data and includes statistics about this data",
                deployOptions: {
                    cachingEnabled: !isUserEnv(stack.stage),
                    cacheTtl: Duration.seconds(60),
                },
            },
        },
        defaults: {
            function: {
                timeout: 20,
                runtime: "nodejs22.x",
                bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostROSecret, dbPortSecret],
                vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [lambdaSg],
                nodejs: {
                    install: ["pg", "kysely"],
                },
            },
        },
        routes: {
            "GET    /organisations": {
                function: {
                    handler: "packages/organisations-api/get-organisations/index.main",
                    permissions: [
                        new PolicyStatement({
                            resources: [organisationsTable.tableArn],
                            actions: ["dynamodb:Scan"],
                        }),
                    ],
                    environment: {
                        ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
                    },
                },
                cdk: { method: { apiKeyRequired: true } },
            },
            "GET    /organisations/{id}": {
                function: {
                    handler: "packages/organisations-api/get-organisation/index.main",
                    permissions: [
                        new PolicyStatement({
                            resources: [organisationsTable.tableArn],
                            actions: ["dynamodb:Query"],
                        }),
                    ],
                    environment: {
                        ORGANISATIONS_TABLE_NAME: organisationsTable.tableName,
                    },
                },
                cdk: {
                    integration: {
                        cacheKeyParameters: ["method.request.path.id"],
                    },
                    method: {
                        apiKeyRequired: true,
                        requestParameters: {
                            "method.request.path.id": true,
                        },
                    },
                },
            },
            "GET    /organisations/{id}/disruptions": {
                function: {
                    handler: "packages/organisations-api/get-organisation-disruptions/index.main",
                    environment: {
                        API_BASE_URL: apiUrl,
                    },
                },
                cdk: {
                    integration: {
                        cacheKeyParameters: ["method.request.path.id"],
                    },
                    method: {
                        apiKeyRequired: true,
                        requestParameters: {
                            "method.request.path.id": true,
                        },
                    },
                },
            },
            "GET    /organisations/{id}/disruptions/{disruptionId}": {
                function: {
                    handler: "packages/organisations-api/get-organisation-disruption/index.main",
                    environment: {
                        API_BASE_URL: apiUrl,
                    },
                },
                cdk: {
                    integration: {
                        cacheKeyParameters: ["method.request.path.id", "method.request.path.disruptionId"],
                    },
                    method: {
                        apiKeyRequired: true,
                        requestParameters: {
                            "method.request.path.id": true,
                            "method.request.path.disruptionId": true,
                        },
                    },
                },
            },
        },
    });

    const siriResource = apiGateway.cdk.restApi.root.addResource("siri-sx");
    const disruptionsResource = apiGateway.cdk.restApi.root.addResource("disruptions");
    const dataCatalogueResource = apiGateway.cdk.restApi.root.addResource("data-catalogue");

    const getSiriRole = new Role(stack, "cdd-siri-sx-api-gateway-s3-integration-role", {
        assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
        roleName: `cdd-siri-sx-api-gateway-s3-integration-role-${stack.stage}`,
    });

    getSiriRole.addToPolicy(
        new PolicyStatement({
            resources: [`${siriSXBucket.bucketArn}/*`],
            actions: ["s3:GetObject"],
        }),
    );

    const getDisruptionsRole = new Role(stack, "cdd-disruptions-api-gateway-s3-integration-role", {
        assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
        roleName: `cdd-disruptions-api-gateway-s3-integration-role-${stack.stage}`,
    });

    getDisruptionsRole.addToPolicy(
        new PolicyStatement({
            resources: [`${disruptionsJsonBucket.bucketArn}/*`],
            actions: ["s3:GetObject"],
        }),
    );

    const getDataCatalogueRole = new Role(stack, "cdd-data-catalogue-api-gateway-s3-integration-role", {
        assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
        roleName: `cdd-data-catalogue-api-gateway-s3-integration-role-${stack.stage}`,
    });

    getDataCatalogueRole.addToPolicy(
        new PolicyStatement({
            resources: [`${disruptionsCsvBucket.bucketArn}/*`],
            actions: ["s3:GetObject"],
        }),
    );

    const siriS3Integration = new AwsIntegration({
        service: "s3",
        region: "eu-west-2",
        integrationHttpMethod: "GET",
        path: `${siriSXBucket.bucketName}/SIRI-SX.xml`,
        options: {
            credentialsRole: getSiriRole,
            passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
            integrationResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        "method.response.header.Content-Type": "integration.response.header.Content-Type",
                    },
                },
            ],
        },
    });

    const disruptionsS3Integration = new AwsIntegration({
        service: "s3",
        region: "eu-west-2",
        integrationHttpMethod: "GET",
        path: `${disruptionsJsonBucket.bucketName}/disruptions.json`,
        options: {
            credentialsRole: getDisruptionsRole,
            passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
            integrationResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        "method.response.header.Content-Type": "integration.response.header.Content-Type",
                    },
                },
            ],
        },
    });

    const dataCatalogueS3Integration = new AwsIntegration({
        service: "s3",
        region: "eu-west-2",
        integrationHttpMethod: "GET",
        path: `${disruptionsCsvBucket.bucketName}/disruptions.csv`,
        options: {
            credentialsRole: getDataCatalogueRole,
            passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
            integrationResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        "method.response.header.Content-Type": "integration.response.header.Content-Type",
                    },
                },
            ],
        },
    });

    const s3ObjectMethod: MethodOptions = {
        // Protected by API Key
        authorizationType: AuthorizationType.NONE,
        // Require the API Key on all requests
        apiKeyRequired: true,

        methodResponses: [
            {
                statusCode: "200",
                responseParameters: {
                    "method.response.header.Content-Type": true,
                },
            },
        ],
    };

    siriResource.addMethod("GET", siriS3Integration, s3ObjectMethod);
    disruptionsResource.addMethod("GET", disruptionsS3Integration, s3ObjectMethod);
    dataCatalogueResource.addMethod("GET", dataCatalogueS3Integration, s3ObjectMethod);

    const plan = apiGateway.cdk.restApi.addUsagePlan("UsagePlan", {
        throttle: {
            rateLimit: 50,
            burstLimit: 10,
        },
        apiStages: [{ api: apiGateway.cdk.restApi, stage: apiGateway.cdk.restApi.deploymentStage }],
    });

    const key = apiGateway.cdk.restApi.addApiKey("ApiKey");
    const bodsApiKey = apiGateway.cdk.restApi.addApiKey("cdd-siri-sx-api-key-bods", {
        apiKeyName: `cdd-siri-sx-api-key-bods-${stack.stage}`,
    });

    plan.addApiKey(key);
    plan.addApiKey(bodsApiKey);
};
