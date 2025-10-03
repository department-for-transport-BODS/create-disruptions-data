import { Datasource, ReferenceDataVehicleMode } from "@create-disruptions-data/shared-ts/enums";
import { withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import { ClientError } from "../error";
import { isValidMode } from "../utils";
import { OperatorQueryInput, getOperators } from "../utils/db";
import { executeClient } from "../utils/execute-client";

const MAX_NOC_CODES = process.env.MAX_NOC_CODES || "5";
const MAX_ADMIN_AREA_CODES = process.env.MAX_ADMIN_AREA_CODES || "5";

export const main: Handler = async (event: APIGatewayEvent, context): Promise<APIGatewayProxyResultV2> => {
    withLambdaRequestTracker(event, context);
    return executeClient(event, getQueryInput, getOperators);
};

export const getQueryInput = (event: APIGatewayEvent): OperatorQueryInput => {
    const { pathParameters, queryStringParameters } = event;

    const nocCode = pathParameters?.nocCode;

    if (nocCode) {
        return {
            nocCode,
        };
    }

    const batchNocCodes = queryStringParameters?.nocCodes ?? "";
    const batchNocCodesArray = batchNocCodes
        .split(",")
        .filter((nocCode) => nocCode)
        .map((nocCode) => nocCode.trim());

    if (batchNocCodesArray.length > Number(MAX_NOC_CODES)) {
        throw new ClientError(`Only up to ${MAX_NOC_CODES} NOC codes can be provided`);
    }

    const adminAreaCodes = queryStringParameters?.adminAreaCodes ?? "";
    const adminAreaCodeArray = adminAreaCodes
        .split(",")
        .filter((adminAreaCode) => adminAreaCode)
        .map((adminAreaCode) => adminAreaCode.trim());

    if (adminAreaCodeArray.length > Number(MAX_ADMIN_AREA_CODES)) {
        throw new ClientError(`Only up to ${MAX_ADMIN_AREA_CODES} administrative area codes can be provided`);
    }

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

    const page = Number(queryStringParameters?.page ?? "1");

    if (Number.isNaN(page)) {
        throw new ClientError("Provided page is not valid");
    }

    const dataSourceInput = queryStringParameters?.dataSource;

    return {
        ...(batchNocCodesArray && batchNocCodesArray.length > 0 ? { batchNocCodes: batchNocCodesArray } : {}),
        ...(adminAreaCodeArray && adminAreaCodeArray.length > 0 ? { adminAreaCodes: adminAreaCodeArray } : {}),
        ...(filteredModesArray && filteredModesArray.length > 0 ? { modes: filteredModesArray } : {}),
        ...(dataSourceInput ? { dataSource: dataSourceInput as Datasource } : {}),
        page: page - 1,
    };
};
