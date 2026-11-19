import {
    AdminAddUserToGroupCommand,
    AdminCreateUserCommand,
    ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { UserGroups } from "@create-disruptions-data/shared-ts/enums";
import { program } from "commander";
import * as logger from "lambda-log";
import { z } from "zod";
import { generatePassword, listOperatorsForOrg, orgsSchema, withUserPrompt, withUserPrompts } from "../utils";
import { createCognitoClient, createDynamoDbDocClient } from "../utils/awsClients";

program
    .option("--stage <stage>", "SST stage to use")
    .option("--orgId <orgId>", "ID for organisation that user belongs to")
    .option("--group <group>", "Cognito group to add user to")
    .option("--operatorOrgId <operatorOrgId>", "Enter the operatorOrgId for the operator user")
    .option("--email <email>", "Email for user")
    .option("--firstName <firstName>", "First name of user")
    .option("--lastName <lastName>", "Last name of user")
    .option("--poolId <poolId>", "ID of user pool to add user to")
    .action(async (options) => {
        let { orgId, group, operatorOrgId, poolId } = program.opts();

        const cognitoClient = createCognitoClient();
        const dynamoClient = createDynamoDbDocClient();

        const { stage, email, firstName, lastName } = await withUserPrompts(options, {
            stage: { type: "input" },
            email: { type: "input" },
            firstName: { type: "input" },
            lastName: { type: "input" },
        });

        if (!poolId) {
            const userPoolsResult = await cognitoClient.send(
                new ListUserPoolsCommand({
                    MaxResults: 10,
                }),
            );

            const userPools = userPoolsResult.UserPools?.filter((pool) => pool.Name?.includes(stage)) ?? [];

            const chosenUserPool = await withUserPrompt("poolId", {
                type: "list",
                choices: userPools.map((pool) => pool.Name ?? ""),
            });

            poolId = userPools.find((pool) => pool.Name === chosenUserPool)?.Id;
        }

        if (!orgId) {
            const organisationsInDynamo = await dynamoClient.send(
                new ScanCommand({
                    TableName: `cdd-organisations-v2-table-${stage}`,
                    FilterExpression: "SK = :info",
                    ExpressionAttributeValues: {
                        ":info": "INFO",
                    },
                }),
            );

            const orgs = z.array(orgsSchema).parse(organisationsInDynamo.Items);

            const chosenOrg = await withUserPrompt("orgId", {
                type: "list",
                choices: orgs.map((org) => org.name ?? ""),
            });

            orgId = orgs.find((org) => org.name === chosenOrg)?.PK;
        }

        if (!group) {
            group = await withUserPrompt("group", { type: "list", choices: Object.values(UserGroups) });
        }

        if (group && group === UserGroups.operators && orgId && !operatorOrgId) {
            const operators = await listOperatorsForOrg(orgId, stage, logger);

            const chosenOperator = await withUserPrompt("operatorOrgId", {
                type: "list",
                choices: operators.map((operator) => operator.name),
            });

            operatorOrgId = operators.find((operator) => operator.name === chosenOperator)?.operatorOrgId;
        }

        const key = generatePassword(20);

        const createUserResult = await cognitoClient.send(
            new AdminCreateUserCommand({
                Username: email,
                UserPoolId: poolId,
                TemporaryPassword: key,
                UserAttributes: [
                    {
                        Name: "custom:orgId",
                        Value: orgId,
                    },
                    {
                        Name: "given_name",
                        Value: firstName,
                    },
                    {
                        Name: "family_name",
                        Value: lastName,
                    },
                    {
                        Name: "email_verified",
                        Value: "true",
                    },
                    {
                        Name: "email",
                        Value: email,
                    },
                    ...(operatorOrgId
                        ? [
                              {
                                  Name: "custom:operatorOrgId",
                                  Value: operatorOrgId,
                              },
                          ]
                        : []),
                ],
            }),
        );

        await cognitoClient.send(
            new AdminAddUserToGroupCommand({
                GroupName: group,
                Username: createUserResult.User?.Username,
                UserPoolId: poolId,
            }),
        );

        logger.info(`User created, ID: ${createUserResult.User?.Username}`);

        const url =
            stage === "prod" ? "https://disruption-data.dft.gov.uk" : `https://${stage}.cdd.dft-create-data.com`;

        logger.info(
            `Registration Link: ${url}/register?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&orgId=${encodeURIComponent(orgId)}`,
        );
    });

program.parseAsync(process.argv);
