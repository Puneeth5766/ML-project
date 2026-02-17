const net = require('net');
const path = require('path');
const fs = require('fs');
const { sendFile } = require('./sender/sender');
const { generateKeyPair, getPublicBytes, deriveSessionKey } = require('./shared/crypto');

// 🔥 helper for streaming logs
function log(msg) {
    process.stdout.write(msg + "\n");
}

async function startClient(inputPath, host = 'localhost', port = 8888) {
    return new Promise((resolve, reject) => {

        log(`Connecting to ${host}:${port}...`);

        const socket = net.createConnection(port, host, () => {
            log('Connected to server!');

            // --- PHASE 1: HANDSHAKE ---
            const clientKeyPair = generateKeyPair();
            const clientPublicKeyBytes = getPublicBytes(clientKeyPair);

            const handshakePacket = Buffer.alloc(1 + 32);
            handshakePacket.writeUInt8(1, 0);
            clientPublicKeyBytes.copy(handshakePacket, 1);

            socket.write(handshakePacket);

            socket.once('data', async (data) => {
                try {
                    if (data.length < 32) {
                        throw new Error('Invalid server handshake response length');
                    }

                    const serverPublicKeyBytes = data.slice(0, 32);
                    const sessionKey = deriveSessionKey(clientKeyPair.privateKey, serverPublicKeyBytes);

                    log('Handshake successful.');

                    // --- PHASE 2: FILE TRANSFER ---
                    log(`Sending: ${inputPath}`);

                    const stats = await sendFile(inputPath, socket, sessionKey, 'zstd');

                    log('\n--- Sender Summary ---');
                    log(`Original Size: ${(stats.originalTotal / (1024 * 1024)).toFixed(2)} MB`);
                    log(`Encrypted Sent: ${(stats.encryptedTotal / (1024 * 1024)).toFixed(2)} MB`);
                    log(`Ratio: ${stats.ratio.toFixed(2)}%`);

                    // --- PHASE 4: WAIT FOR ACK ---
                    log('Waiting for verification...');

                    socket.end();

                    socket.on('data', (chunk) => {
                        if (chunk.length > 0) {
                            const status = chunk[0];
                            if (status === 0x06) {
                                log("Status: TRANSFER SUCCESSFUL (ACK)");
                            } else if (status === 0x15) {
                                log("Status: INTEGRITY FAILURE (ERR)");
                            } else {
                                log("Status: Unknown response: " + status);
                            }
                        }
                    });

                    socket.on('end', () => {
                        log('Connection closed by server.');
                        resolve();
                    });

                } catch (err) {
                    log("ERROR: " + err.message);
                    reject(err);
                }
            });
        });

        socket.on('error', (err) => {
            log("Socket error: " + err.message);
            reject(err);
        });
    });
}

// CLI run
if (require.main === module) {
    const input = process.argv[2];
    const host = process.argv[3];
    if (input) startClient(input, host);
    else console.log("Usage: node client.js <file> [host]");
}

module.exports = { startClient };
