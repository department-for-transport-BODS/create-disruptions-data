import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const createDynamoDbDocClient = () => {
    return DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" }));
};

export const createCognitoClient = () => {
    return new CognitoIdentityProviderClient({
        region: "eu-west-2",
    });
};

export const createS3Client = () => {
    return new S3Client({ region: "eu-west-2" });
};
