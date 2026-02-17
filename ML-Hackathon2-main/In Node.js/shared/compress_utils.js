const fs = require("fs");
const path = require("path");

function cleanPath(p) {
    return p.trim().replace(/^["']|["']$/g, "");
}

function estimateEntropy(data) {
    if (!data.length) return 0.0;

    const freq = new Array(256).fill(0);

    for (const b of data)
        freq[b]++;

    let entropy = 0;
    const length = data.length;

    for (const c of freq) {
        if (c) {
            const p = c / length;
            entropy -= p * Math.log2(p);
        }
    }

    return entropy;
}

function analyzeCompressibility(data) {
    const entropy = estimateEntropy(data);
    const uniqueBytes = new Set(data).size;
    const repetitionRatio = 1 - (uniqueBytes / 256);

    return {
        entropy,
        repetition_ratio: repetitionRatio
    };
}

function chooseCompression(analysis, size, smallThreshold) {

    if (size < smallThreshold)
        return "zstd";

    if (analysis.entropy > 7.2)
        return "lz4";

    if (analysis.entropy < 5.0 ||
        analysis.repetition_ratio > 0.7)
        return "lzma";

    return "zstd";
}

function collectFiles(basePath) {

    const files = [];

    function walk(currentPath) {

        const entries =
            fs.readdirSync(currentPath, {
                withFileTypes: true
            });

        for (const entry of entries) {

            const full =
                path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile()) {
                const rel =
                    path.relative(basePath, full);
                files.push([full, rel]);
            }
        }
    }

    walk(basePath);
    return files;
}


module.exports = {
    cleanPath,
    analyzeCompressibility,
    chooseCompression,
    collectFiles
};
