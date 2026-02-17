const path = require("path");
const fs = require("fs");

const { sendFile } = require("./sender/sender");
const { receiveFile } = require("./receiver/receiver");
const { generateKeyPair, getPublicBytes, deriveSessionKey } = require("./shared/crypto");
const { cleanPath } = require("./shared/utils");

function formatMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

async function runIntegration() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Usage: node integrated_transfer.js <file_path>");
        process.exit(1);
    }

    try {
        const inputPath = cleanPath(filePath);
        console.log(`\nInitializing Secure Transfer for: ${inputPath}`);

        // --- SENDER ---
        console.log("\n========== SENDER INITIALIZATION ==========");
        const senderKeys = generateKeyPair();
        const receiverKeys = generateKeyPair();
        const receiverPub = getPublicBytes(receiverKeys);
        const sessionKey = deriveSessionKey(senderKeys.privateKey, receiverPub);

        console.log("Encryption: AES-256-GCM");
        console.log("Key Exchange: X25519 + HKDF-SHA256");
        console.log(`Session Key Derived: ${sessionKey.toString("hex").substring(0, 32)}...`);

        const encryptedFile = "output.bin";
        console.log(`\nSending to encrypted archive: ${encryptedFile}...`);

        const sendStats = await sendFile(inputPath, encryptedFile, sessionKey, "zstd");

        console.log("\n========== SENDER SUMMARY ==========");
        console.log(`Original Size: ${formatMB(sendStats.originalTotal)}`);
        console.log(`Encrypted Size: ${formatMB(sendStats.encryptedTotal)}`);
        console.log(`Compression Ratio: ${sendStats.ratio.toFixed(2)}%`);
        console.log(`Time: ${sendStats.totalTime.toFixed(2)}s`);


        // --- RECEIVER ---
        console.log("\n========== RECEIVER INITIALIZATION ==========");
        const outputFolder = "output_restored";
        // Clean output folder if exists
        if (fs.existsSync(outputFolder)) {
            fs.rmSync(outputFolder, { recursive: true, force: true });
        }
        
        console.log(`Decrypting archive to: ${outputFolder}...`);

        const receiveStats = await receiveFile(encryptedFile, outputFolder, sessionKey);

        console.log("\n========== RECEIVER SUMMARY ==========");
        console.log(`Decrypted Size: ${formatMB(receiveStats.originalTotal)}`);
        console.log(`Time: ${receiveStats.totalTime.toFixed(2)}s`);
        
        console.log("\n✅ Secure Transfer & Restoration Completed Successfully.");

    } catch (err) {
        console.error("\n❌ Error during transfer:", err.message);
        process.exit(1);
    }
}

runIntegration();