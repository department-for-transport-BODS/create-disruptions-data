#!/bin/bash

set -e

stage=${1:-}

if [ -z "$1" ]; then
    echo "Usage: $0 <stage>"
    exit 1
fi

envs=("sandbox" "test" "preprod" "prod")

is_user_env=true
db_name=$stage

for item in "${envs[@]}"; do
    if [ "$item" == "$stage" ]; then
        is_user_env=false
        db_name="disruptions"
        break
    fi
done

SECRET_ARN=$(aws secretsmanager list-secrets --query "SecretList[?starts_with(Name, 'rds!cluster')].ARN" --output text)

aws secretsmanager cancel-rotate-secret --secret-id $SECRET_ARN > /dev/null

secret=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN | jq -r '.SecretString')

username=$(echo $secret | jq -r '.username')
password=$(echo $secret | jq -r '.password')

encoded_password=$(printf %s "$password" | jq -rR @uri)

if [ "$is_user_env" = true ]; then
    pnpm sst secrets set DB_SITE_HOST localhost --stage $stage
    pnpm sst secrets set DB_SITE_PORT 35432 --stage $stage

    echo "DATABASE_URL=postgresql://${username}:${encoded_password}@localhost:35432/$db_name" > "$(dirname "$0")/../shared-ts/.env"
else
    pnpm sst secrets set DB_SITE_HOST db.cdd.internal --stage $stage
    pnpm sst secrets set DB_SITE_PORT 5432 --stage $stage
fi

pnpm sst secrets set DB_HOST db.cdd.internal --stage $stage
pnpm sst secrets set DB_RO_HOST db-ro.cdd.internal --stage $stage
pnpm sst secrets set DB_PORT 5432 --stage $stage
pnpm sst secrets set DB_USERNAME $username --stage $stage
pnpm sst secrets set DB_PASSWORD $password --stage $stage
pnpm sst secrets set DB_NAME $db_name --stage $stage
pnpm sst secrets set SUPPORT_EMAIL dummy@email.com --stage $stage
pnpm sst secrets set SUPPORT_PHONE 0123456789 --stage $stage

