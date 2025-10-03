import { SubnetType } from "aws-cdk-lib/aws-ec2";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function, StackContext, use } from "sst/constructs";
import { DynamoDBStack } from "./DynamoDBStack";
import { RdsStack } from "./RdsStack";
import { VpcStack } from "./VpcStack";

export const DynamoMigratorStack = ({ stack }: StackContext) => {
    const { disruptionsTable, templateDisruptionsTable } = use(DynamoDBStack);
    const { dbUsernameSecret, dbPasswordSecret, dbNameSecret, dbHostSecret, dbPortSecret } = use(RdsStack);
    const { vpc, lambdaSg } = use(VpcStack);

    new Function(stack, "cdd-dynamo-disruption-bulk-migrator", {
        functionName: `cdd-dynamo-disruption-bulk-migrator-${stack.stage}`,
        bind: [
            dbUsernameSecret,
            dbPasswordSecret,
            dbNameSecret,
            dbHostSecret,
            dbPortSecret,
            disruptionsTable,
            templateDisruptionsTable,
        ],
        permissions: [
            new PolicyStatement({
                resources: [disruptionsTable.tableArn, templateDisruptionsTable.tableArn],
                actions: ["dynamodb:Scan"],
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
        handler: "packages/dynamo-disruption-migrator/index.bulkMigrator",
        timeout: 900,
        memorySize: 5120,
        runtime: "nodejs22.x",
        environment: {
            DISRUPTIONS_TABLE: disruptionsTable.tableName,
            DISRUPTION_TEMPLATES_TABLE: templateDisruptionsTable.tableName,
        },
    });

    const incrementalMigrator = new Function(stack, "cdd-dynamo-disruption-incremental-migrator", {
        functionName: `cdd-dynamo-disruption-incremental-migrator-${stack.stage}`,
        bind: [
            dbUsernameSecret,
            dbPasswordSecret,
            dbNameSecret,
            dbHostSecret,
            dbPortSecret,
            disruptionsTable,
            templateDisruptionsTable,
        ],
        permissions: [
            new PolicyStatement({
                resources: [disruptionsTable.tableArn, templateDisruptionsTable.tableArn],
                actions: ["dynamodb:Query"],
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
        handler: "packages/dynamo-disruption-migrator/index.incrementalMigrator",
        timeout: 120,
        memorySize: 1024,
        runtime: "nodejs22.x",
    });

    disruptionsTable.addConsumers(stack, {
        migrator: incrementalMigrator,
    });

    templateDisruptionsTable.addConsumers(stack, {
        migrator: incrementalMigrator,
    });
};
