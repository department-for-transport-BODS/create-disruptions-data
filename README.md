# Create Disruptions Data

This repo serves as the monorepo for the Create Disruptions Data service. It comprises the following components:

-   Create Disruptions Data Site
-   SIRI-SX Generator
-   SIRI-SX Validator
-   SIRI-SX API

## Running locally

The site is deployed using [SST](https://sst.dev/), this allows the creation of a dev environment that is deployed into AWS.

### Requirements

- Node.js 22+
- pnpm 9+
- Docker
- awscli

### Process

-   Authenticate against the target AWS account
-   In the root of the project, run the following make command to install all dependencies:
```bash
make install-deps
```

-   Start the sst infrastructure:

    Note - When you first run this command sst will ask for a stage name for your dev stage and will deploy the required infrastructure into the target AWS account.
```bash
make start-sst
```

- This project uses RDS for its database - for local development a shared RDS instance will be created in the target AWS environment with each developer having their own tables within the single instance. In order to create your database for local development run the following command in a separate terminal window:
```bash
make setup-dev
```

-  Run the following command to create a bastion tunnel to establish a connection to your local database:
```bash
make bastion-tunnel
```

-   Finally, in another terminal start the site using the below make command, which will start the site at `http://localhost:3000`:
```bash
make start-site
```

### Issues

-   There is a known issue where the site process does not stop correctly and so continues to run on port 3000 in the background, this will lead to a port conflict error where the site will start on port 3001. To prevent this, run `make kill-site` to stop the process

## Components

### Site

The site is built using Next.js which runs in a serverless fashion using [OpenNext](https://github.com/sst/open-next). This is deployed using SST but needs to be ran manually (using `make start-site`) when running locally due to the time it takes to deploy the site into AWS. This can be bypassed so the site is deployed on all changes by updating `deploy: false` to `deploy: true` in the [Site Stack](./stacks/SiteStack.ts).

### SIRI-SX Generator

This TypeScript Lambda runs every 10 minutes (1 minute in prod). It retrieves all the disruptions data from the database and generates the SIRI-SX XML which it stores in S3. This can also be triggered by running `make trigger-siri-generator`.

### SIRI-SX Validator

This Python Lambda triggers every time a new SIRI-SX file is generated and stored in S3. It runs the file against the SIRI-SX XSD to make sure it conforms to the required structure and then saves the file to another S3 bucket.

### SIRI-SX API

This uses AWS API Gateway to expose an endpoint that proxies through to the S3 bucket and retrieves the contents of the SIRI-SX file. It is protected using API keys.
