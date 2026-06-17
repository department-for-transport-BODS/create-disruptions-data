import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { Handler } from "aws-lambda";
import { Promise as BluebirdPromise } from "bluebird";
import { parseStringPromise } from "xml2js";
import { Nptg, nptgSchema } from "./zod";

const dbClient = getDbClient(false);
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
                RoleSessionName: "cdd-nptg-uploader",
            },
        }),
    });
};

const getSourceObject = async (bucket: string, key: string, roleArn?: string) => {
    const sourceClient = getSourceS3Client(roleArn);

    return await sourceClient.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );
};

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

    const { NPTG_BUCKET_NAME: nptgBucketName, NPTG_ROLE_ARN: nptgRoleArn, NPTG_S3_KEY: nptgS3Key } = process.env;

    if (!nptgBucketName) {
        throw new Error("NPTG_BUCKET_NAME must be set");
    }

    if (!nptgRoleArn) {
        throw new Error("NPTG_ROLE_ARN must be set");
    }

    if (!nptgS3Key) {
        throw new Error("NPTG_S3_KEY must be set");
    }

    try {
        logger.info("Starting NPTG Uploader");

        const file = await getSourceObject(nptgBucketName, nptgS3Key, nptgRoleArn);

        const body = (await file.Body?.transformToString()) || "";

        await parseNptgAndUpload(body);

        logger.info("NPTG upload complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the NPTG uploader");
        }
        throw e;
    }
};
