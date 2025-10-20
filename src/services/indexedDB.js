// src/services/indexedDB.js
import Dexie from 'dexie';

class NotesDatabase extends Dexie {
  constructor() {
    super('ConfidentialNotesDB');
    
    this.version(1).stores({
      notes: 'id, userId, title, content, createdAt, updatedAt, syncStatus',
      pendingSync: '++id, noteId, action, timestamp',
      encryptionKeys: 'userId, salt, timestamp'
    });

    this.notes = this.table('notes');
    this.pendingSync = this.table('pendingSync');
    this.encryptionKeys = this.table('encryptionKeys');
  }

  // Save note locally
  async saveNoteLocally(note) {
    try {
      await this.notes.put({
        ...note,
        syncStatus: 'synced',
        localUpdatedAt: new Date().toISOString()
      });
      return note.id;
    } catch (error) {
      console.error('Error saving note locally:', error);
      throw error;
    }
  }

  // Get all notes for a user
  async getLocalNotes(userId) {
    try {
      const notes = await this.notes
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('updatedAt');
      return notes;
    } catch (error) {
      console.error('Error getting local notes:', error);
      throw error;
    }
  }

  // Update note locally
  async updateNoteLocally(noteId, updates) {
    try {
      await this.notes.update(noteId, {
        ...updates,
        syncStatus: 'pending',
        localUpdatedAt: new Date().toISOString()
      });
      
      // Add to pending sync
      await this.addToPendingSync(noteId, 'update');
    } catch (error) {
      console.error('Error updating note locally:', error);
      throw error;
    }
  }

  // Delete note locally
  async deleteNoteLocally(noteId) {
    try {
      await this.notes.delete(noteId);
      await this.addToPendingSync(noteId, 'delete');
    } catch (error) {
      console.error('Error deleting note locally:', error);
      throw error;
    }
  }

  // Add operation to pending sync queue
  async addToPendingSync(noteId, action) {
    try {
      await this.pendingSync.add({
        noteId,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding to pending sync:', error);
      throw error;
    }
  }

  // Get pending sync operations
  async getPendingSync() {
    try {
      return await this.pendingSync.toArray();
    } catch (error) {
      console.error('Error getting pending sync:', error);
      throw error;
    }
  }

  // Clear pending sync after successful sync
  async clearPendingSync(ids) {
    try {
      await this.pendingSync.bulkDelete(ids);
    } catch (error) {
      console.error('Error clearing pending sync:', error);
      throw error;
    }
  }

  // Save encryption salt locally
  async saveEncryptionSalt(userId, salt) {
    try {
      await this.encryptionKeys.put({
        userId,
        salt,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving encryption salt:', error);
      throw error;
    }
  }

  // Get encryption salt
  async getEncryptionSalt(userId) {
    try {
      const key = await this.encryptionKeys.get(userId);
      return key ? key.salt : null;
    } catch (error) {
      console.error('Error getting encryption salt:', error);
      throw error;
    }
  }

  // Clear all local data for a user (on logout)
  async clearUserData(userId) {
    try {
      await this.transaction('rw', this.notes, this.pendingSync, this.encryptionKeys, async () => {
        // Delete all notes for this user
        await this.notes.where('userId').equals(userId).delete();
        
        // Clear pending sync
        await this.pendingSync.clear();
        
        // Clear encryption keys
        await this.encryptionKeys.where('userId').equals(userId).delete();
      });
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  }

  // Sync local changes with Firebase
  async syncWithFirebase(syncFunction) {
    try {
      const pending = await this.getPendingSync();
      const syncedIds = [];

      for (const operation of pending) {
        try {
          await syncFunction(operation);
          syncedIds.push(operation.id);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
        }
      }

      if (syncedIds.length > 0) {
        await this.clearPendingSync(syncedIds);
      }

      return {
        total: pending.length,
        synced: syncedIds.length,
        failed: pending.length - syncedIds.length
      };
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    }
  }

  // Check if database is available
  async isAvailable() {
    try {
      await this.open();
      return true;
    } catch (error) {
      console.error('IndexedDB not available:', error);
      return false;
    }
  }
}

// Create and export a single instance
const notesDB = new NotesDatabase();
export default notesDB;