// src/components/Auth/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, getUserEncryptionSalt } from '../../services/firebase';
import encryptionService from '../../services/encryption';
import notesDB from '../../services/indexedDB';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    encryptionPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign in with Firebase
      const user = await loginUser(formData.email, formData.password);

      // Get user's encryption salt from Firestore
      const salt = await getUserEncryptionSalt(user.uid);
      
      if (salt) {
        // Derive encryption key from password
        const { key } = await encryptionService.deriveKeyFromPassword(
          formData.encryptionPassword || formData.password,
          salt
        );
        
        // Set the master key for this session
        encryptionService.setMasterKey(key);
        
        // Save salt locally for offline access
        await notesDB.saveEncryptionSalt(user.uid, salt);
      } else {
        // First time login - create encryption key
        const { key, salt: newSalt } = await encryptionService.deriveKeyFromPassword(
          formData.encryptionPassword || formData.password
        );
        
        encryptionService.setMasterKey(key);
        
        // Save salt to Firestore and locally
        const { saveUserEncryptionSalt } = await import('../../services/firebase');
        await saveUserEncryptionSalt(user.uid, newSalt);
        await notesDB.saveEncryptionSalt(user.uid, newSalt);
      }

      navigate('/notes');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🔐 Login to Secure Notes</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Your account password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="encryptionPassword">
              Encryption Password (Optional)
              <small>Leave empty to use account password for encryption</small>
            </label>
            <input
              type="password"
              id="encryptionPassword"
              name="encryptionPassword"
              value={formData.encryptionPassword}
              onChange={handleChange}
              placeholder="Separate encryption password"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register</Link></p>
        </div>

        <div className="security-note">
          <p>🔒 Your notes are encrypted end-to-end. We never see your data.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;