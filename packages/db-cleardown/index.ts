import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import {
    errorMapWithDataLogging,
    logger,
    withLambdaRequestTracker,
} from "@create-disruptions-data/shared-ts/utils/logger";
import { Handler } from "aws-lambda";
import { sql } from "kysely";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const dbClient = getDbClient(false);

const cleardownDatabase = async () => {
    const tables: (keyof Database)[] = [
        "localities",
        "nptgAdminAreas",
        "operatorLines",
        "operatorPublicData",
        "operators",
        "serviceAdminAreaCodes",
        "serviceJourneyPatternLinks",
        "serviceJourneyPatterns",
        "services",
        "stops",
        "tracks",
        "vehicleJourneys",
    ];

    for (const table of tables) {
        await dbClient.schema.dropTable(`${table}New`).ifExists().execute();

        await sql`CREATE TABLE ${sql.table(`${table}New`)} (LIKE ${sql.table(table)} INCLUDING ALL)`.execute(dbClient);
    }
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    logger.info("Starting DB Cleardown");

    try {
        logger.info("Preparing database...");

        await cleardownDatabase();

        logger.info("Database preparation complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "Error running the TXC Retriever");
        }

        throw e;
    }
};
