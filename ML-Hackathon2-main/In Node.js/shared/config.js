const os = require("os");

const SAMPLE_SIZE = 64 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024;

const MAX_WORKERS = os.cpus().length;
const IO_WORKERS = Math.max(1, Math.floor(MAX_WORKERS / 2));

const SMALL_FILE_THRESHOLD = 128 * 1024;

const LZMA_PRESET = 2;
const ZSTD_LEVEL = 3;

module.exports = {
    SAMPLE_SIZE,
    CHUNK_SIZE,
    MAX_WORKERS,
    IO_WORKERS,
    SMALL_FILE_THRESHOLD,
    LZMA_PRESET,
    ZSTD_LEVEL
};
