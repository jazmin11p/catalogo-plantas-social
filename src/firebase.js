import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyByy4wD1QoXgV3Jja4YwrUNtVRkA8MSe9Q",
  authDomain: "catalogo-de-vegetacion.firebaseapp.com",
  projectId: "catalogo-de-vegetacion",
  storageBucket: "catalogo-de-vegetacion.firebasestorage.app",
  messagingSenderId: "3627720742",
  appId: "1:3627720742:web:1110f83c357f23f8f306e7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
