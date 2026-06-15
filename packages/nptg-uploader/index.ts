import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { getObject } from "@create-disruptions-data/shared-ts/utils/s3";
import { Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { parseStringPromise } from "xml2js";
import { Nptg, nptgSchema } from "./zod";

const dbClient = getDbClient(false);

export const writeToAdminAreasTable = async (adminAreas: Nptg["adminAreas"]) => {
    await dbClient.insertInto("nptgAdminAreasNew").values(adminAreas).execute();
};

const uploadAdminAreas = async (adminAreas: Nptg["adminAreas"]) => {
    logger.info(`Uploading ${adminAreas.length} admin areas to the database`);

    await writeToAdminAreasTable(adminAreas);
};

export const writeToLocalitiesTable = async (batch: Nptg["localities"]) => {
    await dbClient
        .insertInto("localitiesNew")
        .values(batch)
        .execute()
        .then(() => 0);
};

const uploadLocalities = async (localities: Nptg["localities"]) => {
    const localitiesWithParents = localities.map((locality) => {
        const parentLocality = localities.find(
            (pLocality) => pLocality.nptgLocalityCode === locality.parentLocalityRef,
        );

        // biome-ignore lint/performance/noDelete: parentLocalityRef not used
        delete locality.parentLocalityRef;

        return {
            ...locality,
            parentLocalityName: parentLocality?.localityName ?? null,
            parentLocalityNameLang: parentLocality?.localityNameLang ?? null,
        };
    });

    const localitiesBatches = [];

    const numLocalitiesRows = localitiesWithParents.length;

    while (localitiesWithParents.length > 0) {
        const chunk = localitiesWithParents.splice(0, 200);
        localitiesBatches.push(chunk);
    }

    logger.info(`Uploading ${numLocalitiesRows} rows to the database in ${localitiesBatches.length} batches`);

    await BluebirdPromise.map(localitiesBatches, (batch) => writeToLocalitiesTable(batch), {
        concurrency: 10,
    });
};

export const parseNptgAndUpload = async (nptgString: string) => {
    const nptgJson = (await parseStringPromise(nptgString, {
        explicitArray: false,
    })) as Record<string, unknown>;

    const { adminAreas, localities } = nptgSchema.parse(nptgJson);

    await Promise.all([uploadAdminAreas(adminAreas), uploadLocalities(localities)]);
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { NPTG_BUCKET_NAME: nptgBucketName } = process.env;

    if (!nptgBucketName) {
        throw new Error("Missing env vars - NPTG_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting NPTG Uploader");

        const file = await getObject(nptgBucketName, "nptg.xml", logger);

        const body = (await file.Body?.transformToString()) || "";

        await parseNptgAndUpload(body);

        logger.info("NPTG upload complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);

            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "There was a problem with the nptg uploader",
                }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "There was a problem with the nptg uploader",
            }),
        };
    }
};
