# Compressed & Encrypted Transfer Protocol (CETP)

**CETP** is a lightweight, secure protocol for transferring large files (TB+) over a network. It combines high-speed **Zstd compression**, **AES-256-GCM encryption**, and a **Zero-Knowledge Handshake** to ensure data confidentiality and integrity without shared secrets or certificates.

### Key Features
*   **Security**: Ephemeral ECDH key exchange (X25519) + AES-256-GCM.
*   **Efficiency**: Streams data (piped processing) to handle files larger than RAM.
*   **Integrity**: SHA-256 validation of the original vs. decrypted payload.
*   **0-RTT Handshake**: Immediate secure tunnel establishment.

---

### How to Run

1.  **Install Dependencies**:
    ```bash
    npm install
    # (If zstd fails, check native build tools)
    ```

2.  **Start Receiver (Server)**:
    Open a terminal on the destination machine:
    ```bash
    npm run server -- --port 8888
    # Or: node cetp.js server --port 8888
    ```

3.  **Send File (Client)**:
    Open a terminal on the source machine:
    ```bash
    npm run send -- <FILE_PATH> --ip <DEST_IP> --port 8888
    # Or: node cetp.js send "./large_dataset.csv" --ip 192.168.1.5 --port 8888
    ```
    

### Local Testing
To test on a single machine:
1. Terminal 1: `node cetp.js server`
2. Terminal 2: `node cetp.js send "./test.txt" --ip localhost`
