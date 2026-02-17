const path = require("path");
const fs = require("fs");
const os = require("os");

const { sendFile } = require("./sender/sender");
const { receiveFile } = require("./receiver/receiver");

const { generateKeyPair, getPublicBytes, deriveSessionKey } = require("./shared/crypto");
const { cleanPath } = require("./shared/utils");

function formatMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

async function runSecureProcessing() {
    const filePath = process.argv[2];

    if (!filePath) {
        console.error("Usage: node secure_compressor.js <file_path>");
        process.exit(1);
    }

    try {
        const inputPath = cleanPath(filePath);

        console.log(`\n🔒 Initializing Secure Processing for: ${path.basename(inputPath)}`);

        // 🔐 KEY GENERATION
        const senderKeys = generateKeyPair();
        const receiverKeys = generateKeyPair();

        const receiverPub = getPublicBytes(receiverKeys);
        const sessionKey = deriveSessionKey(senderKeys.privateKey, receiverPub);

        console.log("\n========== ENCRYPTION & COMPRESSION ==========");
        console.log("Algorithm: AES-256-GCM");
        console.log("Compression: Zstd (Level 3)");
        console.log(`Session Key: ${sessionKey.toString("hex").substring(0, 32)}...`);

        // 📁 OUTPUT DIRECTORIES
        const encryptedDir = path.join(os.homedir(), "Desktop", "encrypted_files");
        const restoredDir = path.join(os.homedir(), "Desktop", "restored_files");

        if (!fs.existsSync(encryptedDir)) {
            fs.mkdirSync(encryptedDir, { recursive: true });
        }

        if (!fs.existsSync(restoredDir)) {
            fs.mkdirSync(restoredDir, { recursive: true });
        }

        // 📦 ENCRYPTED FILE PATH
        const encryptedFile = path.join(
            encryptedDir,
            `${path.basename(inputPath)}.enc.bin`
        );

        console.log(`\nProcessing file -> ${path.basename(encryptedFile)}...`);

        // 🔒 ENCRYPT
        const stats = await sendFile(inputPath, encryptedFile, sessionKey, "zstd");

        console.log("\n========== ENCRYPTION SUMMARY ==========");
        console.log(`Original Size:   ${formatMB(stats.originalTotal)}`);
        console.log(`Encrypted Size:  ${formatMB(stats.encryptedTotal)}`);
        console.log(`Space Saved:     ${stats.ratio.toFixed(2)}%`);
        console.log(`Time Taken:      ${stats.totalTime.toFixed(2)}s`);

        console.log("\n🔓 Decrypting & Restoring files...");

        // 🔓 DECRYPT + RESTORE (FOLDER SUPPORTED)
        await receiveFile(encryptedFile, restoredDir, sessionKey);

        console.log("✅ Files restored successfully!");

        // 🧹 DELETE .BIN FILE (OPTIONAL)
        try {
            fs.unlinkSync(encryptedFile);
            console.log("🗑️ Temporary encrypted file removed.");
        } catch (e) {
            console.log("⚠️ Could not delete encrypted file.");
        }

        console.log("\n========== FINAL OUTPUT ==========");
        console.log(`Restored Files Location: ${restoredDir}`);

        console.log("\n✨ Secure Processing Complete.");

    } catch (err) {
        console.error("\n❌ Error during processing:", err.message);
        process.exit(1);
    }
}

runSecureProcessing();
console.log("\n🔓 Decrypting & Restoring files...");
