import { SendEmailCommand } from "@aws-sdk/client-ses";
import { NextApiRequest, NextApiResponse } from "next";
import Mail from "nodemailer/lib/mailer";
import {
    CONTACT_FEEDBACK_QUESTION,
    GENERAL_FEEDBACK_QUESTION,
    HEAR_ABOUT_US_FEEDBACK_QUESTION,
    SOLVE_FEEDBACK_QUESTION,
} from "../../constants";
import { Feedback } from "../../interfaces";
import { createMailTransporter, setFeedbackMailOptions } from "../../utils/apiUtils/feedbackEmailer";
import { redirectTo, redirectToError } from "../../utils/apiUtils/index";
import { removeExcessWhiteSpace } from "../../utils/apiUtils/validator";
import logger from "../../utils/logger";

interface FeedbackApiRequest extends NextApiRequest {
    body: {
        hearAboutServiceQuestion: string;
        generalFeedbackQuestion: string;
        contactQuestion: string;
        problemQuestion: string;
    };
}

export const buildFeedbackForEmail = (req: FeedbackApiRequest): Feedback[] => {
    const { body } = req;
    const feedback: Feedback[] = [];
    const refinedHearAboutServiceInput = removeExcessWhiteSpace(body.hearAboutServiceQuestion);
    const refinedGeneralFeedbackInput = removeExcessWhiteSpace(body.generalFeedbackQuestion);
    if (refinedHearAboutServiceInput && refinedHearAboutServiceInput !== "") {
        feedback.push({
            question: HEAR_ABOUT_US_FEEDBACK_QUESTION,
            answer: refinedHearAboutServiceInput,
        });
    }
    if (refinedGeneralFeedbackInput && refinedGeneralFeedbackInput !== "") {
        feedback.push({
            question: GENERAL_FEEDBACK_QUESTION,
            answer: refinedGeneralFeedbackInput,
        });
    }
    if (body.contactQuestion) {
        feedback.push({
            question: CONTACT_FEEDBACK_QUESTION,
            answer: body.contactQuestion,
        });
    }
    if (body.problemQuestion) {
        feedback.push({
            question: SOLVE_FEEDBACK_QUESTION,
            answer: body.problemQuestion,
        });
    }

    return feedback;
};

export const requestIsEmpty = (req: FeedbackApiRequest): boolean => {
    const { body } = req;
    const refinedHearAboutServiceInput = removeExcessWhiteSpace(body.hearAboutServiceQuestion);
    const refinedGeneralFeedbackInput = removeExcessWhiteSpace(body.generalFeedbackQuestion);
    if (
        !body.contactQuestion &&
        !body.problemQuestion &&
        refinedHearAboutServiceInput === "" &&
        refinedGeneralFeedbackInput === ""
    ) {
        return true;
    }

    return false;
};

// redactEmailAddress replaces the user portion of an email address so it can be safely logged
export const redactEmailAddress = (
    toRedact: string | Mail.Address | (string | Mail.Address)[] | undefined,
): string | string[] => {
    const redact = (address: string): string => address.toString().replace(/.*@/, "*****@");
    if (toRedact !== undefined) {
        if (typeof toRedact === "string") {
            return redact(toRedact);
        }
        if (typeof toRedact === "object" && toRedact !== null) {
            if ("address" in toRedact && typeof toRedact.address === "string") {
                return redact(toRedact.address);
            }
            if (Array.isArray(toRedact)) {
                return toRedact.map((email) => {
                    if (typeof email === "string") {
                        return redact(email);
                    }
                    if (typeof email.address === "string") {
                        return redact(email.address);
                    }
                    return "*****@*****.***";
                });
            }
        }
    }
    return "*****@*****.***";
};

const feedback = async (req: FeedbackApiRequest, res: NextApiResponse): Promise<void> => {
    let mailOptions: SendEmailCommand | undefined;
    try {
        if (requestIsEmpty(req)) {
            redirectTo(res, "/feedback?feedbackSubmitted=false");
            return;
        }

        const feedback: Feedback[] = buildFeedbackForEmail(req);
        mailOptions = setFeedbackMailOptions(feedback);

        const mailTransporter = createMailTransporter();

        await mailTransporter.send(mailOptions);
        logger.info({
            context: "api.feedback",
            mailOptions: {
                from: mailOptions.input.Source,
                to: redactEmailAddress(mailOptions.input.Destination?.ToAddresses),
                subject: mailOptions.input.Message?.Subject,
                text: mailOptions.input.Message?.Body,
            },
            message: "Sending of emails enabled, email sent",
        });

        redirectTo(res, "/feedback?feedbackSubmitted=true");
        return;
    } catch (error) {
        if (mailOptions) {
            logger.error({
                context: "api.feedback",
                mailOptions: {
                    from: mailOptions.input.Source,
                    to: redactEmailAddress(mailOptions.input.Destination?.ToAddresses),
                    subject: mailOptions.input.Message?.Subject,
                    text: mailOptions.input.Message?.Body,
                },
                message: "Sending of emails failed, email probably not sent",
            });
        }
        const message = "There was a problem receiving the user feedback.";
        redirectToError(res, message, "api.feedback", error as Error);
    }
};

export default feedback;
