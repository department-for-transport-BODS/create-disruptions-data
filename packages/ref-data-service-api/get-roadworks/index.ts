import { permitStatus } from "@create-disruptions-data/shared-ts/roadwork.zod";
import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { ClientError } from "../error";
import { RoadworksQueryInput, getRoadworks } from "../utils/db";
import { executeClient } from "../utils/execute-client";

const MAX_ADMIN_AREA_CODES = process.env.MAX_ADMIN_AREA_CODES || "5";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getRoadworks);
};

export const getQueryInput = (event: APIGatewayEvent): RoadworksQueryInput => {
    const { queryStringParameters } = event;

    const adminAreaCodes = queryStringParameters?.adminAreaCodes ?? "";
    const adminAreaCodeArray = adminAreaCodes
        .split(",")
        .filter((adminAreaCode) => adminAreaCode)
        .map((adminAreaCode) => adminAreaCode.trim());

    if (adminAreaCodeArray.length > Number(MAX_ADMIN_AREA_CODES)) {
        throw new ClientError(`Only up to ${MAX_ADMIN_AREA_CODES} administrative area codes can be provided`);
    }

    const page = Number(queryStringParameters?.page ?? "1");

    if (Number.isNaN(page)) {
        throw new ClientError("Provided page is not valid");
    }

    const parsedPermitStatus = permitStatus.safeParse(queryStringParameters?.permitStatus ?? "");

    const lastUpdatedTimeDelta = Number(queryStringParameters?.lastUpdatedTimeDelta) ?? null;

    const createdTimeDelta = Number(queryStringParameters?.createdTimeDelta) ?? null;

    return {
        ...(adminAreaCodes ? { adminAreaCodes: adminAreaCodeArray } : {}),
        ...(parsedPermitStatus.success ? { permitStatus: parsedPermitStatus.data } : {}),
        ...(lastUpdatedTimeDelta ? { lastUpdatedTimeDelta: lastUpdatedTimeDelta } : {}),
        ...(createdTimeDelta ? { createdTimeDelta: createdTimeDelta } : {}),
        page: page - 1,
    };
};
