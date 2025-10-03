import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";

import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { ClientError } from "../error";
import { isDataSource } from "../utils";
import { ServiceJourneys, ServiceJourneysQueryInput, getServiceJourneys } from "../utils/db";
import { executeClient } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getServiceJourneys, formatJourneys);
};

export const getQueryInput = (event: APIGatewayEvent): ServiceJourneysQueryInput => {
    const { pathParameters, queryStringParameters } = event;

    const serviceRef = pathParameters?.serviceId;

    if (!serviceRef) {
        throw new ClientError("Service Ref must be provided");
    }

    const page = Number(queryStringParameters?.page ?? "1");

    if (Number.isNaN(page)) {
        throw new ClientError("Provided page is not valid");
    }

    const dataSourceInput = queryStringParameters?.dataSource || "bods";

    if (!isDataSource(dataSourceInput)) {
        throw new ClientError("Invalid datasource provided");
    }

    return {
        serviceRef,
        dataSource: dataSourceInput,
        page: page - 1,
    };
};

export const formatJourneys = async (journeys: ServiceJourneys): Promise<ServiceJourneys> => {
    return journeys.filter((journey) => !!journey.departureTime);
};
