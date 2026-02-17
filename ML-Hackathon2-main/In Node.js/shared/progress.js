class ProgressTracker {

    constructor(totalBytes, totalFiles) {

        this.doneBytes = 0;
        this.doneFiles = 0;
        this.totalBytes = totalBytes;
        this.totalFiles = totalFiles;
        this.startTime = Date.now();
    }

    update(bytesProcessed, filesCompleted = 0) {

        this.doneBytes += bytesProcessed;
        this.doneFiles += filesCompleted;

        const percent =
            this.totalBytes
                ? this.doneBytes / this.totalBytes
                : 0;

        const elapsed =
            (Date.now() - this.startTime) / 1000;

        const speed =
            elapsed > 0
                ? (this.doneBytes / (1024 * 1024)) / elapsed
                : 0;

        const remaining =
            Math.max(
                this.totalBytes - this.doneBytes,
                0
            );

        const eta =
            speed > 0
                ? (remaining / (1024 * 1024)) / speed
                : 0;

        const filled =
            Math.floor(40 * percent);

        const bar =
            "=".repeat(filled) +
            "-".repeat(40 - filled);

        process.stdout.write(
            `\r[${bar}] ${(percent * 100).toFixed(2)}% ` +
            `${speed.toFixed(2)} MB/s ETA: ${eta.toFixed(1)}s ` +
            `(${this.doneFiles}/${this.totalFiles})`
        );
    }
}

module.exports = ProgressTracker;
