import { Stream } from "stream";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { startS3Upload } from "@create-disruptions-data/shared-ts/utils/s3";
import { Handler } from "aws-lambda";
import axios from "axios";
import dayjs from "dayjs";
import { Entry, Parse } from "unzipper";

const getBodsDataAndUploadToS3 = async (bodsUrl: string, txcZippedBucketName: string, txcBucketName: string) => {
    logger.info("Starting retrieval of BODS data");

    const response = await axios.get<Stream>(bodsUrl, {
        responseType: "stream",
    });

    const zip = response.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    const promises = [];

    const prefix = dayjs().format("YYYYMMDD");

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        const type = entry.type;

        if (type === "File") {
            let upload: ReturnType<typeof startS3Upload>;

            if (fileName.endsWith(".zip")) {
                upload = startS3Upload(txcZippedBucketName, `${prefix}/bods/${fileName}`, entry, "application/zip");
                promises.push(upload.done());
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(txcBucketName, `${prefix}/bods/${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }
        }

        entry.autodrain();
    }

    await Promise.all(promises);
};

export const main: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const {
        BODS_URL: bodsUrl,
        BODS_COACH_URL: bodsCoachUrl,
        TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName,
        TXC_BUCKET_NAME: txcBucketName,
    } = process.env;

    if (!bodsUrl || !txcZippedBucketName || !txcBucketName || !bodsCoachUrl) {
        throw new Error(
            "Missing env vars - BODS_URL, BODS_COACH_URL, TXC_ZIPPED_BUCKET_NAME and TXC_BUCKET_NAME must be set",
        );
    }

    try {
        await getBodsDataAndUploadToS3(bodsUrl, txcZippedBucketName, txcBucketName);
        await getBodsDataAndUploadToS3(bodsCoachUrl, txcZippedBucketName, txcBucketName);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e);
        }

        throw e;
    }
};
