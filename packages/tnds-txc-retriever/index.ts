import { Writable } from "node:stream";
import {
    errorMapWithDataLogging,
    logger,
    withLambdaRequestTracker,
} from "@create-disruptions-data/shared-ts/utils/logger";
import { startS3Upload } from "@create-disruptions-data/shared-ts/utils/s3";
import { Handler } from "aws-lambda";
import { Client } from "basic-ftp";
import dayjs from "dayjs";
import { Config } from "sst/node/config";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const getZipFilesFromFTP = async (client: Client): Promise<Map<string, Uint8Array>> => {
    const downloadedFiles: Map<string, Uint8Array> = new Map();
    const allFiles = await client.list();

    for (const file of allFiles) {
        if (file.name.endsWith(".zip")) {
            const chunks: Uint8Array[] = [];
            const writableStream = new Writable({
                write(chunk: Buffer, _encoding, callback) {
                    chunks.push(new Uint8Array(chunk));
                    callback();
                },
            });
            await client.downloadTo(writableStream, file.name);
            const buffer = Buffer.concat(chunks);
            downloadedFiles.set(file.name, new Uint8Array(buffer));
        }
    }

    return downloadedFiles;
};

const uploadZipFilesToS3 = async (files: Map<string, Uint8Array>, bucket: string, prefix: string) => {
    for (const [fileName, content] of files.entries()) {
        const upload = startS3Upload(bucket, `${prefix}/tnds/${fileName}`, content, "application/zip");
        await upload.done();
    }
};

const getTndsDataAndUploadToS3 = async (txcZippedBucketName: string, prefix: string) => {
    const timeoutMs = 600000;
    const client = new Client(timeoutMs);
    try {
        await client.access({
            host: Config.TNDS_FTP_HOST,
            user: Config.TNDS_FTP_USERNAME,
            password: Config.TNDS_FTP_PASSWORD,
        });

        const zipFiles = await getZipFilesFromFTP(client);

        logger.info("Zip files received, uploading to S3");

        await uploadZipFilesToS3(zipFiles, txcZippedBucketName, prefix);
    } finally {
        client.close();
    }
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName } = process.env;

    if (!txcZippedBucketName) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of TNDS TXC data");

        const prefix = dayjs().format("YYYYMMDD");
        await getTndsDataAndUploadToS3(txcZippedBucketName, prefix);

        logger.info("TNDS TXC retrieval complete");

        return {
            tndsTxcZippedBucketName: txcZippedBucketName,
            prefix,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving TNDS TXC data");
        }

        throw e;
    }
};
