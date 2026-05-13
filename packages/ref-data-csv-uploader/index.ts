import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { Database } from "@create-disruptions-data/shared-ts/db/types";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import snakeCase from "lodash/snakeCase";
import OsPoint from "ospoint";
import { parse } from "papaparse";

const dbClient = getDbClient();
const fileNames = ["Stops.csv", "NOCLines.csv", "NOCTable.csv", "PublicName.csv"];
const region = process.env.AWS_REGION;

const getSourceS3Client = (roleArn?: string) => {
    if (!roleArn) {
        return new S3Client({ region });
    }

    return new S3Client({
        region,
        credentials: fromTemporaryCredentials({
            clientConfig: { region },
            params: {
                RoleArn: roleArn,
                RoleSessionName: "cdd-csv-ref-data-uploader",
            },
        }),
    });
};

const getSourceObject = async (bucket: string, key: string, roleArn?: string) => {
    logger.info("Getting item from S3");

    try {
        const sourceClient = getSourceS3Client(roleArn);

        return await sourceClient.send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: decodeURIComponent(key),
            }),
        );
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get item from s3: ${error.stack || ""}`);
        }

        throw error;
    }
};

export const processFile = async (fileName: string, csvBucketName: string, s3Key?: string, sourceRoleArn?: string) => {
    logger.info(`Starting CSV Uploader for ${fileName}`);

    const fileKey = s3Key || fileName;
    const file = await getSourceObject(csvBucketName, fileKey, sourceRoleArn);

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
        const {
            CSV_BUCKET_NAME: csvBucketName,
            SOURCE_ROLE_ARN: sourceRoleArn,
            SST_Parameter_value_SOURCE_ROLE_ARN: sstSourceRoleArn,
            NAPTAN_ROLE_ARN: legacyNaptanRoleArn,
            SST_Parameter_value_NAPTAN_ROLE_ARN: sstLegacyNaptanRoleArn,
            NAPTAN_BUCKET_NAME: naptanBucketName,
            NAPTAN_BUCKET_KEY: naptanBucketKey,
        } = process.env;

        // CSV bucket is always required as it's the primary data source
        if (!csvBucketName) {
            throw new Error("Missing env vars - CSV_BUCKET_NAME must be set");
        }

        // NAPTAN bucket and key must be paired - cannot have one without the other
        if (naptanBucketName && !naptanBucketKey) {
            throw new Error("Missing env vars - NAPTAN_BUCKET_KEY must be set when NAPTAN_BUCKET_NAME is provided");
        }

        if (naptanBucketKey && !naptanBucketName) {
            throw new Error("Missing env vars - NAPTAN_BUCKET_NAME must be set when NAPTAN_BUCKET_KEY is provided");
        }

        const roleArn = sourceRoleArn ?? sstSourceRoleArn ?? legacyNaptanRoleArn ?? sstLegacyNaptanRoleArn;

        // NAPTAN bucket is in a different AWS account, so cross-account role assumption is mandatory
        if (naptanBucketName && !roleArn) {
            throw new Error("Missing env vars - SOURCE_ROLE_ARN or NAPTAN_ROLE_ARN must be set when NAPTAN_BUCKET_NAME is provided");
        }

        for (const fileName of fileNames) {
            if (fileName === "Stops.csv" && naptanBucketName && naptanBucketKey) {
                logger.info(`Using external NaPTAN bucket: ${naptanBucketName}/${naptanBucketKey}`);
                await processFile("Stops.csv", naptanBucketName, naptanBucketKey, roleArn);
            } else {
                await processFile(fileName, csvBucketName, undefined, roleArn);
            }
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);
        }

        throw e;
    }
};
