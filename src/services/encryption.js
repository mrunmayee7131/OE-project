// src/services/encryption.js
import CryptoJS from 'crypto-js';

class EncryptionService {
  constructor() {
    this.masterKey = null;
  }

  /**
   * Generate a random encryption key
   */
  generateKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  /**
   * Derive a key from user's password
   */
  async deriveKeyFromPassword(password, salt = null) {
    if (!salt) {
      salt = CryptoJS.lib.WordArray.random(128/8).toString();
    }
    
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 100000
    });
    
    return {
      key: key.toString(),
      salt: salt
    };
  }

  /**
   * Set the master encryption key for the session
   */
  setMasterKey(key) {
    this.masterKey = key;
    // Store in session storage (cleared when browser closes)
    sessionStorage.setItem('encKey', key);
  }

  /**
   * Get the master encryption key
   */
  getMasterKey() {
    if (!this.masterKey) {
      this.masterKey = sessionStorage.getItem('encKey');
    }
    return this.masterKey;
  }

  /**
   * Clear the master key (on logout)
   */
  clearMasterKey() {
    this.masterKey = null;
    sessionStorage.removeItem('encKey');
  }

  /**
   * Encrypt text using AES-GCM
   */
  encrypt(plaintext, key = null) {
    try {
      const encryptionKey = key || this.getMasterKey();
      if (!encryptionKey) {
        throw new Error('No encryption key available');
      }

      // Generate a random IV for each encryption
      const iv = CryptoJS.lib.WordArray.random(128/8);
      
      // Encrypt the plaintext
      const encrypted = CryptoJS.AES.encrypt(plaintext, encryptionKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      });

      // Combine IV and ciphertext for storage
      const combined = iv.toString() + ':' + encrypted.toString();
      return combined;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt text using AES-GCM
   */
  decrypt(ciphertext, key = null) {
    try {
      const decryptionKey = key || this.getMasterKey();
      if (!decryptionKey) {
        throw new Error('No decryption key available');
      }

      // Split the IV and ciphertext
      const parts = ciphertext.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = CryptoJS.enc.Hex.parse(parts[0]);
      const encrypted = parts[1];

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(encrypted, decryptionKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      });

      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        throw new Error('Failed to decrypt - invalid key or corrupted data');
      }

      return plaintext;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Encrypt an entire note object
   */
  encryptNote(note) {
    const encryptedNote = {
      ...note,
      title: this.encrypt(note.title),
      content: this.encrypt(note.content),
      encrypted: true,
      encryptedAt: new Date().toISOString()
    };

    // If there are tags, encrypt them too
    if (note.tags && Array.isArray(note.tags)) {
      encryptedNote.tags = note.tags.map(tag => this.encrypt(tag));
    }

    return encryptedNote;
  }

  /**
   * Decrypt an entire note object
   */
  decryptNote(encryptedNote) {
    try {
      const decryptedNote = {
        ...encryptedNote,
        title: this.decrypt(encryptedNote.title),
        content: this.decrypt(encryptedNote.content),
        encrypted: false
      };

      // Decrypt tags if they exist
      if (encryptedNote.tags && Array.isArray(encryptedNote.tags)) {
        decryptedNote.tags = encryptedNote.tags.map(tag => this.decrypt(tag));
      }

      delete decryptedNote.encryptedAt;
      return decryptedNote;
    } catch (error) {
      console.error('Failed to decrypt note:', error);
      return {
        ...encryptedNote,
        title: '[Decryption Failed]',
        content: 'Unable to decrypt this note. The encryption key may be incorrect.',
        decryptionError: true
      };
    }
  }

  /**
   * Hash a password for verification (not for encryption)
   */
  hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
  }

  /**
   * Verify data integrity using HMAC
   */
  generateHMAC(data, key = null) {
    const hmacKey = key || this.getMasterKey();
    return CryptoJS.HmacSHA256(data, hmacKey).toString();
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data, hmac, key = null) {
    const calculatedHMAC = this.generateHMAC(data, key);
    return calculatedHMAC === hmac;
  }
}

export default new EncryptionService();