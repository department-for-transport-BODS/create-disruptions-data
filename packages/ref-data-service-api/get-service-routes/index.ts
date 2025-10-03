import { ReferenceDataVehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { ClientError } from "../error";
import { flattenStops } from "../get-service-stops";
import { isDataSource, isServiceStops, isValidMode } from "../utils";
import { ServiceStop, ServiceStops, ServiceStopsQueryInput, ServiceTracks, getServiceStops } from "../utils/db";
import { executeClient } from "../utils/execute-client";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getServiceStops, formatStopsRoutes);
};

export const getQueryInput = (event: APIGatewayEvent): ServiceStopsQueryInput => {
    const { pathParameters, queryStringParameters } = event;

    const serviceRef = pathParameters?.serviceId;

    if (!serviceRef) {
        throw new ClientError("Service Ref must be provided");
    }

    const dataSourceInput = queryStringParameters?.dataSource || "bods";

    if (!isDataSource(dataSourceInput)) {
        throw new ClientError("Invalid datasource provided");
    }

    const modes = queryStringParameters?.modes || "";
    const modesArray = modes
        .split(",")
        .filter((mode) => mode)
        .map((mode) => mode.trim());

    const filteredModesArray = modesArray.filter(isValidMode);

    if (filteredModesArray.length !== modesArray.length) {
        throw new ClientError("Invalid mode provided");
    }

    if (filteredModesArray.includes(ReferenceDataVehicleMode.bus)) {
        filteredModesArray.push(ReferenceDataVehicleMode.blank);
    }

    return {
        serviceRef,
        dataSource: dataSourceInput,
        ...(filteredModesArray && filteredModesArray.length > 0 ? { modes: filteredModesArray } : {}),
        useTracks: true,
    };
};

const filterStops = (flattenedStops: ServiceStop[], direction: string) => {
    const sortedStops = flattenedStops
        // filter stops by direction
        .filter((stop) => stop.direction === direction)
        // remove any duplicates on atcoCode and sequence number
        .filter(
            (stop, index, self) =>
                self.findIndex(
                    (other) => stop.atcoCode === other.atcoCode && stop.sequenceNumber === other.sequenceNumber,
                ) === index,
        )
        // sort stops by sequence number
        .sort((stop, other) => Number(stop.sequenceNumber) - Number(other.sequenceNumber));

    return (
        sortedStops
            // remove duplicate adjacent stops
            .filter((stop, i) => (i > 0 ? stop.atcoCode !== sortedStops[i - 1].atcoCode : true))
    );
};

export const formatStopsRoutes = async (
    stops: ServiceStops | ServiceTracks,
): Promise<{ outbound: ServiceStop[] | ServiceTracks; inbound: ServiceStop[] }> => {
    if (isServiceStops(stops)) {
        const flattenedStops = flattenStops(stops);

        const outbound = filterStops(flattenedStops, "outbound");
        const inbound = filterStops(flattenedStops, "inbound");
        return { outbound, inbound };
    }
    return { outbound: stops, inbound: [] };
};
