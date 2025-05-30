// src/utils/fileEncryption.js
const crypto = require("crypto");
const fs = require("fs");

const algorithm = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32‑char
const IV_LENGTH = 16;

// sanity check
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters");
}

function encryptFile(inputPath, outputPath) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, "utf8");
  const data = fs.readFileSync(inputPath); // read whole file

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // write IV + ciphertext
  fs.writeFileSync(outputPath, Buffer.concat([iv, encrypted]));

  return iv.toString("hex");
}

function decryptFile(encryptedPath, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const key = Buffer.from(ENCRYPTION_KEY, "utf8");
      const fileBuffer = fs.readFileSync(encryptedPath);

      if (fileBuffer.length < IV_LENGTH) {
        throw new Error("Encrypted file is too short to contain an IV");
      }

      // extract IV and ciphertext
      const iv = fileBuffer.slice(0, IV_LENGTH);
      const ciphertext = fileBuffer.slice(IV_LENGTH);

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      // write the plaintext out
      fs.writeFileSync(outputPath, decrypted);

      // resolve immediately—no streams to wait on
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { encryptFile, decryptFile };
