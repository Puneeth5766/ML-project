const fs = require("fs");
const path = require("path");
const zstd = require("@mongodb-js/zstd");
const lz4 = require("lz4");
const lzma = require("lzma-native");
const crypto = require("crypto");

const {
    SAMPLE_SIZE,
    CHUNK_SIZE,
    SMALL_FILE_THRESHOLD,
    ZSTD_LEVEL,
    LZMA_PRESET
} = require("../shared/config");

const {
    analyzeCompressibility,
    chooseCompression,
    collectFiles
} = require("../shared/compress_utils");

const ProgressTracker = require("../shared/progress");


function analyzeFile([fullPath, relPath]) {

    if (!fs.statSync(fullPath).isFile())
        return null;

    const size = fs.statSync(fullPath).size;

    const fd = fs.openSync(fullPath, "r");
    const buffer = Buffer.alloc(SAMPLE_SIZE);
    const bytesRead = fs.readSync(fd, buffer, 0, SAMPLE_SIZE, 0);
    fs.closeSync(fd);

    const sample = buffer.slice(0, bytesRead);

    const method =
        chooseCompression(
            analyzeCompressibility(sample),
            size,
            SMALL_FILE_THRESHOLD
        );

    return [fullPath, relPath, method];
}


async function compressChunk(chunk, method) {

    if (method === "zstd") {
        return await zstd.compress(chunk, ZSTD_LEVEL);
    }

    if (method === "lz4") {
        return lz4.encode(chunk);
    }

    if (method === "lzma") {
        return await new Promise((resolve, reject) => {
            lzma.compress(
                chunk,
                { preset: LZMA_PRESET },
                (result, error) => {
                    if (error) reject(error);
                    else resolve(Buffer.from(result));
                }
            );
        });
    }

    return chunk;
}


async function compressFileStream(fullPath, method, archiveFd) {

    const checksum = crypto.createHash("sha256");

    let originalSize = 0;
    let compressedSize = 0;

    const offset = fs.fstatSync(archiveFd).size;

    const readStream = fs.createReadStream(fullPath, {
        highWaterMark: CHUNK_SIZE
    });

    for await (const chunk of readStream) {

        originalSize += chunk.length;
        checksum.update(chunk);

        const compChunk =
            await compressChunk(chunk, method);

        fs.writeSync(archiveFd, compChunk);
        compressedSize += compChunk.length;
    }

    return [
        originalSize,
        compressedSize,
        checksum.digest("hex"),
        offset
    ];
}


async function createArchive(inputPath, outputFile) {

    const start = Date.now();

    let files;

    if (fs.statSync(inputPath).isFile())
        files = [[inputPath, path.basename(inputPath)]];
    else
        files = collectFiles(inputPath);

    const totalBytes =
        files.reduce(
            (sum, f) =>
                sum + fs.statSync(f[0]).size,
            0
        );

    const progress =
        new ProgressTracker(totalBytes, files.length);

    const manifest = [];

    const archiveFd =
        fs.openSync(outputFile, "w");

    for (const f of files) {

        const result = analyzeFile(f);
        if (!result) continue;

        const [fullPath, relPath, method] = result;


        const [
            originalSize,
            compressedSize,
            checksum,
            offset
        ] =
            await compressFileStream(
                fullPath,
                method,
                archiveFd
            );

        manifest.push({
            path: relPath,
            method,
            original_size: originalSize,
            compressed_size: compressedSize,
            checksum,
            offset
        });

        progress.update(originalSize, 1);
    }

    const manifestBytes =
        Buffer.from(JSON.stringify(manifest));

    fs.writeSync(archiveFd, manifestBytes);

    const footer =
        Buffer.alloc(8);

    footer.writeBigUInt64BE(
        BigInt(manifestBytes.length)
    );

    fs.writeSync(archiveFd, footer);

    fs.closeSync(archiveFd);

    const end = Date.now();
    const finalSize =
        fs.statSync(outputFile).size;

    const ratio =
        (1 - finalSize / totalBytes) * 100;

    console.log(`\nCompression finished in ${(end - start) / 1000}s`);
    console.log(`Original Size   : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Compressed Size : ${(finalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Compression Ratio: ${ratio.toFixed(2)}%`);
}


module.exports = { createArchive };
