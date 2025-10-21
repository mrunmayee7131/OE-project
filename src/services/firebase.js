// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Firebase configuration - Using Create React App environment variables (REACT_APP_ prefix)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate Firebase config
if (!firebaseConfig.apiKey) {
  console.error('Firebase configuration is missing. Please check your .env file.');
  console.error('Make sure all environment variables start with REACT_APP_');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence enabled in first tab only');
  } else if (err.code === 'unimplemented') {
    console.warn('Browser doesn\'t support persistence');
  }
});

// Auth functions
export const registerUser = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    return user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore functions for notes
export const saveNote = async (userId, noteData) => {
  try {
    const noteRef = doc(collection(db, 'users', userId, 'notes'));
    const noteId = noteRef.id;

    await setDoc(noteRef, {
      ...noteData,
      id: noteId,
      userId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return noteId;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
};

export const updateNote = async (userId, noteId, noteData) => {
  try {
    const noteRef = doc(db, 'users', userId, 'notes', noteId);
    await updateDoc(noteRef, {
      ...noteData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

export const deleteNote = async (userId, noteId) => {
  try {
    const noteRef = doc(db, 'users', userId, 'notes', noteId);
    await deleteDoc(noteRef);
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

export const getNotes = async (userId) => {
  try {
    const notesRef = collection(db, 'users', userId, 'notes');
    const q = query(notesRef, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const notes = [];
    querySnapshot.forEach((doc) => {
      notes.push({ id: doc.id, ...doc.data() });
    });

    return notes;
  } catch (error) {
    console.error('Error getting notes:', error);
    throw error;
  }
};

export const getNote = async (userId, noteId) => {
  try {
    const noteRef = doc(db, 'users', userId, 'notes', noteId);
    const noteSnap = await getDoc(noteRef);

    if (noteSnap.exists()) {
      return { id: noteSnap.id, ...noteSnap.data() };
    } else {
      throw new Error('Note not found');
    }
  } catch (error) {
    console.error('Error getting note:', error);
    throw error;
  }
};

// Encryption salt functions
export const saveUserEncryptionSalt = async (userId, salt) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      encryptionSalt: salt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving encryption salt:', error);
    throw error;
  }
};

export const getUserEncryptionSalt = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().encryptionSalt) {
      return userSnap.data().encryptionSalt;
    }
    return null;
  } catch (error) {
    console.error('Error getting encryption salt:', error);
    throw error;
  }
};