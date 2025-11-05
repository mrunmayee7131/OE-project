// src/components/Auth/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, getUserEncryptionSalt, saveUserEncryptionSalt } from '../../services/firebase';
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
      let salt = await getUserEncryptionSalt(user.uid);
      
      // Use encryption password if provided, otherwise use login password
      const encryptionPassword = formData.encryptionPassword || formData.password;
      
      if (!salt) {
        // First time login - create encryption key
        console.log('First time login - generating encryption key');
        const derivedKey = await encryptionService.deriveKeyFromPassword(encryptionPassword);
        
        encryptionService.setMasterKey(derivedKey.key);
        
        // Save salt to Firestore and locally
        await saveUserEncryptionSalt(user.uid, derivedKey.salt);
        await notesDB.saveEncryptionSalt(user.uid, derivedKey.salt);
        
        console.log('Encryption key generated and saved');
      } else {
        // Existing user - derive key from stored salt
        console.log('Existing user - deriving key from stored salt');
        const derivedKey = await encryptionService.deriveKeyFromPassword(
          encryptionPassword,
          salt
        );
        
        // Set the master key for this session
        encryptionService.setMasterKey(derivedKey.key);
        
        // Save salt locally for offline access
        await notesDB.saveEncryptionSalt(user.uid, salt);
        
        console.log('Encryption key set from existing salt');
      }

      // Store encryption key in session storage as backup
      sessionStorage.setItem('encKey', encryptionService.getMasterKey());

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
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="encryptionPassword"
              placeholder="Encryption Password (optional)"
              value={formData.encryptionPassword}
              onChange={handleChange}
              className="form-input"
            />
            <small className="help-text">
              Leave empty to use your login password for encryption
            </small>
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;