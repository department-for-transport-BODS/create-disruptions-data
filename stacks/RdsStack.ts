import { Duration, Tags } from "aws-cdk-lib";
import { BackupPlan, BackupPlanRule, BackupResource, BackupVault } from "aws-cdk-lib/aws-backup";
import { BastionHostLinux, BlockDeviceVolume, ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Schedule } from "aws-cdk-lib/aws-events";
import { PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import { CnameRecord } from "aws-cdk-lib/aws-route53";
import { Config, Function, Stack, StackContext, use } from "sst/constructs";
import { DnsStack } from "./DnsStack";
import { VpcStack } from "./VpcStack";
import { isUserEnv } from "./utils";

const BACKUP_RETENTION_DAYS = Duration.days(35);

const createRdsProxy = (stack: Stack, cluster: rds.CfnDBCluster, vpc: IVpc, dbSg: ISecurityGroup) => {
    let proxy: rds.CfnDBProxy | null = null;
    let proxyReadEndpoint: rds.CfnDBProxyEndpoint | null = null;

    if (stack.stage !== "prod" || !cluster.attrMasterUserSecretSecretArn || !cluster.dbClusterIdentifier) {
        return {
            proxy: null,
            proxyReadEndpoint: null,
        };
    }

    const rdsProxyRole = new Role(stack, "cdd-rds-proxy-role", {
        assumedBy: new ServicePrincipal("rds.amazonaws.com"),
        inlinePolicies: {
            secretManagerAccess: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: ["secretsmanager:GetSecretValue"],
                        resources: [cluster.attrMasterUserSecretSecretArn],
                    }),
                ],
            }),
        },
    });

    proxy = new rds.CfnDBProxy(stack, "cdd-rds-db-proxy", {
        dbProxyName: `cdd-rds-db-proxy-${stack.stage}`,
        engineFamily: "POSTGRESQL",
        auth: [
            {
                authScheme: "SECRETS",
                clientPasswordAuthType: "POSTGRES_SCRAM_SHA_256",
                secretArn: cluster.attrMasterUserSecretSecretArn,
            },
        ],
        vpcSubnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
        roleArn: rdsProxyRole.roleArn,
        vpcSecurityGroupIds: [dbSg.securityGroupId],
    });

    proxy.node.addDependency(rdsProxyRole);

    const tg = new rds.CfnDBProxyTargetGroup(stack, "cdd-rds-proxy-target-group", {
        dbProxyName: proxy?.dbProxyName ?? "",
        targetGroupName: "default",
        dbClusterIdentifiers: [cluster.dbClusterIdentifier],
    });

    tg.node.addDependency(proxy);

    proxyReadEndpoint = new rds.CfnDBProxyEndpoint(stack, "cdd-rds-db-proxy-read-endpoint", {
        dbProxyEndpointName: `cddrdsproxyreadendpoint${stack.stage}`,
        dbProxyName: proxy.dbProxyName,
        vpcSubnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
        vpcSecurityGroupIds: [dbSg.securityGroupId],
        targetRole: "READ_ONLY",
    });

    proxyReadEndpoint.node.addDependency(proxy);

    return { proxy, proxyReadEndpoint };
};

export const RdsStack = ({ stack }: StackContext) => {
    const { vpc, dbSg, bastionSg, lambdaSg } = use(VpcStack);
    const { privateHostedZone } = use(DnsStack);

    const dbUsernameSecret = new Config.Secret(stack, "DB_USERNAME");
    const dbPasswordSecret = new Config.Secret(stack, "DB_PASSWORD");
    const dbHostSecret = new Config.Secret(stack, "DB_HOST");
    const dbHostROSecret = new Config.Secret(stack, "DB_RO_HOST");
    const dbPortSecret = new Config.Secret(stack, "DB_PORT");
    const dbNameSecret = new Config.Secret(stack, "DB_NAME");

    if (isUserEnv(stack.stage)) {
        new Function(stack, "cdd-local-database-creator-function", {
            bind: [dbUsernameSecret, dbPasswordSecret, dbHostSecret, dbPortSecret, dbNameSecret],
            functionName: `cdd-local-database-creator-${stack.stage}`,
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [lambdaSg],
            handler: "packages/local-db-creator/index.main",
            timeout: 300,
            memorySize: 512,
            runtime: "nodejs22.x",
            architecture: "arm_64",
            enableLiveDev: false,
            nodejs: {
                install: ["pg", "kysely"],
            },
        });

        return {
            dbUsernameSecret,
            dbPasswordSecret,
            dbHostSecret,
            dbPortSecret,
            dbNameSecret,
            dbHostROSecret,
        };
    }

    new Function(stack, "cdd-kysely-db-migrator-migrate-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbHostSecret, dbPortSecret, dbNameSecret],
        functionName: `cdd-kysely-db-migrator-migrate-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/db-migrator/index.main",
        timeout: 300,
        memorySize: 512,
        runtime: "nodejs22.x",
        enableLiveDev: false,
        nodejs: {
            install: ["pg", "kysely"],
        },
        copyFiles: [
            {
                from: "./shared-ts/db/migrations",
                to: "./packages/db-migrator/migrations",
            },
        ],
    });

    new Function(stack, "cdd-kysely-db-migrator-rollback-function", {
        bind: [dbUsernameSecret, dbPasswordSecret, dbHostSecret, dbPortSecret, dbNameSecret],
        functionName: `cdd-kysely-db-migrator-rollback-${stack.stage}`,
        vpc,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [lambdaSg],
        handler: "packages/db-migrator/index.main",
        timeout: 300,
        memorySize: 512,
        runtime: "nodejs22.x",
        enableLiveDev: false,
        nodejs: {
            install: ["pg", "kysely"],
        },
        environment: {
            ROLLBACK: "true",
        },
        copyFiles: [
            {
                from: "./shared-ts/db/migrations",
                to: "./packages/db-migrator/migrations",
            },
        ],
    });

    const cluster = new rds.DatabaseCluster(stack, "cdd-rds-db-cluster", {
        clusterIdentifier: `cdd-rds-db-cluster-${stack.stage}`,
        engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_4 }),
        writer: rds.ClusterInstance.serverlessV2("cdd-rds-instance-1", {
            enablePerformanceInsights: true,
        }),
        readers:
            stack.stage === "prod"
                ? [
                      rds.ClusterInstance.serverlessV2("cdd-rds-instance-2", {
                          enablePerformanceInsights: true,
                      }),
                  ]
                : [],
        serverlessV2MinCapacity: stack.stage === "prod" ? 1 : 0.5,
        serverlessV2MaxCapacity: stack.stage === "prod" ? 24 : 12,
        vpcSubnets: {
            subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [dbSg],
        vpc,
        defaultDatabaseName: "disruptions",
        ...(stack.stage === "prod"
            ? {
                  backup: {
                      retention: BACKUP_RETENTION_DAYS,
                  },
              }
            : {}),
    });

    const cfnCluster = cluster.node.defaultChild as rds.CfnDBCluster;

    cfnCluster.masterUserPassword = undefined;
    cfnCluster.manageMasterUserPassword = true;

    const proxyDetails = createRdsProxy(stack, cfnCluster, vpc, dbSg);

    new CnameRecord(stack, "cdd-rds-internal-domain", {
        recordName: `db.${privateHostedZone.zoneName}`,
        zone: privateHostedZone,
        domainName: proxyDetails.proxy ? proxyDetails.proxy.attrEndpoint : cluster.clusterEndpoint.hostname,
    });

    new CnameRecord(stack, "cdd-rds-read-internal-domain", {
        recordName: `db-ro.${privateHostedZone.zoneName}`,
        zone: privateHostedZone,
        domainName: proxyDetails.proxyReadEndpoint
            ? proxyDetails.proxyReadEndpoint.attrEndpoint
            : cluster.clusterReadEndpoint.hostname,
    });

    const bastionHost = new BastionHostLinux(stack, "cdd-rds-bastion-host", {
        vpc,
        blockDevices: [
            {
                deviceName: "/dev/sdh",
                volume: BlockDeviceVolume.ebs(10, {
                    encrypted: true,
                }),
            },
        ],
        instanceName: `cdd-rds-bastion-host-${stack.stage}`,
        subnetSelection: {
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroup: bastionSg,
    });

    Tags.of(bastionHost.instance).add("Bastion", "true");

    if (stack.stage === "prod") {
        const backupVault = new BackupVault(stack, "cdd-rds-backup-vault", {
            backupVaultName: `cdd-rds-backup-vault-${stack.stage}`,
        });

        const backupPlan = new BackupPlan(stack, "cdd-rds-backup-plan", {
            backupPlanName: `cdd-rds-backup-plan-${stack.stage}`,
            backupPlanRules: [
                BackupPlanRule.daily(backupVault),
                BackupPlanRule.monthly5Year(backupVault),
                new BackupPlanRule({
                    backupVault,
                    ruleName: "Continuous",
                    scheduleExpression: Schedule.cron({
                        minute: "0",
                    }),
                    enableContinuousBackup: true,
                    deleteAfter: BACKUP_RETENTION_DAYS,
                }),
            ],
        });

        backupPlan.addSelection("cdd-rds-backup-selection", {
            resources: [BackupResource.fromArn(cluster.clusterArn)],
        });
    }

    return {
        dbUsernameSecret,
        dbPasswordSecret,
        dbHostSecret,
        dbPortSecret,
        dbNameSecret,
        dbHostROSecret,
    };
};
