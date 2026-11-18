# Street Manager notification backfill

`send_data_to_sns.sh` downloads and extracts monthly [permit notification archives](https://department-for-transport-streetmanager.github.io/street-manager-docs/archived-notifications/#permit/). With a topic ARN, it publishes the unchanged JSON notifications through `publish-street-manager.mjs`.

Because the publisher runs independently of the disruption service, install its AWS SDK dependency locally without changing package manifests or lockfiles:

```bash
bash scripts/install-publisher-deps.sh
```

## Before you start

- Preparation requires Bash, `curl` and `unzip`; publishing also requires Node.js 20+, workspace dependencies, and AWS credentials with `sns:Publish` on the target topic.
- Allow enough disk space for cached archives and extracted notifications. September 2025 is approximately 1 GB compressed.
- Deploy and verify the ingestion fix first. Confirm the final month against the production fix release date; September 2025 through August 2026 is provisional and inclusive.

Always test in pre-prod first. Use that stage's `street-manager-test-topic-<stage>` topic and confirm its HTTPS subscription targets that environment's `/street-manager` endpoint. Do not use the external Street Manager topic for pre-prod; it may have production subscribers.

The API validates SNS signatures and allowlists topic ARNs. Production currently has no local replay topic and only accepts the external Street Manager production topic. Before production replay, arrange an authorised route to an accepted topic or separately approve a dedicated allowlisted replay topic; an arbitrary ARN will not work.

## Replay

Set the pre-prod profile and verified topic ARN, then check the AWS account and subscription:

```bash
export AWS_PROFILE=preprod
export SNS_TOPIC_ARN=<verified-preprod-topic-arn>
aws sts get-caller-identity
aws sns list-subscriptions-by-topic --topic-arn "$SNS_TOPIC_ARN" --region eu-west-2
```

Prepare only (no topic ARN):

```bash
bash scripts/send_data_to_sns.sh /tmp/street-manager-replay 2025-10 2025-10
```

Publish a sample, then the remaining inclusive month range after checking the target and monitoring:

```bash
bash scripts/send_data_to_sns.sh /tmp/street-manager-replay 2025-10 2025-10 "$SNS_TOPIC_ARN" --limit 1000
bash scripts/send_data_to_sns.sh /tmp/street-manager-replay 2025-10 2026-08 "$SNS_TOPIC_ARN"
```

Months run chronologically and are cached under `<extract_path>/YYYY-MM/`. Re-running with the same directory and topic reuses the cache and resumes from the local checkpoint. `--limit <count>` limits additional notifications per month; `--dry-run` validates JSON without publishing or changing checkpoints.

Use a separate extraction directory per environment. Keep cached data outside the repository; do not edit or partially delete a cached month. Only run one replay per directory. ZIP validation/extraction failures skip that month and produce exit code 2; download, validation, or publishing errors stop the run.

SNS acceptance is not proof of delivery or database ingestion. A retry after interruption can resend up to one batch, so replay is not exactly-once. Delivery and queue processing are asynchronous; month order does not guarantee database update order.

## Monthly Timing Log

Each month appends timing and notification counts to `replay-stats.txt` in the extraction directory. Set `STATS_FILE` to keep logs elsewhere:

```bash
AWS_PROFILE=preprod STATS_FILE="$HOME/street-manager-preprod-stats.txt" \
    bash scripts/send_data_to_sns.sh /tmp/street-manager-replay 2025-09 2025-09 "$SNS_TOPIC_ARN"
```

Processing time ends at SNS acceptance, not database ingestion. Dry-run timings are not publishing benchmarks.

## Verify Ingestion

Before replaying more months or production, verify delivery and ingestion:

1. Check the `ref-data-service-post-street-manager-function-<stage>` and `packages/street-manager-uploader/index.main` CloudWatch logs for errors and successful processing.
2. Monitor SNS failed deliveries and the Street Manager queue backlog/message age; wait for processing to finish.
3. Compare representative archived permits, including Cheshire West, with the latest expected values in the pre-prod database:

```sql
SELECT permit_reference_number, last_updated_date_time, permit_status,
       work_status, proposed_end_date_time, actual_end_date_time
FROM roadworks
WHERE permit_reference_number IN ('REPLACE_WITH_ARCHIVED_PERMIT_REFERENCE');
```

4. Confirm the roadworks appear in the service. Database row counts will not match notification counts: permits have multiple updates and daily cleanup removes qualifying old roadworks.
