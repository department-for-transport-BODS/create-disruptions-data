import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayEvent, Context } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import Mockdate from "mockdate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStreetManagerNotification, mockStreetManagerNotificationOld } from "../testdata/sample_data";
import * as db from "../utils/db";
import * as snsMessageValidator from "../utils/snsMessageValidator";
import { main } from "./index";

const sqsMock = mockClient(SQSClient);
const getRoadworkByIdMock = vi.spyOn(db, "getRoadworkById");
const isValidSignatureMock = vi.spyOn(snsMessageValidator, "isValidSignature");

vi.mock("@create-disruptions-data/shared-ts/utils/db", () => ({
    getDbClient: vi.fn().mockReturnValue({}),
}));

vi.mock("../utils/db", () => ({
    getRoadworkById: vi.fn().mockResolvedValue({
        permitReferenceNumber: "TSR1591199404915-01",
        highwayAuthority: "CITY OF WESTMINSTER",
        highwayAuthoritySwaCode: 5990,
        worksLocationCoordinates: "LINESTRING(501251.53 222574.64,501305.92 222506.65)",
        streetName: "HIGH STREET NORTH",
        areaName: "LONDON",
        workCategory: "Standard",
        trafficManagementType: "Road closure",
        proposedStartDateTime: "2020-06-10T00:00:00.000Z",
        proposedEndDateTime: "2020-06-12T00:00:00.000Z",
        actualStartDateTime: "2020-06-11T10:11:00.000Z",
        actualEndDateTime: "2020-06-13T00:00:00.000Z",
        workStatus: "Works in progress",
        activityType: "Remedial works",
        permitStatus: "permit_modification_request",
        town: "LONDON",
        lastUpdatedDatetime: "2019-06-03T08:00:00.000Z",
        administrativeAreaCode: "BLAC",
        createdDateTime: "2018-06-03T08:00:00.000Z",
    }),
}));

vi.mock("../utils/snsMessageValidator", () => ({
    isValidSignature: vi.fn().mockResolvedValue(true),
    confirmSubscription: vi.fn().mockResolvedValue(undefined),
}));

describe("post-street-manager", () => {
    beforeAll(() => {
        process.env.STREET_MANAGER_SQS_QUEUE_URL = "https://fake-sqs-url";
    });

    beforeEach(() => {
        vi.resetModules();
        process.env.STREET_MANAGER_SQS_QUEUE_URL = "https://fake-sqs-queue-url";

        sqsMock.reset();
        isValidSignatureMock.mockResolvedValue(true);

        getRoadworkByIdMock.mockResolvedValue({
            permitReferenceNumber: "TSR1591199404915-01",
            highwayAuthority: "CITY OF WESTMINSTER",
            highwayAuthoritySwaCode: 5990,
            worksLocationCoordinates: "LINESTRING(501251.53 222574.64,501305.92 222506.65)",
            streetName: "HIGH STREET NORTH",
            areaName: "LONDON",
            workCategory: "Standard",
            trafficManagementType: "Road closure",
            proposedStartDateTime: "2020-06-10T00:00:00.000Z",
            proposedEndDateTime: "2020-06-12T00:00:00.000Z",
            actualStartDateTime: "2020-06-11T10:11:00.000Z",
            actualEndDateTime: "2020-06-13T00:00:00.000Z",
            workStatus: "Works in progress",
            activityType: "Remedial works",
            permitStatus: "permit_modification_request",
            town: "LONDON",
            lastUpdatedDateTime: "2017-10-04T08:00:00.000Z",
            administrativeAreaCode: "BLAC",
            createdDateTime: "2016-06-03T08:00:00.000Z",
        });
    });

    afterAll(() => {
        Mockdate.reset();
    });

    it("should send the validated SNS message body to SQS if request is of type Notification", async () => {
        await main(mockStreetManagerNotification, {} as Context, () => {});

        expect(sqsMock.commandCalls(SendMessageCommand).length).toBe(1);
        expect(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input.MessageBody).toContain("TSR1591199404915-01");
    });

    it("should not send the validated SNS message body to SQS if permit is older than roadwork", async () => {
        await main(mockStreetManagerNotificationOld, {} as Context, () => {});

        expect(sqsMock.commandCalls(SendMessageCommand).length).toBe(0);
    });

    it("should confirm subscription to SNS topic if request is of type SubscriptionConfirmation", async () => {
        const confirmSubscriptionMock = vi.mocked(snsMessageValidator.confirmSubscription);
        confirmSubscriptionMock.mockResolvedValue(undefined);

        const mockSnsEventSubscription = {
            ...mockStreetManagerNotification,
            body: JSON.stringify({
                Type: "SubscriptionConfirmation",
                MessageId: "1234",
                TopicArn: "arn:aws:sns:eu-west-2:287813576808:prod-permit-topic",
                Message:
                    "You have chosen to subscribe to the topic. To confirm the subscription, visit the SubscribeURL included in this message.",
                Timestamp: "2023-10-02T14:22:45.889Z",
                SignatureVersion: "1",
                Signature: "test-signature",
                SigningCertURL: "https://www.testurl.com",
                SubscribeURL: "https://www.testurl.com",
            }),
        };

        await main(mockSnsEventSubscription as unknown as APIGatewayEvent, {} as Context, () => {});
        expect(confirmSubscriptionMock).toBeCalled();
        expect(confirmSubscriptionMock).toBeCalledWith("https://www.testurl.com");
    });

    it("should error if request does not have the correct SNS header", async () => {
        const mockSnsEventNoHeader = {
            ...mockStreetManagerNotification,
            headers: {
                ...mockStreetManagerNotification.headers,
                "x-amz-sns-message-type": undefined,
            },
        };
        await expect(main(mockSnsEventNoHeader, {} as Context, () => {})).rejects.toThrow("Invalid headers on request");
        expect(sqsMock.send.calledOnce).toBeFalsy();
    });

    it("should error if request body does not match the SNS message schema", async () => {
        const mockSnsEventInvalidBody = {
            ...mockStreetManagerNotification,
            body: JSON.stringify({
                MessageId: "1234",
                Message: "Notification",
            }),
        };

        await expect(
            main(mockSnsEventInvalidBody as unknown as APIGatewayEvent, {} as Context, () => {}),
        ).rejects.toThrow();
        expect(sqsMock.send.calledOnce).toBeFalsy();
    });

    it("should error if an invalid signing certificate is provided", async () => {
        const isValidSignatureMock = vi.mocked(snsMessageValidator.isValidSignature);
        isValidSignatureMock.mockResolvedValue(false);

        await expect(main(mockStreetManagerNotification, {} as Context, () => {})).rejects.toThrow(
            "Invalid signature provided",
        );

        expect(sqsMock.commandCalls(SendMessageCommand).length).toBe(0);
    });

    it("should error if an invalid topic ARN is provided", async () => {
        const mockSnsEventInvalidArn = {
            ...mockStreetManagerNotification,
            body: JSON.stringify({
                Type: "Notification",
                MessageId: "1234",
                TopicArn: "wrong arn",
                Message: "{}",
                Timestamp: "2023-10-02T14:22:45.889Z",
                SignatureVersion: "1",
                Signature: "test-signature",
                SigningCertURL: "https://www.testurl.com",
            }),
        };

        await expect(main(mockSnsEventInvalidArn, {} as Context, () => {})).rejects.toThrow(
            "Invalid topic ARN provided in SNS Message",
        );
        expect(sqsMock.send.calledOnce).toBeFalsy();
    });
});
