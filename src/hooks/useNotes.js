import { useState, useEffect, useCallback } from 'react';
import { getNotes, saveNote, updateNote, deleteNote as deleteFirebaseNote } from '../services/firebase';
import encryptionService from '../services/encryption';
import notesDB from '../services/indexedDB';

export function useNotes(user, isOffline) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Load notes from Firebase or IndexedDB
  const loadNotes = useCallback(async () => {
    if (!user) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let encryptedNotes = [];

      if (isOffline) {
        // Load from IndexedDB when offline
        encryptedNotes = await notesDB.getLocalNotes(user.uid);
      } else {
        // Load from Firebase when online - FIXED: Added userId parameter
        encryptedNotes = await getNotes(user.uid);
        
        // Cache notes locally for offline access
        for (const note of encryptedNotes) {
          await notesDB.saveNoteLocally(note);
        }
      }

      // Decrypt notes for display
      const decryptedNotes = encryptedNotes.map(note => {
        if (note.encrypted) {
          try {
            return encryptionService.decryptNote(note);
          } catch (err) {
            console.error('Failed to decrypt note:', err);
            return {
              ...note,
              title: '[Unable to Decrypt]',
              content: 'Check your encryption password',
              decryptionError: true
            };
          }
        }
        return note;
      });

      setNotes(decryptedNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);

  // Create a new note
  const createNote = useCallback(async (noteData) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Prepare note data
      const newNote = {
        ...noteData,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Encrypt the note
      const encryptedNote = encryptionService.encryptNote(newNote);

      let noteId;

      if (isOffline) {
        // Generate a temporary ID for offline creation
        noteId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        encryptedNote.id = noteId;
        encryptedNote.syncStatus = 'pending';
        await notesDB.saveNoteLocally(encryptedNote);
      } else {
        // Save to Firebase - FIXED: Added userId parameter
        noteId = await saveNote(user.uid, encryptedNote);
        encryptedNote.id = noteId;
        await notesDB.saveNoteLocally(encryptedNote);
      }

      // Add to local state (decrypted)
      setNotes(prev => [{ ...noteData, id: noteId }, ...prev]);

      return noteId;
    } catch (err) {
      console.error('Error creating note:', err);
      throw err;
    }
  }, [user, isOffline]);

  // Update an existing note
  const updateExistingNote = useCallback(async (noteId, updates) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const noteData = {
        ...updates,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };

      // Encrypt the note
      const encryptedNote = encryptionService.encryptNote(noteData);

      if (isOffline) {
        await notesDB.updateNoteLocally(noteId, encryptedNote);
      } else {
        // FIXED: Added userId parameter
        await updateNote(user.uid, noteId, encryptedNote);
        await notesDB.saveNoteLocally({ ...encryptedNote, id: noteId });
      }

      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...noteData, id: noteId } : note
      ));
    } catch (err) {
      console.error('Error updating note:', err);
      throw err;
    }
  }, [user, isOffline]);

  // Delete a note
  const deleteNote = useCallback(async (noteId) => {
    if (!user) throw new Error('User not authenticated');

    try {
      if (isOffline) {
        // Delete locally and queue for sync
        await notesDB.deleteNoteLocally(noteId);
      } else {
        // Delete from Firebase - FIXED: Added userId parameter
        await deleteFirebaseNote(user.uid, noteId);
        // Also delete from local cache
        await notesDB.deleteNoteLocally(noteId);
      }

      // Update local state
      setNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (err) {
      console.error('Error deleting note:', err);
      throw err;
    }
  }, [user, isOffline]);

  // Sync pending notes when coming back online
  const syncNotes = useCallback(async () => {
    if (isOffline || !user) return;

    setSyncing(true);
    try {
      const result = await notesDB.syncWithFirebase(async (operation) => {
        // Handle each sync operation - FIXED: Added userId parameter to all operations
        if (operation.action === 'create') {
          await saveNote(user.uid, operation.data);
        } else if (operation.action === 'update') {
          await updateNote(user.uid, operation.noteId, operation.data);
        } else if (operation.action === 'delete') {
          await deleteFirebaseNote(user.uid, operation.noteId);
        }
      });

      console.log('Sync completed:', result);
      
      // Reload notes after sync
      await loadNotes();
    } catch (err) {
      console.error('Sync failed:', err);
      setError('Failed to sync notes');
    } finally {
      setSyncing(false);
    }
  }, [user, isOffline, loadNotes]);

  // Load notes on mount and when dependencies change
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Sync when coming back online
  useEffect(() => {
    if (!isOffline && user) {
      syncNotes();
    }
  }, [isOffline, user, syncNotes]);

  return {
    notes,
    loading,
    error,
    syncing,
    loadNotes,
    createNote,
    updateNote: updateExistingNote,
    deleteNote,
    syncNotes
  };
}