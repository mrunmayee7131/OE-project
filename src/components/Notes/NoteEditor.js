// src/components/Notes/NoteEditor.js
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (id) {
      loadNote();
    }
  }, [id]);

  const loadNote = async () => {
    setLoading(true);
    try {
      let noteData;
      
      if (isOffline) {
        // Load from IndexedDB when offline
        const notes = await notesDB.getLocalNotes(user.uid);
        noteData = notes.find(n => n.id === id);
      } else {
        // Load from Firebase when online - FIXED: Added userId parameter
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
  };

  const handleSave = async () => {
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
          // FIXED: Added userId parameter
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
          // FIXED: Added userId parameter
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
  };

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

  // Auto-save functionality
  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if ((note.title || note.content) && !saving && id) {
        handleSave();
      }
    }, 5000); // Auto-save after 5 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [note]);

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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="editor-content">
        <input
          type="text"
          placeholder="Note Title..."
          value={note.title}
          onChange={(e) => setNote({ ...note, title: e.target.value })}
          className="note-title-input"
        />

        <div className="tags-section">
          <div className="tag-input-container">
            <input
              type="text"
              placeholder="Add tags..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="tag-input"
            />
            <button onClick={handleAddTag} className="add-tag-btn">
              Add Tag
            </button>
          </div>
          <div className="tags-list">
            {note.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
                <button 
                  onClick={() => handleRemoveTag(tag)}
                  className="remove-tag"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Write your note here... (Auto-saves every 5 seconds)"
          value={note.content}
          onChange={(e) => setNote({ ...note, content: e.target.value })}
          className="note-content-input"
        />
      </div>

      <div className="editor-footer">
        <p>
          🔒 End-to-end encrypted • 
          {isOffline ? ' 📵 Offline (will sync when online)' : ' ☁️ Online'}
        </p>
      </div>
    </div>
  );
}

export default NoteEditor;