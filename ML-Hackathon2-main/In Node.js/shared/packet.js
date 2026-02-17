const HEADER_SIZE = 16 + 4 + 12 + 16 + 4;

function createFrame(fileId, chunkSeq, iv, ciphertext, tag) {

    if (fileId.length !== 16)
        throw new Error("File ID must be 16 bytes");

    if (iv.length !== 12)
        throw new Error("IV must be 12 bytes");

    if (tag.length !== 16)
        throw new Error("Tag must be 16 bytes");

    const header = Buffer.alloc(HEADER_SIZE);

    let offset = 0;

    fileId.copy(header, offset); offset += 16;
    header.writeUInt32BE(chunkSeq, offset); offset += 4;
    iv.copy(header, offset); offset += 12;
    tag.copy(header, offset); offset += 16;
    header.writeUInt32BE(ciphertext.length, offset);

    return Buffer.concat([header, ciphertext]);
}

function parseHeader(buffer) {

    if (buffer.length < HEADER_SIZE)
        return null;

    let offset = 0;

    const fileId = buffer.subarray(offset, offset += 16);
    const chunkSeq = buffer.readUInt32BE(offset); offset += 4;
    const iv = buffer.subarray(offset, offset += 12);
    const tag = buffer.subarray(offset, offset += 16);
    const length = buffer.readUInt32BE(offset);

    return { fileId, chunkSeq, iv, tag, length };
}

module.exports = {
    HEADER_SIZE,
    createFrame,
    parseHeader
};
