import { initializeApp } from '@firebase/app';
import { getAuth, GoogleAuthProvider } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import { getStorage } from '@firebase/storage';

// As per platform requirements, Firebase configuration is sourced from
// pre-configured and secure environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyDKXCuKc6n5C6-I7SytEiArAmSCALYFQ4c",
  authDomain: "web-pro-b6021.firebaseapp.com",
  databaseURL: "https://web-pro-b6021.firebaseio.com",
  projectId: "web-pro-b6021",
  storageBucket: "web-pro-b6021.appspot.com",
  messagingSenderId: "577328773626",
  appId: "1:577328773626:web:f871daab25a299eb6acc43"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();