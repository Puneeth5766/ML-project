const { parentPort } = require("worker_threads");
const crypto = require("crypto");
const zstd = require("@mongodb-js/zstd");
const zlib = require("zlib");
const { promisify } = require("util");
const brotliDecompress = promisify(zlib.brotliDecompress);

async function decompressChunk(data, method) {
    if (method === "zstd") {
        try {
            return await zstd.decompress(data);
        } catch (e) {
            // If fallback wasn't communicated, this will fail.
            // But if we encode using brotli for lz4 requests, decode accordingly
            return await brotliDecompress(data);
        }
    }
    if (method === "lz4" || method === "lzma") {
        return await brotliDecompress(data);
    }
    return data;
}

parentPort.on("message", async (job) => {
    try {
        const { encrypted, index, iv, tag, key, method } = job;

        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);

        const compressed = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        const plain = await decompressChunk(compressed, method);

        parentPort.postMessage({
            index,
            plain
        });
    } catch (err) {
        parentPort.postMessage({
            error: err.message
        });
    }
});
