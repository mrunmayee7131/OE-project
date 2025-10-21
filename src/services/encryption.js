// src/services/encryption.js
import CryptoJS from 'crypto-js';

class EncryptionService {
  constructor() {
    this.masterKey = null;
  }

  // Generate a random salt
  generateSalt() {
    return CryptoJS.lib.WordArray.random(128 / 8).toString();
  }

  // Derive encryption key from password using PBKDF2
  async deriveKeyFromPassword(password, salt = null) {
    const actualSalt = salt || this.generateSalt();
    
    const key = CryptoJS.PBKDF2(password, actualSalt, {
      keySize: 256 / 32,
      iterations: 10000
    });

    return {
      key: key.toString(),
      salt: actualSalt
    };
  }

  // Set the master encryption key for this session
  setMasterKey(key) {
    this.masterKey = key;
  }

  // Get the master encryption key
  getMasterKey() {
    return this.masterKey;
  }

  // Clear the master key (on logout)
  clearMasterKey() {
    this.masterKey = null;
  }

  // Encrypt note data
  encryptNote(noteData) {
    if (!this.masterKey) {
      throw new Error('Encryption key not set');
    }

    try {
      const encryptedTitle = CryptoJS.AES.encrypt(
        noteData.title || '',
        this.masterKey
      ).toString();

      const encryptedContent = CryptoJS.AES.encrypt(
        noteData.content || '',
        this.masterKey
      ).toString();

      return {
        ...noteData,
        title: encryptedTitle,
        content: encryptedContent,
        encrypted: true
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt note');
    }
  }

  // Decrypt note data
  decryptNote(noteData) {
    if (!this.masterKey) {
      throw new Error('Encryption key not set');
    }

    if (!noteData.encrypted) {
      return noteData;
    }

    try {
      const decryptedTitle = CryptoJS.AES.decrypt(
        noteData.title,
        this.masterKey
      ).toString(CryptoJS.enc.Utf8);

      const decryptedContent = CryptoJS.AES.decrypt(
        noteData.content,
        this.masterKey
      ).toString(CryptoJS.enc.Utf8);

      if (!decryptedTitle && !decryptedContent) {
        throw new Error('Invalid decryption key');
      }

      return {
        ...noteData,
        title: decryptedTitle,
        content: decryptedContent,
        encrypted: false
      };
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt note - check your encryption password');
    }
  }

  // Encrypt a single string
  encryptString(text) {
    if (!this.masterKey) {
      throw new Error('Encryption key not set');
    }
    return CryptoJS.AES.encrypt(text, this.masterKey).toString();
  }

  // Decrypt a single string
  decryptString(encryptedText) {
    if (!this.masterKey) {
      throw new Error('Encryption key not set');
    }
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.masterKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

// Export a singleton instance
const encryptionService = new EncryptionService();
export default encryptionService;