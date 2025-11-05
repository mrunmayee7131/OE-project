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

  // Generate a master key directly (for development/testing)
  generateMasterKey() {
    const key = CryptoJS.lib.WordArray.random(256 / 8).toString();
    this.masterKey = key;
    return key;
  }

  // Set the master encryption key for this session
  setMasterKey(key) {
    if (!key) {
      console.error('Attempted to set null/undefined master key');
      return false;
    }
    this.masterKey = key;
    console.log('Master key set successfully');
    return true;
  }

  // Get the master encryption key
  getMasterKey() {
    return this.masterKey;
  }

  // Check if master key is set
  hasMasterKey() {
    return !!this.masterKey;
  }

  // Clear the master key (on logout)
  clearMasterKey() {
    this.masterKey = null;
    console.log('Master key cleared');
  }

  // Encrypt note data
  encryptNote(noteData) {
    if (!this.masterKey) {
      console.error('Encryption key not set when trying to encrypt');
      
      // Try to recover from session storage
      const sessionKey = sessionStorage.getItem('encKey');
      if (sessionKey) {
        this.masterKey = sessionKey;
        console.log('Recovered encryption key from session');
      } else {
        throw new Error('Encryption key not set. Please log in again.');
      }
    }

    try {
      // Ensure we have strings to encrypt
      const titleToEncrypt = (noteData.title || '').toString();
      const contentToEncrypt = (noteData.content || '').toString();
      const tagsToEncrypt = JSON.stringify(noteData.tags || []);

      const encryptedTitle = CryptoJS.AES.encrypt(
        titleToEncrypt,
        this.masterKey
      ).toString();

      const encryptedContent = CryptoJS.AES.encrypt(
        contentToEncrypt,
        this.masterKey
      ).toString();

      const encryptedTags = CryptoJS.AES.encrypt(
        tagsToEncrypt,
        this.masterKey
      ).toString();

      return {
        ...noteData,
        title: encryptedTitle,
        content: encryptedContent,
        tags: encryptedTags, // Store encrypted tags as string
        encrypted: true
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt note: ' + error.message);
    }
  }

  // Decrypt note data
  decryptNote(noteData) {
    if (!this.masterKey) {
      console.error('Encryption key not set when trying to decrypt');
      
      // Try to recover from session storage
      const sessionKey = sessionStorage.getItem('encKey');
      if (sessionKey) {
        this.masterKey = sessionKey;
        console.log('Recovered encryption key from session for decryption');
      } else {
        throw new Error('Encryption key not set. Please log in again.');
      }
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

      let decryptedTags = [];
      if (noteData.tags) {
        try {
          // Handle encrypted tags (stored as encrypted string)
          if (typeof noteData.tags === 'string') {
            const decryptedTagsString = CryptoJS.AES.decrypt(
              noteData.tags,
              this.masterKey
            ).toString(CryptoJS.enc.Utf8);
            decryptedTags = JSON.parse(decryptedTagsString || '[]');
          } else if (Array.isArray(noteData.tags)) {
            // Handle legacy unencrypted tags
            decryptedTags = noteData.tags;
          }
        } catch (e) {
          console.error('Error decrypting tags:', e);
          decryptedTags = [];
        }
      }

      // Validate decryption - if we get empty strings, the key might be wrong
      if (!decryptedTitle && !decryptedContent && noteData.title && noteData.content) {
        throw new Error('Invalid decryption key');
      }

      return {
        ...noteData,
        title: decryptedTitle || '',
        content: decryptedContent || '',
        tags: decryptedTags,
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

  // Validate if a key can decrypt a test string
  async validateKey(key, testEncrypted) {
    try {
      const bytes = CryptoJS.AES.decrypt(testEncrypted, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted === 'test';
    } catch {
      return false;
    }
  }

  // Create a test encrypted string for key validation
  createTestString(key) {
    return CryptoJS.AES.encrypt('test', key).toString();
  }
}

// Export a singleton instance
const encryptionService = new EncryptionService();

// For debugging in development
if (process.env.NODE_ENV === 'development') {
  window.encryptionService = encryptionService;
}

export default encryptionService;