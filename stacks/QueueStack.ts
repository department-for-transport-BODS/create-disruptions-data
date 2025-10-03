import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { Queue, StackContext, use } from "sst/constructs";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";

export function QueueStack({ stack }: StackContext) {
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret } = use(RdsStack);
    const { vpc, lambdaSg } = use(VpcStack);

    const streetManagerSqsQueue = new Queue(stack, "ref-data-service-street-manager-queue", {
        consumer: {
            function: {
                bind: [dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret],
                handler: "packages/street-manager-uploader/index.main",
                timeout: 10,
                runtime: "nodejs22.x",
                logRetention: stack.stage === "prod" ? "one_month" : "two_weeks",
                vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [lambdaSg],
                nodejs: {
                    install: ["pg", "kysely"],
                },
            },
            cdk: {
                eventSource: {
                    batchSize: 1,
                },
            },
        },
        cdk: {
            queue: {
                fifo: true,
                contentBasedDeduplication: true,
            },
        },
    });

    return { streetManagerSqsQueue };
}
