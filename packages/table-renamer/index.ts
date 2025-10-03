import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { Handler } from "aws-lambda";
import { Kysely } from "kysely";

export interface TableKey {
    table: keyof Database;
    newTable: keyof Database;
    needsCheck?: boolean;
}

const tables: TableKey[] = [
    { table: "stops", newTable: "stopsNew", needsCheck: true },
    { table: "operatorLines", newTable: "operatorLinesNew", needsCheck: true },
    { table: "operators", newTable: "operatorsNew", needsCheck: true },
    { table: "operatorPublicData", newTable: "operatorPublicDataNew", needsCheck: true },
    { table: "services", newTable: "servicesNew", needsCheck: true },
    { table: "serviceJourneyPatterns", newTable: "serviceJourneyPatternsNew" },
    { table: "serviceJourneyPatternLinks", newTable: "serviceJourneyPatternLinksNew" },
    { table: "serviceAdminAreaCodes", newTable: "serviceAdminAreaCodesNew" },
    { table: "localities", newTable: "localitiesNew", needsCheck: true },
    { table: "vehicleJourneys", newTable: "vehicleJourneysNew" },
    { table: "tracks", newTable: "tracksNew" },
    { table: "nptgAdminAreas", newTable: "nptgAdminAreasNew", needsCheck: true },
];

export const checkTables = async (tables: TableKey[], db: Kysely<Database>): Promise<void> => {
    for (const { newTable } of tables) {
        const [newCount] = await db.selectFrom(newTable).select(db.fn.count("id").as("count")).execute();

        if (newCount.count === 0 || newCount.count === "0") {
            throw new Error(`No data found in table ${newTable}`);
        }

        logger.info(`Table ${newTable} valid with ${newCount.count} rows`);
    }
};

export const deleteAndRenameTables = async (tables: TableKey[], db: Kysely<Database>): Promise<void> => {
    for (const { table, newTable } of tables) {
        await db.schema.dropTable(`${table}Old`).ifExists().cascade().execute();
        await db.schema.alterTable(table).renameTo(`${table}Old`).execute();
        await db.schema.alterTable(newTable).renameTo(table).execute();
    }
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { STAGE: stage } = process.env;
    try {
        logger.info("Table Renamer starting... ");

        const dbClient = getDbClient();

        if (!stage) {
            throw new Error("Stage env not found");
        }

        await checkTables(
            tables.filter((table) => table.needsCheck),
            dbClient,
        );
        await deleteAndRenameTables(tables, dbClient);

        logger.info("Table Renamer run successfully completed");
    } catch (e) {
        logger.error(`Error running the Table Renamer ${e}`);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "There was a problem with the table renamer",
            }),
        };
    }
};
