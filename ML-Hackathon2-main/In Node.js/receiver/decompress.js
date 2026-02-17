const fs = require("fs");
const crypto = require("crypto");
const zstd = require("@mongodb-js/zstd");
const lz4 = require("lz4");
const lzma = require("lzma-native");
const { CHUNK_SIZE } = require("../shared/config");
const ProgressTracker = require("../shared/progress");

async function extractArchive(archiveFile, outputFolder) {

    const start = Date.now();

    const archive =
        fs.readFileSync(archiveFile);

    const manifestSize =
        Number(
            archive.readBigUInt64BE(
                archive.length - 8
            )
        );

    const manifestStart =
        archive.length - 8 - manifestSize;

    const manifest =
        JSON.parse(
            archive
                .slice(manifestStart, manifestStart + manifestSize)
                .toString()
        );

    const totalBytes =
        manifest.reduce((s, e) => s + e.original_size, 0);

    const progress =
        new ProgressTracker(totalBytes, manifest.length);

    for (const entry of manifest) {

        const outPath =
            require("path").join(outputFolder, entry.path);

        fs.mkdirSync(
            require("path").dirname(outPath),
            { recursive: true }
        );

        const fd =
            fs.openSync(archiveFile, "r");

        const buffer =
            Buffer.alloc(entry.compressed_size);

        fs.readSync(
            fd,
            buffer,
            0,
            entry.compressed_size,
            entry.offset
        );

        fs.closeSync(fd);

        let data = buffer;

        if (entry.method === "zstd")
            data = await zstd.decompress(buffer);
        else if (entry.method === "lz4")
            data = lz4.decode(buffer);
        else if (entry.method === "lzma")
            data = await new Promise(resolve =>
                lzma.decompress(buffer, resolve)
            );

        const checksum =
            crypto.createHash("sha256")
                .update(data)
                .digest("hex");

        if (checksum !== entry.checksum)
            console.log(`Checksum mismatch: ${entry.path}`);

        fs.writeFileSync(outPath, data);

        progress.update(entry.original_size, 1);
    }

    const end = Date.now();
    console.log(`\nExtraction finished in ${(end - start) / 1000}s`);
}
