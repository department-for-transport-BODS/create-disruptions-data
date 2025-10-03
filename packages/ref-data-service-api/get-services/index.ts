import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { Datasource, ReferenceDataVehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { Kysely } from "kysely";
import { z } from "zod";
import { ClientError } from "../error";
import { formatStopsRoutes } from "../get-service-routes";
import { isDataSource, isValidMode } from "../utils";
import { Optional, notEmpty } from "../utils";
import {
    ServiceStops,
    ServicesByStops,
    ServicesByStopsQueryInput,
    ServicesQueryInput,
    getServiceStops,
    getServices,
    getServicesByStops,
} from "../utils/db";
import { executeClient } from "../utils/execute-client";

const MAX_ADMIN_AREA_CODES = process.env.MAX_ADMIN_AREA_CODES || "5";
const MAX_ATCO_CODES = process.env.MAX_ATCO_CODES || "5";
const MAX_NOC_CODES = process.env.MAX_NOC_CODES || "5";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);

    if (event.queryStringParameters?.atcoCodes) {
        return executeClient(event, getServicesByStopsQueryInput, getServicesByStops, formatServicesWithStops);
    }
    return executeClient(event, getQueryInput, getServices);
};

export const getQueryInput = (event: APIGatewayEvent): ServicesQueryInput => {
    const { queryStringParameters } = event;

    const modes = queryStringParameters?.modes ?? "";
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

    const dataSourceInput = queryStringParameters?.dataSource ?? Datasource.bods;

    if (!isDataSource(dataSourceInput)) {
        throw new ClientError("Provided dataSource must be tnds or bods");
    }

    const adminAreaCodes = queryStringParameters?.adminAreaCodes ?? "";
    const adminAreaCodeArray = adminAreaCodes
        .split(",")
        .filter((adminAreaCode) => adminAreaCode)
        .map((adminAreaCode) => adminAreaCode.trim());

    if (adminAreaCodeArray.length > Number(MAX_ADMIN_AREA_CODES)) {
        throw new ClientError(`Only up to ${MAX_ADMIN_AREA_CODES} administrative area codes can be provided`);
    }

    const nocCodes = queryStringParameters?.nocCodes ?? "";
    const nocCodesArray = nocCodes
        .split(",")
        .filter((nocCode) => nocCode)
        .map((nocCode) => nocCode);

    if (nocCodesArray.length > Number(MAX_NOC_CODES)) {
        throw new ClientError(`Only up to ${MAX_NOC_CODES} NOC codes can be provided`);
    }

    const page = Number(queryStringParameters?.page ?? "1");

    if (Number.isNaN(page)) {
        throw new ClientError("Provided page is not valid");
    }

    return {
        dataSource: dataSourceInput,
        page: page - 1,
        ...(adminAreaCodes && adminAreaCodeArray.length > 0 ? { adminAreaCodes: adminAreaCodeArray } : {}),
        ...(filteredModesArray && filteredModesArray.length > 0 ? { modes: filteredModesArray } : {}),
        ...(nocCodesArray && nocCodesArray.length > 0 ? { nocCodes: nocCodesArray } : {}),
    };
};

export const getServicesByStopsQueryInput = (event: APIGatewayEvent): ServicesByStopsQueryInput => {
    const { queryStringParameters } = event;

    const inputs = getQueryInput(event);

    const atcoCodes = queryStringParameters?.atcoCodes ?? "";

    const atcoCodesArray = atcoCodes
        .split(",")
        .filter((atcoCode) => atcoCode)
        .map((atcoCode) => atcoCode.trim());

    if (atcoCodesArray.length > Number(MAX_ATCO_CODES)) {
        throw new ClientError(`Only up to ${MAX_ATCO_CODES} ATCO codes can be provided`);
    }

    const includeRoutes = queryStringParameters?.includeRoutes === "true";

    return {
        ...inputs,
        includeRoutes,
        stops: atcoCodesArray,
    };
};

type FilteredServiceAndStops = Omit<ServicesByStops[0], "toAtcoCode" | "fromAtcoCode"> & {
    stops: string[];
};

export const formatServicesWithStops = async (
    servicesWithStops: ServicesByStops,
    input?: ServicesByStopsQueryInput,
    dbClient?: Kysely<Database>,
) => {
    if (input && dbClient) {
        const servicesWithGroupedStops: FilteredServiceAndStops[] = servicesWithStops.map(
            (service: Optional<ServicesByStops[0], "toAtcoCode" | "fromAtcoCode">) => {
                const stops = [...new Set([service.fromAtcoCode, service.toAtcoCode])].filter(
                    (stop) => stop && input.stops.includes(stop),
                );

                const { fromAtcoCode, toAtcoCode, ...cleanService } = service;

                return {
                    ...cleanService,
                    stops: stops.filter(notEmpty),
                };
            },
        );

        const groupedServices = servicesWithGroupedStops.reduce<FilteredServiceAndStops[]>((p, c) => {
            const existingService = p.find((a) => a.id === c.id);

            if (existingService) {
                existingService.stops = [...new Set(existingService.stops.concat(c.stops))];
            } else {
                p.push(c);
            }

            return p;
        }, []);

        if (!input.includeRoutes) {
            return groupedServices;
        }

        const serviceRoutePromises = groupedServices.map(
            (service) =>
                getServiceStops(dbClient, {
                    serviceRef: input.dataSource === Datasource.bods ? service.lineId || "" : service.serviceCode || "",
                    dataSource: input.dataSource,
                }) as Promise<ServiceStops>,
        );

        const serviceRoutes = await Promise.all(serviceRoutePromises);

        const pointSchema = z.object({
            longitude: z.coerce.number().optional(),
            latitude: z.coerce.number().optional(),
        });
        const routeSchema = z.object({ outbound: z.array(pointSchema), inbound: z.array(pointSchema) });

        const groupedServicesWithRoutes = await Promise.all(
            groupedServices.map(async (service) => ({
                ...service,
                routes: routeSchema.parse(
                    await formatStopsRoutes(serviceRoutes.find((route) => route[0].serviceId === service.id) || []),
                ),
            })),
        );

        return groupedServicesWithRoutes;
    }
};
