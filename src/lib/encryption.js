import CryptoJS from "crypto-js";

const secretKey = "TI+q6GFY/6RgTyziRShd+rAdqvNAptOY9Dwv6V4rkROYva668zkfGGUKUUlDeuaB";
const iv = CryptoJS.enc.Hex.parse("7d70ea1ac6118eb1d183f2c1f057217c");

const encryptWithIV = (text) => {
  try {
    const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secretKey), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  } catch (error) {
    console.error("Encryption error:", error);
    return null;
  }
};

const decryptWithIV = (ciphertext) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Utf8.parse(secretKey), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
  }
};

const decryptLastMessage = (encryptedMessage) => {
  if (!encryptedMessage) return "";

  try {
    const decryptedMessage = decryptWithIV(encryptedMessage);

    if (!decryptedMessage) {
      return "Unable to display message";
    }

    return decryptedMessage;
  } catch (error) {
    console.error("Message decryption error:", error);
    return "Unable to display message";
  }
};

export { encryptWithIV, decryptWithIV, decryptLastMessage };
