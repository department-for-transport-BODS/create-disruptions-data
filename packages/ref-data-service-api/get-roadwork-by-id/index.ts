import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { ClientError } from "../error";
import { RoadworkByIdQueryInput, getRoadworkById } from "../utils/db";
import { executeClient } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getRoadworkById);
};

export const getQueryInput = (event: APIGatewayEvent): RoadworkByIdQueryInput => {
    const { pathParameters } = event;

    const permitReferenceNumber = pathParameters?.permitReferenceNumber ?? "";

    if (!permitReferenceNumber) {
        throw new ClientError("permitReferenceNumber is required to get a roadwork by Id");
    }

    return {
        permitReferenceNumber: permitReferenceNumber,
    };
};
