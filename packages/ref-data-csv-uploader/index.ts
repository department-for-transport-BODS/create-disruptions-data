import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { getObject } from "@create-disruptions-data/shared-ts/utils/s3";
import { Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import snakeCase from "lodash/snakeCase";
import OsPoint from "ospoint";
import { parse } from "papaparse";

const dbClient = getDbClient();
const fileNames = ["Stops.csv", "NOCLines.csv", "NOCTable.csv", "PublicName.csv"];

export const processFile = async (fileName: string, csvBucketName: string) => {
    logger.info(`Starting CSV Uploader for ${fileName}`);

    const file = await getObject(csvBucketName, fileName, logger);

    const body = (await file.Body?.transformToString()) || "";

    let { data } = parse(body, {
        skipEmptyLines: "greedy",
        header: true,
        transformHeader: (header) => {
            const headerMap: { [key: string]: string } = {
                NOCCODE: "noc_code",
                TTRteEnq: "ttrte_enq",
                LinkedIn: "linkedin",
                YouTube: "youtube",
            };

            return headerMap[header] ?? snakeCase(header);
        },
    });

    const numRows = data.length;

    const batches = [];

    if (fileName === "Stops.csv") {
        data = (
            data as {
                longitude: string;
                latitude: string;
                easting: string;
                northing: string;
            }[]
        ).map((item) => {
            if ((!item.longitude || !item.latitude) && item.easting && item.northing) {
                const osPoint = new OsPoint(item.northing, item.easting);

                const wgs84 = osPoint?.toWGS84();

                if (wgs84) {
                    return {
                        ...item,
                        longitude: wgs84.longitude,
                        latitude: wgs84.latitude,
                    };
                }
            }

            return {
                ...item,
            };
        });
    }

    while (data.length > 0) {
        const chunk = data.splice(0, 200);
        batches.push(chunk);
    }

    logger.info(`Uploading ${numRows} rows to the database in ${batches.length} batches`);

    let table: keyof Database;

    switch (fileName) {
        case "Stops.csv":
            table = "stops";
            break;

        case "NOCLines.csv":
            table = "operatorLines";
            break;

        case "NOCTable.csv":
            table = "operators";
            break;

        case "PublicName.csv":
            table = "operatorPublicData";
            break;

        default:
            throw new Error("Unknown file");
    }

    const newTable: keyof Database = `${table}New`;

    await BluebirdPromise.map(
        batches,
        (batch) => {
            return dbClient
                .insertInto(newTable)
                .values(batch)
                .execute()
                .then(() => 0);
        },
        {
            concurrency: 10,
        },
    );
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { CSV_BUCKET_NAME: csvBucketName } = process.env;

        if (!csvBucketName) {
            throw new Error("Missing env vars - CSV_BUCKET_NAME must be set");
        }

        for (const fileName of fileNames) {
            await processFile(fileName, csvBucketName);
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);
        }

        throw e;
    }
};
