import { Readable, Stream } from "node:stream";
import {
    errorMapWithDataLogging,
    logger,
    withLambdaRequestTracker,
} from "@create-disruptions-data/shared-ts/utils/logger";
import { getObject, startS3Upload } from "@create-disruptions-data/shared-ts/utils/s3";
import { S3Handler } from "aws-lambda";
import { Entry, Parse } from "unzipper";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const getFilePath = (filePathWithFile: string) => {
    const path = filePathWithFile.substring(0, filePathWithFile.lastIndexOf("."));

    if (!path) {
        return "";
    }

    return `${path}/`;
};

export const unzip = async (object: Stream, unzippedBucketName: string, key: string) => {
    const zip = object.pipe(
        Parse({
            forceStream: true,
        }),
    );

    const promises = [];

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        const type = entry.type;

        if (type === "File") {
            let upload: ReturnType<typeof startS3Upload>;

            if (fileName.endsWith(".zip")) {
                await unzip(entry, unzippedBucketName, `${getFilePath(key)}${fileName}`);
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(unzippedBucketName, `${getFilePath(key)}${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }
        }

        entry.autodrain();
    }

    await Promise.all(promises);
};

export const main: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const {
        bucket: { name: bucketName },
        object: { key },
    } = event.Records[0].s3;

    if (!key.endsWith(".zip")) {
        logger.info("Ignoring non-zip file");
        return;
    }

    try {
        const { UNZIPPED_BUCKET_NAME: unzippedBucketName } = process.env;

        if (!unzippedBucketName) {
            throw new Error("Missing env vars - UNZIPPED_BUCKET_NAME must be set");
        }

        if (!bucketName || !key) {
            throw new Error("Bucket name or object key not in event");
        }

        const object = await getObject(bucketName, key, logger);

        if (!object.Body || !(object.Body instanceof Readable)) {
            throw new Error("No data in file");
        }

        await unzip(object.Body, unzippedBucketName, key);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, `Error unzipping file at s3://${bucketName}/${key}`);
        }

        throw e;
    }
};
