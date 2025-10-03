import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";

import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { AdminAreaCodes, getAdminAreaCodes } from "../utils/db";
import { executeClientWithoutInput } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClientWithoutInput(event, getAdminAreaCodes, sortAdminAreaCodes);
};

export const sortAdminAreaCodes = async (areaCodes: AdminAreaCodes) =>
    areaCodes.map((code) => code.administrativeAreaCode).sort();
