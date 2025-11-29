const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Make sure this path is correct

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// IMPORTANT: Replace 'booking-app-1af02' with your Firebase Project ID.
const APP_ID_FOR_FIRESTORE_PATH = 'booking-app-1af02'; 

async function migrateBookingsCompletionState() {
  console.log('Starting migration to add completionState to existing bookings...');
  const usersSnapshot = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users`).get();
  console.log(`Found ${usersSnapshot.docs.length} users.`);

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const bookingsSnapshot = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userId}/bookings`).get();

    for (const bookingDoc of bookingsSnapshot.docs) {
      const bookingData = bookingDoc.data();
      if (!bookingData.completionState) { // Check if completionState is missing
        console.log(`Updating booking ${bookingDoc.id} for user ${userId} with completionState: 'open'`);
        await bookingDoc.ref.update({ completionState: 'open' });
      }
    }
  }
  console.log('Finished migration for completionState.');
}

migrateBookingsCompletionState().catch(console.error);
