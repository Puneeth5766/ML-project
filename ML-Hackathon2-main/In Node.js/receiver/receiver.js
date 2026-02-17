const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    MAX_WORKERS
} = require("../shared/config");

const ProgressTracker =
    require("../shared/progress");

const WorkerPool =
    require("./workerPool");

const FILE_START = 1;
const FILE_CHUNK = 2;
const FILE_END = 3;

async function receiveFile(inputStream, outputFolder, key) {

    const startTime = Date.now();

    // 🔥 FIX 1: If file path is passed, convert to stream
    if (typeof inputStream === "string") {
        inputStream = fs.createReadStream(inputStream);
    }

    const pool =
        new WorkerPool(MAX_WORKERS);

    const readStream = inputStream;

    let buffer = Buffer.alloc(0);

    let currentWriteStream = null;
    let method = "zstd";

    let originalTotal = 0;
    let encryptedTotal = 0;

    const allJobs = [];

    let currentHash = null;
    let expectedChecksum = null;
    let currentFileJobs = [];
    let nextChunkIndex = 0;
    const pendingChunks = new Map();
    let currentPath = "";

    const results = [];

    const processPendingChunks = () => {
        while (pendingChunks.has(nextChunkIndex)) {
            const chunkData = pendingChunks.get(nextChunkIndex);
            pendingChunks.delete(nextChunkIndex);

            const plain = Buffer.from(chunkData);
            originalTotal += plain.length;

            if (currentHash) currentHash.update(plain);
            if (currentWriteStream) currentWriteStream.write(plain);

            nextChunkIndex++;
        }
    };

    for await (const chunk of readStream) {

        // 🔥 FIX 2: ensure chunk is always Buffer
        const safeChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        buffer = Buffer.concat([buffer, safeChunk]);

        while (buffer.length > 0) {

            const type = buffer.readUInt8(0);

            // ---------- FILE START ----------
            if (type === FILE_START) {

                if (buffer.length < 5) break;

                const pathLen = buffer.readUInt32BE(1);
                const headerSize = 46 + pathLen;

                if (buffer.length < headerSize)
                    break;

                const relPathRaw = buffer.slice(5, 5 + pathLen).toString();

                let relPath = relPathRaw;
                if (relPath.endsWith(".enc.bin")) {
                    relPath = relPath.slice(0, -8);
                } else if (relPath.endsWith(".enc")) {
                    relPath = relPath.slice(0, -4);
                } else if (relPath.endsWith(".bin")) {
                    relPath = relPath.slice(0, -4);
                }

                currentPath = relPath;

                const fileSize = buffer.readBigUInt64BE(5 + pathLen);

                const methodCode =
                    buffer.readUInt8(5 + pathLen + 8);

                method =
                    methodCode === 1 ? "zstd" :
                    methodCode === 2 ? "lz4" : "lzma";

                expectedChecksum =
                    buffer.slice(5 + pathLen + 9, 5 + pathLen + 9 + 32);

                const fullPath =
                    path.join(outputFolder, relPath);

                fs.mkdirSync(
                    path.dirname(fullPath),
                    { recursive: true }
                );

                currentWriteStream =
                    fs.createWriteStream(fullPath);

                currentHash = crypto.createHash("sha256");
                nextChunkIndex = 0;
                pendingChunks.clear();
                currentFileJobs = [];

                buffer = buffer.slice(headerSize);
            }

            // ---------- FILE CHUNK ----------
            else if (type === FILE_CHUNK) {

                if (buffer.length < 37) break;

                const index =
                    buffer.readUInt32BE(1);

                const length =
                    buffer.readUInt32BE(5);

                if (buffer.length < 37 + length)
                    break;

                const iv =
                    buffer.slice(9, 21);

                const tag =
                    buffer.slice(21, 37);

                const encrypted =
                    buffer.slice(37, 37 + length);

                encryptedTotal += encrypted.length;

                buffer =
                    buffer.slice(37 + length);

                const job =
                    pool.run({
                        encrypted,
                        index,
                        iv,
                        tag,
                        key,
                        method
                    }).then(result => {

                        // 🔥 SAFETY: ensure plain is Buffer
                        const plain =
                            Buffer.isBuffer(result.plain)
                                ? result.plain
                                : Buffer.from(result.plain);

                        pendingChunks.set(index, plain);
                        processPendingChunks();
                    });

                currentFileJobs.push(job);
                allJobs.push(job);
            }

            // ---------- FILE END ----------
            else if (type === FILE_END) {

                await Promise.all(currentFileJobs);

                processPendingChunks();

                if (currentWriteStream)
                    currentWriteStream.end();

                let verificationStatus = "Mismatch";
                if (currentHash && expectedChecksum) {
                    const calculated = currentHash.digest();
                    if (calculated.equals(expectedChecksum)) {
                        verificationStatus = "Match";
                    }
                }

                results.push({
                    file: currentPath,
                    verification: verificationStatus
                });

                buffer = buffer.slice(1);

                currentWriteStream = null;
                currentHash = null;
                currentFileJobs = [];
            }

            else {
                break;
            }
        }
    }

    await Promise.all(allJobs);

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    const ratio =
        originalTotal > 0
            ? (1 - encryptedTotal / originalTotal) * 100
            : 0;

    console.log("\n--- Receiver Summary ---");
    console.log(
        "Decrypted Size:",
        (originalTotal / (1024 * 1024)).toFixed(2),
        "MB"
    );

    console.log(
        "Encrypted Size:",
        (encryptedTotal / (1024 * 1024)).toFixed(2),
        "MB"
    );

    console.log(
        "Compression Ratio:",
        ratio.toFixed(2) + "%"
    );

    console.log(
        "Total Time:",
        totalTime.toFixed(2),
        "seconds"
    );

    console.log("Integrity Check Results:");
    let allValid = true;
    results.forEach(r => {
        console.log(` - ${r.file}: ${r.verification}`);
        if (r.verification !== "Match") allValid = false;
    });

    console.log("Decryption: AES-256-GCM");
    console.log("Key Exchange: X25519 + HKDF-SHA256");
    console.log(`Integrity: ${allValid ? "Verified (SHA-256 + GCM)" : "FAILED"}`);

    return {
        originalTotal,
        encryptedTotal,
        ratio,
        totalTime,
        verificationResults: results
    };
}

module.exports = { receiveFile };
