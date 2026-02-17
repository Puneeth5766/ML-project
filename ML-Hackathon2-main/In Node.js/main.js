const readline = require("readline");

const { sendFile } =
    require("./sender/sender");

const { receiveFile } =
    require("./receiver/receiver");

const {
    generateKeyPair,
    getPublicBytes,
    deriveSessionKey
} = require("./shared/crypto");

const { cleanPath } =
    require("./shared/utils");

const rl =
    readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

function formatMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

rl.question(
    "Mode (1=Sender, 2=Receiver): ",
    mode => {

        if (mode === "1") {

            rl.question(
                "File / Folder path: ",
                async file => {

                    try {

                        const inputPath =
                            cleanPath(file);

                        const startTime =
                            Date.now();

                        // -------- KEY EXCHANGE --------
                        const senderKeys =
                            generateKeyPair();

                        const receiverKeys =
                            generateKeyPair();

                        const receiverPub =
                            getPublicBytes(receiverKeys);

                        const sessionKey =
                            deriveSessionKey(
                                senderKeys.privateKey,
                                receiverPub
                            );

                        console.log("\n========== SENDER ==========");
                        console.log("Encryption: AES-256-GCM");
                        console.log("Key Exchange: X25519 + HKDF-SHA256\n");

                        console.log("Sender Public Key:");
                        console.log(
                            getPublicBytes(senderKeys).toString("hex")
                        );

                        console.log("\nReceiver Public Key:");
                        console.log(
                            receiverPub.toString("hex")
                        );

                        console.log("\nDerived Session Key:");
                        console.log(
                            sessionKey.toString("hex")
                        );

                        console.log("\nStarting secure transfer...\n");

                        const stats =
                            await sendFile(
                                inputPath,
                                "output.bin",
                                sessionKey,
                                "zstd"
                            );

                        const endTime =
                            Date.now();

                        console.log("\n========== TRANSFER SUMMARY ==========");
                        console.log("Original Size:",
                            formatMB(stats.originalTotal));

                        console.log("Encrypted Size:",
                            formatMB(stats.encryptedTotal));

                        console.log("Compression Ratio:",
                            stats.ratio.toFixed(2) + "%");

                        console.log("Total Time:",
                            stats.totalTime.toFixed(2) + " seconds");

                        console.log("Output File: output.bin");

                        console.log("\nSecure transfer completed successfully.\n");

                    } catch (err) {

                        console.error("\nError:", err.message);
                    }

                    rl.close();
                }
            );

        } else if (mode === "2") {

            rl.question(
                "Archive (.bin) path: ",
                async file => {

                    try {

                        const inputPath =
                            cleanPath(file);

                        const startTime =
                            Date.now();

                        // -------- KEY EXCHANGE --------
                        const receiverKeys =
                            generateKeyPair();

                        const senderKeys =
                            generateKeyPair();

                        const senderPub =
                            getPublicBytes(senderKeys);

                        const sessionKey =
                            deriveSessionKey(
                                receiverKeys.privateKey,
                                senderPub
                            );

                        console.log("\n========== RECEIVER ==========");
                        console.log("Decryption: AES-256-GCM");
                        console.log("Key Exchange: X25519 + HKDF-SHA256\n");

                        console.log("Receiver Public Key:");
                        console.log(
                            getPublicBytes(receiverKeys).toString("hex")
                        );

                        console.log("\nSender Public Key:");
                        console.log(
                            senderPub.toString("hex")
                        );

                        console.log("\nDerived Session Key:");
                        console.log(
                            sessionKey.toString("hex")
                        );

                        console.log("\nStarting secure extraction...\n");

                        const stats =
                            await receiveFile(
                                inputPath,
                                "output_folder",
                                sessionKey
                            );

                        const endTime =
                            Date.now();

                        console.log("\n========== EXTRACTION SUMMARY ==========");
                        console.log("Decrypted Size:",
                            formatMB(stats.originalTotal));

                        console.log("Encrypted Size:",
                            formatMB(stats.encryptedTotal));

                        console.log("Compression Ratio:",
                            stats.ratio.toFixed(2) + "%");

                        console.log("Total Time:",
                            stats.totalTime.toFixed(2) + " seconds");

                        console.log("Output Folder: output_folder");

                        console.log("\nSecure extraction completed successfully.\n");

                    } catch (err) {

                        console.error("\nError:", err.message);
                    }

                    rl.close();
                }
            );

        } else {

            console.log("Invalid mode selected.");
            rl.close();
        }
    }
);
