import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile, realpath, rename, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PublishBatchCommand, SNSClient } from "@aws-sdk/client-sns";

async function* notificationPaths(manifest) {
    let pending = "";
    for await (const chunk of createReadStream(manifest, { encoding: "utf8" })) {
        const filenames = (pending + chunk).split("\0");
        pending = filenames.pop();
        yield* filenames;
    }
    if (pending) throw new Error("Cached file list is incomplete; expected a final NUL separator.");
}

async function main() {
    const [extractPath, month, topicArn, ...options] = process.argv.slice(2);
    let limit = Number.POSITIVE_INFINITY;
    let dryRun = false;
    for (let index = 0; index < options.length; index++) {
        if (options[index] === "--dry-run") dryRun = true;
        else if (options[index] === "--limit" && /^[1-9][0-9]*$/.test(options[index + 1] ?? ""))
            limit = Number(options[++index]);
        else throw new Error("Expected --dry-run or --limit <positive integer>.");
    }
    const topic = /^arn:aws:sns:([a-z0-9-]+):[0-9]{12}:[a-zA-Z0-9_-]+$/.exec(topicArn ?? "");
    if (
        !extractPath ||
        !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month ?? "") ||
        !topic ||
        (limit !== Number.POSITIVE_INFINITY && !Number.isSafeInteger(limit))
    ) {
        throw new Error(
            "Usage: node scripts/publish-street-manager.mjs <extract_path> <YYYY-MM> <sns_topic_arn> [--limit <count>] [--dry-run]",
        );
    }

    const directory = await realpath(extractPath);
    const lock = path.join(directory, ".replay-lock");
    try {
        await mkdir(lock);
    } catch (error) {
        if (error.code === "EEXIST") throw new Error("Replay directory is locked; do not run Bash and Node together.");
        throw error;
    }
    const monthDirectory = path.join(directory, month);
    const manifest = path.join(monthDirectory, "files");
    const checkpoint = path.join(monthDirectory, "checkpoint.json");
    const statsFile = process.env.STATS_FILE ?? path.join(directory, "replay-stats.txt");
    const client = new SNSClient({ region: topic[1], maxAttempts: 3 });
    let stopping = false;
    const stop = () => {
        stopping = true;
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    let total = 0;
    let count = 0;
    let initialCount = 0;
    let accepted = 0;
    let started;
    let startedAt;
    let status = "failed";

    try {
        if (
            !(await stat(path.join(monthDirectory, "archive.zip"))).isFile() ||
            !(await stat(path.join(monthDirectory, "notifications"))).isDirectory()
        ) {
            throw new Error(
                "This command requires the cached archive, extracted notifications and file list from Bash.",
            );
        }
        await appendFile(statsFile, "");
        for await (const filename of notificationPaths(manifest)) {
            if (stopping) {
                process.exitCode = 130;
                return;
            }
            if (!filename) throw new Error("Cached file list contains an empty filename.");
            total++;
        }
        if (!total) throw new Error("No cached notifications found.");
        if (!dryRun) {
            let saved;
            try {
                saved = JSON.parse(await readFile(checkpoint, "utf8"));
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
            if (saved) {
                if (
                    saved.topicArn !== topicArn ||
                    !Number.isSafeInteger(saved.count) ||
                    saved.count < 0 ||
                    saved.count > total
                ) {
                    throw new Error(
                        "Invalid checkpoint or different target topic; use a separate directory per environment.",
                    );
                }
                count = saved.count;
            }
        }
        initialCount = count;
        started = performance.now();
        startedAt = new Date().toISOString();
        let entries = [];
        let batchBytes = 0;
        const flush = async () => {
            if (!entries.length || stopping) return;
            let consecutive = entries.length;
            if (!dryRun) {
                const response = await client.send(
                    new PublishBatchCommand({ TopicArn: topicArn, PublishBatchRequestEntries: entries }),
                );
                const successful = response.Successful ?? [];
                const failed = response.Failed ?? [];
                if (!Array.isArray(successful) || !Array.isArray(failed))
                    throw new Error("Invalid SNS batch response; checkpoint unchanged for this batch.");
                const expected = new Set(entries.map((entry) => entry.Id));
                const results = [...successful, ...failed];
                if (
                    results.length !== entries.length ||
                    new Set(results.map((entry) => entry?.Id)).size !== entries.length ||
                    results.some((entry) => !expected.has(entry?.Id)) ||
                    successful.some((entry) => typeof entry.MessageId !== "string" || !entry.MessageId.length)
                ) {
                    throw new Error(
                        "SNS acceptance could not be confirmed; messages may have been accepted. Checkpoint unchanged for this batch.",
                    );
                }
                accepted += successful.length;
                const successfulIds = new Set(successful.map((entry) => entry.Id));
                consecutive = 0;
                for (const entry of entries) {
                    if (!successfulIds.has(entry.Id)) break;
                    consecutive++;
                }
            }
            count += consecutive;
            if (!dryRun && consecutive) {
                await writeFile(`${checkpoint}.part`, JSON.stringify({ topicArn, count }));
                await rename(`${checkpoint}.part`, checkpoint);
            }
            if (consecutive !== entries.length)
                throw new Error(
                    `SNS batch partially failed; checkpoint saved at ${count}/${total}. Later successful entries may be resent on retry.`,
                );
            entries = [];
            batchBytes = 0;
        };

        let fileIndex = 0;
        let selected = 0;
        for await (const filename of notificationPaths(manifest)) {
            if (stopping || selected >= limit) break;
            fileIndex++;
            if (fileIndex <= initialCount) continue;
            const bytes = await readFile(filename);
            if (bytes.length > 262144) throw new Error(`Notification exceeds the SNS 256 KiB limit: ${filename}`);
            const message = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
            const parsed = JSON.parse(message);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
                throw new Error(`Expected one JSON object: ${filename}`);
            if (batchBytes + bytes.length > 262144) await flush();
            if (stopping) break;
            entries.push({ Id: String(fileIndex), Message: message });
            batchBytes += bytes.length;
            selected++;
            if (entries.length === 10) await flush();
        }
        await flush();
        status = stopping ? "interrupted" : count === total ? "completed" : "limit reached";
        if (stopping) process.exitCode = 130;
    } finally {
        try {
            if (started !== undefined) {
                const elapsed = (performance.now() - started) / 1000;
                const processed = count - initialCount;
                const rate = processed / Math.max(elapsed, 0.001);
                await appendFile(
                    statsFile,
                    `Month: ${month} | Publisher: Node SDK | Status: ${status} | Started (UTC): ${startedAt} | Dry run: ${dryRun}\nNotifications: ${count}/${total} checkpointed | SNS accepted this run: ${accepted}\nResumed from: ${initialCount} | Processed this run: ${processed}\nProcessing: ${elapsed.toFixed(2)}s | Rate: ${rate.toFixed(2)} notifications/s\n\n`,
                );
            }
        } finally {
            client.destroy();
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
            await rmdir(lock);
        }
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
