import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";

import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { AdminAreas, getAdminAreas } from "../utils/db";
import { executeClientWithoutInput } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClientWithoutInput(event, getAdminAreas, sortAdminAreas);
};
export const sortAdminAreas = async (adminAreas: AdminAreas) =>
    adminAreas.sort((a, b) => (a.administrativeAreaCode ?? "").localeCompare(b.administrativeAreaCode ?? ""));
