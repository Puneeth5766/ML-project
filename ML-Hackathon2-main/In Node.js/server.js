const net = require('net');
const path = require('path');
const fs = require('fs');
const { receiveFile } = require('./receiver/receiver');
const { generateKeyPair, getPublicBytes, deriveSessionKey } = require('./shared/crypto');

function startServer(port = 8888) {
    const OUTPUT_FOLDER = path.join(__dirname, 'received_files');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
    }

    const server = net.createServer((socket) => {
        console.log(`[${new Date().toISOString()}] Client connected: ${socket.remoteAddress}`);

        socket.on('error', (err) => {
            console.error(`[${socket.remoteAddress}] Socket error: ${err.message}`);
        });

        socket.once('data', async (data) => {
            try {
                // Expected Handshake: [Version (1)] + [ClientPublicKey (32)] = 33 bytes
                if (data.length < 33) {
                    console.error('Handshake failed: Invalid length');
                    socket.end();
                    return;
                }

                const version = data.readUInt8(0);
                if (version !== 1) {
                    console.error('Handshake failed: Unsupported protocol version');
                    socket.end();
                    return;
                }

                const clientPublicKeyBytes = data.slice(1, 33);
                const serverKeyPair = generateKeyPair();
                const serverPublicKeyBytes = getPublicBytes(serverKeyPair);
                const sessionKey = deriveSessionKey(serverKeyPair.privateKey, clientPublicKeyBytes);

                // Send Server Public Key to Client
                socket.write(serverPublicKeyBytes);

                // Receive file stream
                const result = await receiveFile(socket, OUTPUT_FOLDER, sessionKey);

                // --- PHASE 4: TERMINATION & VERIFICATION ---
                const allValid = result.verificationResults && result.verificationResults.every(r => r.verification === "Match");

                if (allValid) {
                    // Send ACK (0x06)
                    socket.write(Buffer.from([0x06]));
                    console.log(`[${socket.remoteAddress}] Verify: OK. Sent ACK.`);
                } else {
                    // Send ERR (0x15)
                    socket.write(Buffer.from([0x15]));
                    console.error(`[${socket.remoteAddress}] Verify: FAILED. Sent ERR.`);
                }

                socket.end();

            } catch (err) {
                console.error(`[${socket.remoteAddress}] Error during session:`, err.message);
                socket.destroy();
            }
        });
    });

    server.listen(port, () => {
        console.log(`CETP Server listening on port ${port}`);
        console.log(`Saving files to: ${OUTPUT_FOLDER}`);
    });
}

// Allow running directly
if (require.main === module) {
    startServer();
}

module.exports = { startServer };
