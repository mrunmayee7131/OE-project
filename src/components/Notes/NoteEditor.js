// src/components/Notes/NoteEditor.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saveNote, updateNote, getNote } from '../../services/firebase';
import encryptionService from '../../services/encryption';
import notesDB from '../../services/indexedDB';
import './Notes.css';

function NoteEditor({ user, isOffline }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState({
    title: '',
    content: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const autoSaveTimerRef = useRef(null);

  // Memoize loadNote to prevent re-creation
  const loadNote = useCallback(async () => {
    if (!id || !user) return;
    
    setLoading(true);
    try {
      let noteData;
      
      if (isOffline) {
        // Load from IndexedDB when offline
        const notes = await notesDB.getLocalNotes(user.uid);
        noteData = notes.find(n => n.id === id);
      } else {
        // Load from Firebase when online
        noteData = await getNote(user.uid, id);
      }

      if (noteData && noteData.encrypted) {
        // Decrypt the note
        const decrypted = encryptionService.decryptNote(noteData);
        setNote({
          title: decrypted.title,
          content: decrypted.content,
          tags: decrypted.tags || []
        });
      } else if (noteData) {
        setNote({
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags || []
        });
      }
    } catch (error) {
      console.error('Error loading note:', error);
      setError('Failed to load note');
    } finally {
      setLoading(false);
    }
  }, [id, user, isOffline]);

  useEffect(() => {
    if (id && user) {
      loadNote();
    }
  }, [id, user, loadNote]);

  const handleSave = useCallback(async () => {
    if (!note.title.trim() && !note.content.trim()) {
      setError('Please add a title or content');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Prepare note data
      const noteData = {
        ...note,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };

      // Encrypt the note
      const encryptedNote = encryptionService.encryptNote(noteData);

      if (id) {
        // Update existing note
        if (isOffline) {
          await notesDB.updateNoteLocally(id, encryptedNote);
        } else {
          await updateNote(user.uid, id, encryptedNote);
          await notesDB.saveNoteLocally({ ...encryptedNote, id });
        }
      } else {
        // Create new note
        encryptedNote.createdAt = new Date().toISOString();
        
        if (isOffline) {
          // Generate a temporary ID for offline creation
          const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          encryptedNote.id = tempId;
          encryptedNote.syncStatus = 'pending';
          await notesDB.saveNoteLocally(encryptedNote);
        } else {
          const newId = await saveNote(user.uid, encryptedNote);
          await notesDB.saveNoteLocally({ ...encryptedNote, id: newId });
        }
      }

      setLastSaved(new Date());
      
      // Navigate back after short delay to show save confirmation
      setTimeout(() => {
        navigate('/notes');
      }, 1000);
    } catch (error) {
      console.error('Error saving note:', error);
      setError('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [note, id, user, isOffline, navigate]);

  const handleAddTag = () => {
    if (tagInput.trim() && !note.tags.includes(tagInput.trim())) {
      setNote({
        ...note,
        tags: [...note.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNote({
      ...note,
      tags: note.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleCancel = () => {
    if (note.title || note.content) {
      if (window.confirm('Discard unsaved changes?')) {
        navigate('/notes');
      }
    } else {
      navigate('/notes');
    }
  };

  // Auto-save functionality with proper cleanup
  useEffect(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Only auto-save for existing notes with content
    if (id && (note.title || note.content) && !saving) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, 5000); // Auto-save after 5 seconds of inactivity
    }

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [note.title, note.content, id, saving]); // Don't include handleSave to avoid infinite loops

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading note...</p>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="editor-header">
        <h2>{id ? '✏️ Edit Note' : '📝 New Note'}</h2>
        <div className="editor-actions">
          {lastSaved && (
            <span className="save-status">
              ✅ Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button onClick={handleCancel} className="cancel-btn">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="save-btn"
          >
            {saving ? 'Saving...' : (id ? 'Update' : 'Save')}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isOffline && (
        <div className="offline-notice">
          📵 Offline mode - Note will sync when reconnected
        </div>
      )}

      <div className="editor-body">
        <input
          type="text"
          placeholder="Note Title..."
          value={note.title}
          onChange={(e) => setNote({ ...note, title: e.target.value })}
          className="title-input"
        />

        <div className="tags-section">
          <div className="tag-input-wrapper">
            <input
              type="text"
              placeholder="Add tags..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              className="tag-input"
            />
            <button onClick={handleAddTag} className="add-tag-btn">
              + Add
            </button>
          </div>
          <div className="tags-list">
            {note.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="remove-tag">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Start typing your encrypted note..."
          value={note.content}
          onChange={(e) => setNote({ ...note, content: e.target.value })}
          className="content-textarea"
        />
      </div>
    </div>
  );
}

export default NoteEditor;