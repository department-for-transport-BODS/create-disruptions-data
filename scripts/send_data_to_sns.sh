#!/bin/bash

set -euo pipefail

usage() {
    echo "Usage: bash $0 <extract_path> <start_month> <end_month> [sns_topic_arn [--limit <count>] [--dry-run]]"
    echo "Months use YYYY-MM format and the range is inclusive."
    echo "Without a topic ARN: prepare only. With a topic ARN: call the Node publisher after preparation."
}

if [[ $# -lt 3 ]]; then
    usage >&2
    exit 1
fi

EXTRACT_PATH="$1"
START_MONTH="$2"
END_MONTH="$3"
shift 3
SNS_TOPIC_ARN="${1:-}"
if [[ $# -gt 0 ]]; then
    shift
fi
PUBLISHER_OPTIONS=("$@")
if [[ -n "$SNS_TOPIC_ARN" ]]; then
    if [[ ! "$SNS_TOPIC_ARN" =~ ^arn:aws:sns:[a-z0-9-]+:[0-9]{12}:[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid SNS topic ARN." >&2
        exit 1
    fi
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) shift ;;
            --limit)
                if [[ $# -lt 2 || ! "$2" =~ ^[1-9][0-9]*$ ]]; then
                    usage >&2
                    exit 1
                fi
                shift 2
                ;;
            *) usage >&2; exit 1 ;;
        esac
    done
    command -v node >/dev/null || { echo "Missing dependency: node" >&2; exit 1; }
fi
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [[ -n "$SNS_TOPIC_ARN" ]] && ! (cd "$SCRIPT_DIR" && node --input-type=module -e 'import("@aws-sdk/client-sns")' >/dev/null 2>&1); then
    echo "The SNS publisher dependency is unavailable. Run: bash scripts/install-publisher-deps.sh" >&2
    exit 1
fi

for month in "$START_MONTH" "$END_MONTH"; do
    if [[ ! "$month" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]]; then
        echo "Invalid month: $month (expected YYYY-MM)" >&2
        exit 1
    fi
done

if [[ "$START_MONTH" > "$END_MONTH" ]]; then
    echo "Start month must not be after end month." >&2
    exit 1
fi

for dependency in curl unzip; do
    command -v "$dependency" >/dev/null || { echo "Missing dependency: $dependency" >&2; exit 1; }
done

mkdir -p "$EXTRACT_PATH"
EXTRACT_PATH=$(cd "$EXTRACT_PATH" && pwd)
STATS_FILE="${STATS_FILE:-$EXTRACT_PATH/replay-stats.txt}"
touch "$STATS_FILE"
echo "Monthly stats file: $STATS_FILE"
LOCK_DIR="$EXTRACT_PATH/.replay-lock"
if ! mkdir "$LOCK_DIR"; then
    echo "Another replay may be using this directory. If it is no longer running, remove $LOCK_DIR and retry." >&2
    exit 1
fi
LOCK_HELD=true
EXTRACTION_PID=""
PUBLISHER_PID=""
cleanup() {
    if [[ -n "$EXTRACTION_PID" ]]; then
        kill "$EXTRACTION_PID" 2>/dev/null || true
        wait "$EXTRACTION_PID" 2>/dev/null || true
    fi
    if [[ -n "$PUBLISHER_PID" ]]; then
        kill "$PUBLISHER_PID" 2>/dev/null || true
        wait "$PUBLISHER_PID" 2>/dev/null || true
    fi
    if [[ "$LOCK_HELD" == true ]]; then
        rmdir "$LOCK_DIR"
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

YEAR=$((10#${START_MONTH:0:4}))
MONTH=$((10#${START_MONTH:5:2}))
TOTAL=0
SKIPPED_MONTHS=""

next_month() {
    if [[ "$MONTH" -eq 12 ]]; then
        YEAR=$((YEAR + 1))
        MONTH=1
    else
        MONTH=$((MONTH + 1))
    fi
}

skip_archive() {
    echo "Unable to unzip $CURRENT_MONTH ($ARCHIVE); skipping this month. Checkpoints unchanged." >&2
    printf 'Month: %s | Stage: preparation | Status: skipped | Reason: unable to unzip\n\n' "$CURRENT_MONTH" >> "$STATS_FILE"
    SKIPPED_MONTHS="$SKIPPED_MONTHS $CURRENT_MONTH"
    next_month
}

while true; do
    printf -v CURRENT_MONTH '%04d-%02d' "$YEAR" "$MONTH"
    if [[ "$CURRENT_MONTH" > "$END_MONTH" ]]; then
        break
    fi

    MONTH_STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    MONTH_STARTED=$SECONDS
    MONTH_DIR="$EXTRACT_PATH/$CURRENT_MONTH"
    mkdir -p "$MONTH_DIR"
    if [[ -f "$MONTH_DIR/checkpoint.json" && ! -f "$MONTH_DIR/archive.zip" ]]; then
        echo "Checkpoint exists but its archive is missing; restore the cached month before resuming." >&2
        exit 1
    fi
    printf -v ZIP_URL 'https://opendata.manage-roadworks.service.gov.uk/permit/%04d/%02d.zip' "$YEAR" "$MONTH"
    if [[ -f "$MONTH_DIR/archive.zip" ]]; then
        echo "Reusing downloaded archive for $CURRENT_MONTH."
    else
        echo "Downloading $ZIP_URL..."
        curl --fail --location --retry 3 --output "$MONTH_DIR/archive.zip.part" "$ZIP_URL"
        mv "$MONTH_DIR/archive.zip.part" "$MONTH_DIR/archive.zip"
    fi

    DOWNLOAD_SECONDS=$((SECONDS - MONTH_STARTED))
    PREPARATION_STARTED=$SECONDS
    ARCHIVE="$MONTH_DIR/archive.zip"
    if ! unzip -tq "$ARCHIVE" > "$MONTH_DIR/unzip-validation.log" 2>&1; then
        skip_archive
        continue
    fi
    CHECKPOINT="$MONTH_DIR/checkpoint.json"
    if [[ -f "$CHECKPOINT" && (! -f "$MONTH_DIR/files" || ! -d "$MONTH_DIR/notifications") ]]; then
        echo "Checkpoint exists but its file list or notifications are missing; restore the cached month before resuming." >&2
        exit 1
    fi
    if [[ ! -d "$MONTH_DIR/notifications" ]]; then
        rm -rf "$MONTH_DIR/notifications.part"
        echo "Extracting $CURRENT_MONTH archive..."
        EXTRACTION_STARTED=$SECONDS
        LAST_EXTRACTION_UPDATE=$SECONDS
        unzip -q "$ARCHIVE" -d "$MONTH_DIR/notifications.part" &
        EXTRACTION_PID=$!
        while kill -0 "$EXTRACTION_PID" 2>/dev/null; do
            if [[ "$((SECONDS - LAST_EXTRACTION_UPDATE))" -ge 30 ]]; then
                echo "Still extracting $CURRENT_MONTH | elapsed: $((SECONDS - EXTRACTION_STARTED))s"
                LAST_EXTRACTION_UPDATE=$SECONDS
            fi
            sleep 1
        done
        if wait "$EXTRACTION_PID"; then
            EXTRACTION_PID=""
        else
            EXTRACTION_PID=""
            skip_archive
            continue
        fi
        mv "$MONTH_DIR/notifications.part" "$MONTH_DIR/notifications"
        echo "Extraction complete for $CURRENT_MONTH in $((SECONDS - EXTRACTION_STARTED))s."
    else
        echo "Reusing extracted notifications for $CURRENT_MONTH."
    fi

    echo "Counting notifications for $CURRENT_MONTH..."
    if [[ ! -f "$MONTH_DIR/files" ]]; then
        find "$MONTH_DIR/notifications" -type f -name '*.json' -print0 > "$MONTH_DIR/files.part"
        mv "$MONTH_DIR/files.part" "$MONTH_DIR/files"
    fi
    MONTH_TOTAL=0
    while IFS= read -r -d '' notification; do
        MONTH_TOTAL=$((MONTH_TOTAL + 1))
    done < "$MONTH_DIR/files"
    if [[ "$MONTH_TOTAL" -eq 0 ]]; then
        echo "No JSON notifications found for $CURRENT_MONTH; stopping." >&2
        exit 1
    fi
    if [[ -n "$SNS_TOPIC_ARN" ]]; then
        echo "Prepared $MONTH_TOTAL notifications for $CURRENT_MONTH. Starting publisher..."
    else
        echo "Prepared $MONTH_TOTAL notifications for $CURRENT_MONTH. No topic ARN supplied; no messages published."
    fi
    PREPARATION_SECONDS=$((SECONDS - PREPARATION_STARTED))
    TOTAL=$((TOTAL + MONTH_TOTAL))
    printf 'Month: %s | Stage: preparation | Started (UTC): %s\nNotifications prepared: %s | Published: 0\nDownload: %ss | Preparation: %ss | Total: %ss\n\n' \
        "$CURRENT_MONTH" "$MONTH_STARTED_AT" "$MONTH_TOTAL" \
        "$DOWNLOAD_SECONDS" "$PREPARATION_SECONDS" "$((SECONDS - MONTH_STARTED))" >> "$STATS_FILE"

    if [[ -n "$SNS_TOPIC_ARN" ]]; then
        rmdir "$LOCK_DIR"
        LOCK_HELD=false
        STATS_FILE="$STATS_FILE" node "$SCRIPT_DIR/publish-street-manager.mjs" \
            "$EXTRACT_PATH" "$CURRENT_MONTH" "$SNS_TOPIC_ARN" "${PUBLISHER_OPTIONS[@]}" &
        PUBLISHER_PID=$!
        if wait "$PUBLISHER_PID"; then
            PUBLISHER_PID=""
        else
            EXIT_CODE=$?
            PUBLISHER_PID=""
            echo "Node publisher stopped for $CURRENT_MONTH; resume using the same directory and topic." >&2
            exit "$EXIT_CODE"
        fi
        if ! mkdir "$LOCK_DIR"; then
            echo "Another process acquired the replay directory; stopping." >&2
            exit 1
        fi
        LOCK_HELD=true
    fi
    next_month
done

echo "Done: $TOTAL notifications prepared."
if [[ -n "$SKIPPED_MONTHS" ]]; then
    echo "Skipped months:$SKIPPED_MONTHS (unable to unzip)." >&2
    exit 2
fi