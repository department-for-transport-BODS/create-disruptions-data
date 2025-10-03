import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";

import { Datasource } from "@create-disruptions-data/shared-ts/enums";

import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { ClientError } from "../error";
import { isDataSource } from "../utils";
import { ServiceByIdQueryInput, getServiceById } from "../utils/db";
import { executeClient } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getServiceById);
};

export const getQueryInput = (event: APIGatewayEvent): ServiceByIdQueryInput => {
    const { pathParameters, queryStringParameters } = event;

    const nocCode = pathParameters?.nocCode ?? "";

    if (!nocCode) {
        throw new ClientError("NOC must be provided");
    }

    const serviceRef = pathParameters?.serviceId;

    if (!serviceRef) {
        throw new ClientError("Service ref must be provided");
    }

    const dataSourceInput = queryStringParameters?.dataSource;

    return {
        nocCode,
        serviceRef: serviceRef,
        dataSource: dataSourceInput && isDataSource(dataSourceInput) ? dataSourceInput : Datasource.bods,
    };
};
