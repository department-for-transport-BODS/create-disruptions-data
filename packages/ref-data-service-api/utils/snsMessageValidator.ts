import crypto from "crypto";
import { logger } from "@create-disruptions-data/shared-ts/utils/logger";
import axios from "axios";
import { SnsMessage } from "./snsMessageTypes.zod";

export const isValidSignature = async (body: SnsMessage) => {
    verifyMessageSignatureVersion(body.SignatureVersion);

    const certificate = await downloadCertificate(body.SigningCertURL);
    return validateSignature(body, certificate);
};
const verifyMessageSignatureVersion = (version: string) => {
    if (version !== "1") {
        throw "Signature verification failed";
    }
};

const downloadCertificate = async (signingCertURL: string) => {
    if (new URL(signingCertURL).protocol !== "https:") {
        throw "SigningCertURL was not using HTTPS";
    }

    try {
        const response = await axios.get<string>(signingCertURL);
        return response.data;
    } catch (e) {
        logger.error("Error fetching certificate");
        throw e;
    }
};

const validateSignature = (body: SnsMessage, certificate: string) => {
    const verify = crypto.createVerify("sha1WithRSAEncryption");
    verify.write(getMessageToSign(body));
    verify.end();

    return verify.verify(certificate, body.Signature, "base64");
};

const getMessageToSign = (body: SnsMessage) => {
    switch (body.Type) {
        case "SubscriptionConfirmation":
            return buildSubscriptionStringToSign(body);
        case "Notification":
            return buildNotificationStringToSign(body);
        default:
            return;
    }
};

function buildNotificationStringToSign(body: SnsMessage) {
    let stringToSign = "";

    stringToSign = "Message\n";
    stringToSign += `${body.Message}\n`;
    stringToSign += "MessageId\n";
    stringToSign += `${body.MessageId}\n`;
    if (body.Subject) {
        stringToSign += "Subject\n";
        stringToSign += `${body.Subject}\n`;
    }
    stringToSign += "Timestamp\n";
    stringToSign += `${body.Timestamp}\n`;
    stringToSign += "TopicArn\n";
    stringToSign += `${body.TopicArn}\n`;
    stringToSign += "Type\n";
    stringToSign += `${body.Type}\n`;

    return stringToSign;
}

function buildSubscriptionStringToSign(body: SnsMessage) {
    let stringToSign = "";

    stringToSign = "Message\n";
    stringToSign += `${body.Message}\n`;
    stringToSign += "MessageId\n";
    stringToSign += `${body.MessageId}\n`;
    stringToSign += "SubscribeURL\n";
    stringToSign += `${body.SubscribeURL ?? ""}\n`;
    stringToSign += "Timestamp\n";
    stringToSign += `${body.Timestamp}\n`;
    stringToSign += "Token\n";
    stringToSign += `${body.Token ?? ""}\n`;
    stringToSign += "TopicArn\n";
    stringToSign += `${body.TopicArn}\n`;
    stringToSign += "Type\n";
    stringToSign += `${body.Type}\n`;

    return stringToSign;
}

export const confirmSubscription = async (subscribeUrl: string) => {
    try {
        await axios.get(subscribeUrl);
        logger.info("Subscription confirmed");
    } catch (e) {
        logger.error("Error confirming subscription");
        throw e;
    }
};
