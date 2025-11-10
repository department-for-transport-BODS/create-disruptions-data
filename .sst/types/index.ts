import "sst/node/config";
declare module "sst/node/config" {
  export interface ConfigTypes {
    APP: string;
    STAGE: string;
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_USERNAME": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_PASSWORD": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_HOST": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_RO_HOST": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_PORT": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "DB_NAME": {
      value: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-local-database-creator-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-custom-email-cognito-trigger": {
      functionName: string;
    }
  }
}

import "sst/node/table";
declare module "sst/node/table" {
  export interface TableResources {
    "cdd-dynamodb-disruptions-table": {
      tableName: string;
    }
  }
}

import "sst/node/table";
declare module "sst/node/table" {
  export interface TableResources {
    "cdd-dynamodb-template-disruptions-table": {
      tableName: string;
    }
  }
}

import "sst/node/table";
declare module "sst/node/table" {
  export interface TableResources {
    "cdd-dynamodb-organisations-v2-table": {
      tableName: string;
    }
  }
}

import "sst/node/queue";
declare module "sst/node/queue" {
  export interface QueueResources {
    "ref-data-service-street-manager-queue": {
      queueUrl: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-stops-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-operators-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-services-for-operator-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-service-by-id-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-services-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-service-stops-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-service-journeys-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-service-routes-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-admin-area-codes-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-admin-areas-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-post-street-manager-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-roadworks-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "ref-data-service-get-roadwork-by-id-function": {
      functionName: string;
    }
  }
}

import "sst/node/api";
declare module "sst/node/api" {
  export interface ApiResources {
    "ref-data-service-api": {
      url: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-image-bucket": {
      bucketName: string;
    }
  }
}

import "sst/node/site";
declare module "sst/node/site" {
  export interface NextjsSiteResources {
    "Site": {
      url: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-nextdoor-token-refresher": {
      functionName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-siri-sx": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-siri-sx-unvalidated": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-disruptions-json": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-disruptions-csv": {
      bucketName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-siri-sx-generator": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-siri-stats-generator": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-siri-sx-validator": {
      functionName: string;
    }
  }
}

import "sst/node/api";
declare module "sst/node/api" {
  export interface ApiGatewayV1ApiResources {
    "cdd-siri-sx-api": {
      url: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-roadworks-cancelled-notification": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-roadworks-new-notification": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-cleanup-roadworks": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-dynamo-disruption-bulk-migrator": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-dynamo-disruption-incremental-migrator": {
      functionName: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "TNDS_FTP_HOST": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "TNDS_FTP_USERNAME": {
      value: string;
    }
  }
}

import "sst/node/config";
declare module "sst/node/config" {
  export interface SecretResources {
    "TNDS_FTP_PASSWORD": {
      value: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-ref-csv-data": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-ref-txc-data": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-ref-txc-zipped-data": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-ref-nptg-data": {
      bucketName: string;
    }
  }
}

import "sst/node/bucket";
declare module "sst/node/bucket" {
  export interface BucketResources {
    "cdd-ref-bank-holidays-data": {
      bucketName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-ref-data-cleardown-db-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-noc-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-naptan-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-nptg-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-bods-txc-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-tnds-txc-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-bank-holidays-retriever-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-ref-data-unzipper-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-csv-ref-data-uploader-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-nptg-uploader-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-txc-uploader-function": {
      functionName: string;
    }
  }
}

import "sst/node/function";
declare module "sst/node/function" {
  export interface FunctionResources {
    "cdd-ref-data-service-table-renamer-function": {
      functionName: string;
    }
  }
}

