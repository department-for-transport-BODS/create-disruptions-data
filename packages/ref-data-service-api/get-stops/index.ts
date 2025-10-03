import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { ClientError } from "../error";
import { getPolygon } from "../utils";
import { StopsQueryInput, getStops } from "../utils/db";
import { executeClient } from "../utils/execute-client";

const MAX_ATCO_CODES = process.env.MAX_ATCO_CODES || "5";
const MAX_NAPTAN_CODES = process.env.MAX_NAPTAN_CODES || "5";
const MAX_ADMIN_AREA_CODES = process.env.MAX_ADMIN_AREA_CODES || "5";
const MAX_POLYGON_AREA_IN_KM2 = process.env.MAX_POLYGON_AREA_IN_KM2 ? Number(process.env.MAX_POLYGON_AREA_IN_KM2) : 36;

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getStops);
};

export const getQueryInput = (event: APIGatewayEvent): StopsQueryInput => {
    const { queryStringParameters } = event;

    const adminAreaCodes = queryStringParameters?.adminAreaCodes ?? "";
    const adminAreaCodeArray = adminAreaCodes
        .split(",")
        .filter((adminAreaCode) => adminAreaCode)
        .map((adminAreaCode) => adminAreaCode.trim());

    if (adminAreaCodeArray.length > Number(MAX_ADMIN_AREA_CODES)) {
        throw new ClientError(`Only up to ${MAX_ADMIN_AREA_CODES} administrative area codes can be provided`);
    }

    const atcoCodes = queryStringParameters?.atcoCodes ?? "";
    const atcoCodesArray = atcoCodes
        .split(",")
        .filter((atcoCode) => atcoCode)
        .map((atcoCode) => atcoCode.trim());

    if (atcoCodesArray.length > Number(MAX_ATCO_CODES)) {
        throw new ClientError(`Only up to ${MAX_ATCO_CODES} ATCO codes can be provided`);
    }

    const naptanCodes = queryStringParameters?.naptanCodes ?? "";
    const naptanCodesArray = naptanCodes
        .split(",")
        .filter((naptanCode) => naptanCode)
        .map((naptanCode) => naptanCode.trim());

    if (naptanCodesArray.length > Number(MAX_NAPTAN_CODES)) {
        throw new ClientError(`Only up to ${MAX_NAPTAN_CODES} NaPTAN codes can be provided`);
    }

    const searchInput = queryStringParameters?.search ?? "";

    const page = Number(queryStringParameters?.page ?? "1");

    if (Number.isNaN(page)) {
        throw new ClientError("Provided page is not valid");
    }

    const polygon = queryStringParameters?.polygon;

    if (polygon && adminAreaCodeArray.length === 0) {
        throw new ClientError("Admin area codes must be provided when providing a polygon");
    }

    let sqlPolygon = "";

    if (polygon) {
        sqlPolygon = getPolygon(polygon, MAX_POLYGON_AREA_IN_KM2);
    }

    const stopTypes = queryStringParameters?.stopTypes || "";
    const stopTypesArray = stopTypes
        .split(",")
        .filter((stop) => stop)
        .map((stop) => stop.trim());

    return {
        ...(atcoCodes ? { atcoCodes: atcoCodesArray } : {}),
        ...(naptanCodes ? { naptanCodes: naptanCodesArray } : {}),
        ...(searchInput ? { searchInput } : {}),
        ...(adminAreaCodes ? { adminAreaCodes: adminAreaCodeArray } : {}),
        ...(sqlPolygon ? { polygon: sqlPolygon } : {}),
        ...(stopTypesArray && stopTypesArray.length > 0 ? { stopTypes: stopTypesArray } : {}),
        page: page - 1,
    };
};
