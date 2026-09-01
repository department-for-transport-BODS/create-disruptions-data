import {
    Bucket,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectVersionsCommand,
    ObjectIdentifier,
    S3Client,
} from "@aws-sdk/client-s3";
import { program } from "commander";
import * as logger from "lambda-log";
import { withUserPrompt, withUserPrompts } from "../utils";
import { createS3Client } from "../utils/awsClients";

const PROTECTED_STAGES = ["prod", "preprod", "test", "sandbox"];

const emptyBucket = async (client: S3Client, bucket: string) => {
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    let deletedCount = 0;

    do {
        const { Versions, DeleteMarkers, IsTruncated, NextKeyMarker, NextVersionIdMarker } = await client.send(
            new ListObjectVersionsCommand({
                Bucket: bucket,
                KeyMarker: keyMarker,
                VersionIdMarker: versionIdMarker,
            }),
        );

        const objects: ObjectIdentifier[] = [...(Versions ?? []), ...(DeleteMarkers ?? [])].map((item) => ({
            Key: item.Key,
            VersionId: item.VersionId,
        }));

        if (objects.length > 0) {
            // DeleteObjects accepts a maximum of 1000 keys per request
            for (let i = 0; i < objects.length; i += 1000) {
                const { Errors } = await client.send(
                    new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: {
                            Objects: objects.slice(i, i + 1000),
                            Quiet: true,
                        },
                    }),
                );

                if (Errors?.length) {
                    for (const error of Errors) {
                        logger.warn(
                            `Failed to delete ${error.Key} from ${bucket}: ${error.Message ?? "unknown error"}`,
                        );
                    }
                }
            }

            deletedCount += objects.length;
            logger.info(`Deleted ${deletedCount} object(s) from ${bucket}...`);
        }

        keyMarker = IsTruncated ? NextKeyMarker : undefined;
        versionIdMarker = IsTruncated ? NextVersionIdMarker : undefined;
    } while (keyMarker || versionIdMarker);

    return deletedCount;
};

program.option("--stage <stage>", "SST stage to delete buckets for").action(async (options) => {
    const { stage } = await withUserPrompts(
        { stage: options.stage as string },
        {
            stage: { type: "input", message: "SST stage to delete buckets for" },
        },
    );

    if (!stage) {
        logger.error("A stage must be provided. Exiting without making changes.");
        process.exit(1);
    }

    if (PROTECTED_STAGES.includes(stage)) {
        logger.error(`Refusing to delete buckets for the protected stage: ${stage}`);
        process.exit(1);
    }

    const client = createS3Client();

    const { Buckets } = await client.send(new ListBucketsCommand({}));

    const matchingBuckets = (Buckets ?? []).filter(
        (bucket): bucket is Bucket & { Name: string } => !!bucket.Name && bucket.Name.endsWith(`-${stage}`),
    );

    if (matchingBuckets.length === 0) {
        logger.info(`No buckets found for stage: ${stage}`);
        return;
    }

    logger.info(`Found ${matchingBuckets.length} bucket(s) for stage ${stage}:`);
    for (const bucket of matchingBuckets) {
        console.log(` - ${bucket.Name}`);
    }

    const confirmed = await withUserPrompt("confirmDelete", {
        type: "confirm",
        message: `This will permanently empty and delete the ${matchingBuckets.length} bucket(s) listed above. Are you sure you want to continue?`,
        default: false,
    });

    if (!confirmed) {
        logger.info("Script aborted. Exiting without making changes.");
        return;
    }

    for (const { Name: bucketName } of matchingBuckets) {
        try {
            const client = createS3Client();

            logger.info(`Emptying bucket: ${bucketName}`);
            await emptyBucket(client, bucketName);

            logger.info(`Deleting bucket: ${bucketName}`);
            await client.send(new DeleteBucketCommand({ Bucket: bucketName }));

            logger.info(`Successfully deleted bucket: ${bucketName}`);
        } catch (error) {
            logger.error(`Failed to delete bucket ${bucketName}: ${(error as Error).message}`);
        }
    }

    logger.info(`Finished processing buckets for stage: ${stage}`);
});

program.parseAsync(process.argv);
