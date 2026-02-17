const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    CHUNK_SIZE,
    MAX_WORKERS
} = require("../shared/config");

const {
    collectFiles
} = require("../shared/utils");

const ProgressTracker =
    require("../shared/progress");

const WorkerPool =
    require("./workerPool");

const FILE_START = 1;
const FILE_CHUNK = 2;
const FILE_END = 3;

async function calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("error", err => reject(err));
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest()));
    });
}

// ✅ FIXED FUNCTION (supports file path + socket)
async function sendFile(inputPath, outputStream, key, method) {

    const startTime = Date.now();

    // 🔥 SUPPORT BOTH FILE & SOCKET
    let writeStream;
    if (typeof outputStream === "string") {
        writeStream = fs.createWriteStream(outputStream);
    } else {
        writeStream = outputStream; // socket
    }

    const stat = fs.statSync(inputPath);

    let files;

    if (stat.isFile()) {
        files = [[inputPath, path.basename(inputPath)]];
    } else {
        files = collectFiles(inputPath);
    }

    const totalBytes =
        files.reduce(
            (s, f) =>
                s + fs.statSync(f[0]).size,
            0
        );

    const progress =
        new ProgressTracker(totalBytes, files.length);

    const pool =
        new WorkerPool(MAX_WORKERS);

    let originalTotal = 0;
    let encryptedTotal = 0;

    const allJobs = [];

    for (const [fullPath, relPath] of files) {

        // Calculate checksum
        const checksum = await calculateChecksum(fullPath);
        const fileSize = fs.statSync(fullPath).size;

        // ---------- FILE START ----------
        const pathBuffer = Buffer.from(relPath);
        const nameLen = pathBuffer.length;

        const headerLen = 1 + 4 + nameLen + 8 + 1 + 32;
        const startHeader = Buffer.alloc(headerLen);

        startHeader.writeUInt8(FILE_START, 0);
        startHeader.writeUInt32BE(nameLen, 1);
        pathBuffer.copy(startHeader, 5);

        startHeader.writeBigUInt64BE(BigInt(fileSize), 5 + nameLen);

        const methodCode =
            method === "zstd" ? 1 :
            method === "lz4" ? 2 : 3;

        startHeader.writeUInt8(methodCode, 5 + nameLen + 8);

        checksum.copy(startHeader, 5 + nameLen + 8 + 1);

        // write header
        writeStream.write(startHeader);

        // ---------- FILE STREAM ----------
        const readStream =
            fs.createReadStream(fullPath, {
                highWaterMark: CHUNK_SIZE
            });

        let index = 0;
        const pending = new Map();
        let next = 0;

        for await (const chunk of readStream) {

            originalTotal += chunk.length;

            const job =
                pool.run({
                    chunk,
                    index,
                    method,
                    key
                }).then(result => {

                    pending.set(result.index, result);

                    while (pending.has(next)) {

                        const r = pending.get(next);

                        const iv = Buffer.from(r.iv);
                        const tag = Buffer.from(r.tag);
                        const encrypted = Buffer.from(r.encrypted);

                        encryptedTotal += encrypted.length;

                        const header =
                            Buffer.alloc(1 + 4 + 4 + 12 + 16);

                        header.writeUInt8(FILE_CHUNK, 0);
                        header.writeUInt32BE(r.index, 1);
                        header.writeUInt32BE(encrypted.length, 5);

                        iv.copy(header, 9);
                        tag.copy(header, 21);

                        writeStream.write(
                            Buffer.concat([
                                header,
                                encrypted
                            ])
                        );

                        pending.delete(next);
                        next++;
                    }
                });

            allJobs.push(job);

            progress.update(chunk.length);
            index++;
        }

        await Promise.all(allJobs);

        // ---------- FILE END ----------
        writeStream.write(Buffer.from([FILE_END]));
    }

    await Promise.all(allJobs);

    await pool.close();

    // 🔥 close ONLY if file output
    if (typeof outputStream === "string") {
        writeStream.end();
    }

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    const ratio =
        originalTotal > 0
            ? (1 - encryptedTotal / originalTotal) * 100
            : 0;

    return {
        originalTotal,
        encryptedTotal,
        ratio,
        totalTime
    };
}

module.exports = { sendFile };
