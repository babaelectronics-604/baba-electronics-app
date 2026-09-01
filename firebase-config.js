/* ============================================================
   FIREBASE CONFIG
   ============================================================
   Replace the values below with your own Firebase project's
   config. Get it from: Firebase Console → your project →
   ⚙️ Project settings → General tab → scroll to "Your apps" →
   click the web app (</>) → copy the firebaseConfig object.

   These values are safe to be public in your website's code —
   that's normal for Firebase. Security is enforced separately
   by Firestore Rules and Authentication, not by hiding these.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDFv35dJalFNGgm6T7oMVSx0D3jhXkrJZI",
    authDomain: "baba-electronics-2026.firebaseapp.com",
    projectId: "baba-electronics-2026",
    storageBucket: "baba-electronics-2026.firebasestorage.app",
    messagingSenderId: "1055377430450",
    appId: "1:1055377430450:web:c0f885e250bd860e4776ab",
    measurementId: "G-78S1RSJEX7"
};

let db = null;
let auth = null;

// Only initializes if the placeholder values above have been replaced.
// This lets the rest of the site keep working even before Firebase is set up.
if (firebaseConfig.apiKey !== "AIzaSyDFv35dJalFNGgm6T7oMVSx0D3jhXkrJZI") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
}

function isFirebaseReady() {
  return db !== null;
}
