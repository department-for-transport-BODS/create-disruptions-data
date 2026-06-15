import { PassThrough } from "node:stream";
import {
    GetObjectCommand,
    GetObjectCommandOutput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Logger } from ".";

const s3 = new S3Client({ region: "eu-west-2" });

const replaceSpecialCharacters = (input: string) => input.replace(/[^a-zA-Z0-9._\-!\*\'\(\)\/]/g, "_");

export const getObject = async (bucket: string, key: string, logger: Logger): Promise<GetObjectCommandOutput> => {
    logger.info("Getting item from S3");

    try {
        const input = {
            Bucket: bucket,
            Key: decodeURIComponent(key),
        };
        const command = new GetObjectCommand(input);

        return await s3.send(command);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get item from s3: ${error.stack || ""}`);
        }

        throw error;
    }
};

export const putObject = async (input: PutObjectCommandInput) => {
    try {
        const command = new PutObjectCommand({
            ...input,
            Key: input.Key ? replaceSpecialCharacters(input.Key) : undefined,
        });

        return await s3.send(command);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to put item into s3: ${error.stack || ""}`);
        }

        throw error;
    }
};

export const startS3Upload = (
    bucket: string,
    key: string,
    body: PassThrough | Uint8Array,
    contentType: string,
    queueSize = 4,
    partSize = 1024 * 1024 * 5,
    leavePartsOnError = false,
) =>
    new Upload({
        client: s3,
        params: {
            Bucket: bucket,
            Key: key.replace(/[^a-zA-Z0-9._!\*\'\(\)\/-]/g, "_"),
            Body: body,
            ContentType: contentType,
        },
        queueSize,
        partSize,
        leavePartsOnError,
    });
