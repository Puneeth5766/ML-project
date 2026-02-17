const { parentPort } = require("worker_threads");
const crypto = require("crypto");
// Using native Node.js zlib (Brotli) instead of external native modules to ensure stability
const zlib = require("zlib");
const { promisify } = require("util");
const brotliCompress = promisify(zlib.brotliCompress);

parentPort.on("message", async (job) => {
    try {
        const { chunk, index, method, key } = job;

        // Force Brolti for stability, ignoring "method" string unless we want to map it
        // We will treat "zstd" request as Brotli here to avoid dependency issues
        const compressed = await brotliCompress(chunk);

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

        const encrypted = Buffer.concat([
            cipher.update(compressed),
            cipher.final()
        ]);

        const tag = cipher.getAuthTag();

        parentPort.postMessage({
            index,
            iv,
            tag,
            encrypted,
            length: encrypted.length
        });
    } catch (err) {
        parentPort.postMessage({
            error: err.message
        });
    }
});
