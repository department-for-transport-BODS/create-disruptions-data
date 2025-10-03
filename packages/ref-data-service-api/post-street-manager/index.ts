import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getDbClient } from "@create-disruptions-data/shared-ts/utils/db";
import { logger, withLambdaRequestTracker } from "@create-disruptions-data/shared-ts/utils/logger";
import { APIGatewayEvent, Handler } from "aws-lambda";
import { getRoadworkById } from "../utils/db";
import { BaseMessage, PermitMessage, permitMessageSchema, snsMessageSchema } from "../utils/snsMessageTypes.zod";
import { confirmSubscription, isValidSignature } from "../utils/snsMessageValidator";

const allowedTopicArns = ["arn:aws:sns:eu-west-2:287813576808:prod-permit-topic"];

if (process.env.TEST_STREET_MANAGER_TOPIC_ARN) {
    allowedTopicArns.push(process.env.TEST_STREET_MANAGER_TOPIC_ARN);
}

const sqsClient = new SQSClient({ region: "eu-west-2" });

const sendPermitMessageToSqs = async (queueUrl: string | undefined, message: PermitMessage) => {
    if (!queueUrl) {
        throw Error("No url for SQS queue provided");
    }

    const sendMessageCommand: SendMessageCommand = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageGroupId: "streetmanager",
        MessageBody: JSON.stringify(message),
    });

    await sqsClient.send(sendMessageCommand);
    logger.info(`Successfully sent permit message ${message.permitReferenceNumber} to SQS queue`);
};

export const main: Handler = async (event: APIGatewayEvent, context) => {
    withLambdaRequestTracker(event, context);
    if (!event.headers?.["x-amz-sns-message-type"]) {
        logger.error("Invalid headers on request");
        return;
    }

    const parsedBody = snsMessageSchema.safeParse(JSON.parse(event.body ?? ""));
    if (!parsedBody.success) {
        logger.error(JSON.stringify(parsedBody.error));
        return;
    }

    const snsMessage = parsedBody.data;

    if (!(await isValidSignature(snsMessage))) {
        logger.error("Invalid signature provided");
        return;
    }

    if (!allowedTopicArns.includes(snsMessage.TopicArn)) {
        logger.error("Invalid topic ARN provided in SNS Message");
        return;
    }

    if (snsMessage.Type === "SubscriptionConfirmation") {
        const subscribeUrl = snsMessage.SubscribeURL ?? "";
        await confirmSubscription(subscribeUrl);
    } else if (snsMessage.Type === "Notification") {
        const permitMessage = permitMessageSchema.safeParse(JSON.parse(parsedBody.data.Message));

        if (!permitMessage.success) {
            const body = JSON.parse(parsedBody.data.Message) as BaseMessage;
            logger.error(
                `Failed to parse ${body.event_type} SNS message ${
                    body.event_reference
                }, ${permitMessage.error.toString()}`,
            );
            return;
        }
        try {
            const dbClient = getDbClient();
            const roadwork = await getRoadworkById(dbClient, {
                permitReferenceNumber: permitMessage.data.permitReferenceNumber,
            });
            if (
                !roadwork?.permitReferenceNumber ||
                (roadwork && new Date(roadwork.lastUpdatedDateTime) < new Date(permitMessage.data.lastUpdatedDateTime))
            ) {
                logger.info(`Sending message: ${permitMessage.data.permitReferenceNumber} to SQS queue`);
                const { STREET_MANAGER_SQS_QUEUE_URL: streetManagerSqsUrl } = process.env;

                await sendPermitMessageToSqs(streetManagerSqsUrl, permitMessage.data);
            } else {
                logger.info(`Skipped adding message : ${permitMessage.data.permitReferenceNumber} to SQS queue`);
                return;
            }
        } catch (e) {
            if (e instanceof Error) {
                logger.error(e);
            }

            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "There was a problem with with processing street manager data",
                }),
            };
        }
    }
};
