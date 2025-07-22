// standalone-backend/server.js

require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = require('./googleCalendar');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

const APP_ID_FOR_FIRESTORE_PATH = process.env.FIREBASE_PROJECT_ID || 'booking-app-1af02';
// Check for essential environment variables
if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  console.error("ERROR: GMAIL_USER and GMAIL_PASS environment variables must be set for Nodemailer to function.");
  process.exit(1); // Exit if critical env vars are missing
}

if (!process.env.FRONTEND_URL) {
  console.warn("WARNING: FRONTEND_URL environment variable is not set. Payment confirmation links in admin emails will be incomplete.");
}

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

const adminOnly = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const userProfilePath = `artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/profiles/userProfile`;
    const userDocRef = db.doc(userProfilePath);
    const userDocSnap = await userDocRef.get();

    if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
      next();
    } else {
      res.status(403).send({ error: 'Forbidden: Not an administrator.' });
    }
  } catch (error) {
    console.error('Error in adminOnly middleware:', error);
    res.status(500).send({ error: 'Internal Server Error during admin check.' });
  }
};

// Helper function to send booking-related emails
const sendBookingEmails = async (type, bookingData, userEmail, bookingId = null) => {
    const subjectMap = {
        create: 'Booking Creation Confirmed',
        update: 'Booking Edited',
        cancel: 'Booking Cancelled'
    };
    const subject = subjectMap[type] || 'Booking Notification';

    const bookingDetails = `
        Booking ID: ${bookingId || 'N/A'}
        User Name: ${bookingData.userName}
        Date: ${bookingData.date}
        Time: ${bookingData.time}
        ${type === 'cancel' ? '' : `Duration: ${bookingData.duration} hours`}
        ${type === 'cancel' ? '' : (bookingData.equipment && bookingData.equipment.length > 0 ? `Equipment: ${bookingData.equipment.map(item => item.name || item.id || 'Unknown Equipment').join(', ')}` : '')}
        ${type === 'cancel' ? '' : (bookingData.paymentStatus ? `Payment Status: ${bookingData.paymentStatus}` : '')}
    `;

    // Email to client
    const mailOptionsToClient = {
        from: process.env.GMAIL_USER,
        to: userEmail,
        subject: subject,
        text: `Dear ${bookingData.userName},

Your booking has been ${type}d.

Details:
${bookingDetails}

Thank you.`
    };
    transporter.sendMail(mailOptionsToClient).catch(err => console.error(`Error sending client ${type} email:`, err));

    // Email to admin
    const adminDashboardLink = 'http://localhost:5173';
    const adminText = `A booking has been ${type}d.

Details:
${bookingDetails}${type === 'cancel' ? '' : `

Go to Admin Dashboard: ${adminDashboardLink}`}`;

    const mailOptionsToAdmin = {
        from: process.env.GMAIL_USER,
        to: ADMIN_EMAIL,
        subject: `Admin Notification: ${subject}`,
        text: adminText
    };
    transporter.sendMail(mailOptionsToAdmin).catch(err => console.error(`Error sending admin ${type} email:`, err));
};


// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Unauthorized' });
  }
};

app.post('/api/update-profile', authenticate, async (req, res) => {
  const { displayName, email } = req.body;
  const { uid } = req.user;

  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    return res.status(400).send({ error: 'The "displayName" argument is required and must be a non-empty string.' });
  }

  try {
    await admin.auth().updateUser(uid, {
      displayName: displayName.trim(),
    });

    const userProfileDocRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/profiles/userProfile`);
    await userProfileDocRef.set({
      userId: uid,
      displayName: displayName.trim(),
      email: email, // Add this line to save the email
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.send({ success: true, message: 'User profile updated successfully!' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).send({ error: 'Failed to update user profile due to a server error.' });
  }
});

app.post('/api/confirm-booking', authenticate, async (req, res) => {
    const { bookingData, userName, editingBookingId } = req.body;
    const { uid, email } = req.user;

    try {
        let bookingId = editingBookingId;
        if (editingBookingId) {
            const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${editingBookingId}`);
            const doc = await bookingRef.get();
            if (!doc.exists) {
                return res.status(404).send({ error: 'Booking to update not found.' });
            }
            const existingBookingData = doc.data();
            let googleEventId = existingBookingData.googleEventId;
            const userRecordForCalendar = await admin.auth().getUser(uid);
            const userEmailForCalendar = userRecordForCalendar.email;

            await bookingRef.update({ ...bookingData, userName, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });

            const enrichedBookingData = { ...bookingData, userName };

            if (googleEventId) {
                await updateCalendarEvent(googleEventId, enrichedBookingData, userEmailForCalendar);
            } else {
                console.log(`GoogleEventId missing for booking ${editingBookingId} (main app). Creating new calendar event.`);
                // If googleEventId is missing (e.g., for old bookings), create a new event
                googleEventId = await createCalendarEvent(editingBookingId, enrichedBookingData, userEmailForCalendar);
                await bookingRef.update({ googleEventId });
            }
        } else {
            const userRecordForCalendar = await admin.auth().getUser(uid);
            const userEmailForCalendar = userRecordForCalendar.email;
            const bookingRef = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings`).add({
                ...bookingData,
                userName,
                userId: uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            bookingId = bookingRef.id;
            const googleEventId = await createCalendarEvent(bookingId, { ...bookingData, userName }, userEmailForCalendar);
            await bookingRef.update({ googleEventId });
        }

        // Send confirmation email to client and admin
        await sendBookingEmails(editingBookingId ? 'update' : 'create', { ...bookingData, userName }, email, bookingId);

        res.send({ success: true, bookingId });
    } catch (error) {
        console.error('Error in /api/confirm-booking:', error);
        res.status(500).send({ error: 'Failed to confirm booking.', details: error.message });
    }
});

app.post('/api/cancel-booking', authenticate, async (req, res) => {
    const { bookingId } = req.body;
    const { uid } = req.user;

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${bookingId}`);
        const doc = await bookingRef.get();
        if (!doc.exists) {
            return res.status(404).send({ error: 'Booking not found.' });
        }
        const existingBookingData = doc.data();
        const googleEventId = existingBookingData.googleEventId;
        await bookingRef.delete();
        await deleteCalendarEvent(googleEventId);
        await sendBookingEmails('cancel', existingBookingData, req.user.email, bookingId);
        res.send({ success: true, message: 'Booking cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).send({ error: 'Failed to cancel booking.' });
    }
});

app.get('/api/check-booked-slots', authenticate, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).send({ error: 'Date parameter is required.' });
    }

    try {
        const bookingsSnapshot = await db.collectionGroup('bookings').get();
        const bookedSlots = bookingsSnapshot.docs.map(doc => doc.data());
        res.send({ bookedSlots });
    } catch (error) {
        console.error('Error fetching booked slots:', error);
        res.status(500).send({ error: 'Failed to fetch booked slots.', details: error.message });
    }
});

app.post('/api/confirm-payment', authenticate, async (req, res) => {
    const { bookingId } = req.body;
    const { uid } = req.user;

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings/${bookingId}`);
        await bookingRef.update({ paymentStatus: 'paid' });
        res.send({ success: true, message: 'Payment confirmed successfully!' });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).send({ error: 'Failed to confirm payment.' });
    }
});

// Admin routes
app.get('/api/admin/bookings', authenticate, adminOnly, async (req, res) => {
    // Add admin role check here in the future
    try {
        const bookingsSnapshot = await db.collectionGroup('bookings').orderBy('date', 'desc').get();
        const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(bookings);
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        res.status(500).send({ error: 'Failed to fetch all bookings.' });
    }
});

// GET /api/admin/users - Fetches all user profiles for the admin dropdown
app.get('/api/admin/users', authenticate, adminOnly, async (req, res) => {
  try {
    // Assumes you have admin-checking middleware that has already verified the user
    console.log('Request received for /api/admin/users');

    const profilesRef = db.collectionGroup('profiles');
    const snapshot = await profilesRef.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const usersList = [];
    snapshot.forEach(doc => {
      // The user's ID is the ID of the parent document of the 'profiles' subcollection
      const userId = doc.ref.parent.parent.id;
      usersList.push({
        id: userId,
        ...doc.data()
      });
    });

    res.status(200).json(usersList);

  } catch (error) {
    console.error('Error fetching all user profiles:', error);
    res.status(500).json({ message: 'Failed to fetch user profiles.' });
  }
});

app.post('/api/admin/bookings', authenticate, adminOnly, async (req, res) => {
    // Add admin role check here in the future
    const { bookingData, userName, userEmail } = req.body;""

    try {
        const userRecord = await admin.auth().getUserByEmail(userEmail);
        const uid = userRecord.uid;

        const bookingRef = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${uid}/bookings`).add({
            ...bookingData,
            userName,
            userId: uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const bookingId = bookingRef.id;
        const googleEventId = await createCalendarEvent(bookingId, { ...bookingData, userName }, userEmail);
        await bookingRef.update({ googleEventId });
        await sendBookingEmails('create', { ...bookingData, userName }, userEmail, bookingId);
        res.send({ success: true, bookingId });
    } catch (error) {
        console.error('Error creating booking for user:', error);
        res.status(500).send({ error: 'Failed to create booking for user.' });
    }
});


// New endpoint for admin to create a user
app.post('/api/admin/create-user', authenticate, adminOnly, async (req, res) => {
    try {
        

        const { email, displayName } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        // Generate a temporary password for user creation, it won't be sent to the user
        const generateRandomPassword = (length = 12) => {
            const lowerCaseChars = "abcdefghijklmnopqrstuvwxyz";
            const upperCaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const numericChars = "0123456789";
            const specialChars = "!@#$%^&*()_+";
            const allChars = lowerCaseChars + upperCaseChars + numericChars + specialChars;

            let password = [
                lowerCaseChars[Math.floor(Math.random() * lowerCaseChars.length)],
                upperCaseChars[Math.floor(Math.random() * upperCaseChars.length)],
                numericChars[Math.floor(Math.random() * numericChars.length)],
                specialChars[Math.floor(Math.random() * specialChars.length)]
            ];

            for (let i = password.length; i < length; i++) {
                password.push(allChars[Math.floor(Math.random() * allChars.length)]);
            }

            return password.sort(() => Math.random() - 0.5).join('');
        };
        const tempPassword = generateRandomPassword();

        const userRecord = await admin.auth().createUser({
            email: email,
            password: tempPassword, // Use a temporary password for creation
            displayName: displayName,
        });

        // Generate a password reset link
        const link = await admin.auth().generatePasswordResetLink(email);

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Set Up Your Showroom Booking App Account',
            html: `<p>Hello ${displayName || email},</p>
                   <p>Polar has created an account for you to use the Showroom Booking App.</p>
                   <p>To set up your password and log in, please click on the link below:</p>
                   <p><a href="${link}">Set Your Password</a></p>
                   <p>This link is valid for a single use and will expire after a short period.</p>
                   <p>You can access the app here: <a href="${process.env.FRONTEND_URL || '[Link to App Here]'}">${process.env.FRONTEND_URL || '[Link to App Here]'}</a></p>
                   <p>Thank you,</p>
                   <p>The Polar Team</p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending account setup email:', error);
            } else {
                console.log('Account setup email sent:', info.response);
            }
        });

        res.status(201).json({ uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName });

        // Create a Firestore profile for the new user
        const userProfileDocRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userRecord.uid}/profiles/userProfile`);
        await userProfileDocRef.set({
            userId: userRecord.uid,
            displayName: displayName || email, // Use displayName if provided, otherwise email
            email: email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error creating new user by admin:', error);
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ message: 'The email address is already in use by another account.' });
        }
        res.status(500).json({ message: 'Failed to create user', error: error.message });
    }
});




// Admin endpoint to confirm/update any booking
app.post('/api/admin/confirm-booking', authenticate, adminOnly, async (req, res) => {
    const { bookingData, userName, editingBookingId, userId } = req.body;

    if (!userId) {
        return res.status(400).send({ error: 'User ID is required for admin booking operations.' });
    }

    try {
        let bookingId = editingBookingId;
        if (editingBookingId) {
            const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userId}/bookings/${editingBookingId}`);
            const doc = await bookingRef.get();
            if (!doc.exists) {
                return res.status(404).send({ error: 'Booking to update not found for the specified user.' });
            }
            const existingBookingData = doc.data();
            let googleEventId = existingBookingData.googleEventId;
            const userRecordForCalendar = await admin.auth().getUser(userId);
            const userEmailForCalendar = userRecordForCalendar.email;

            await bookingRef.update({ ...bookingData, userName, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });

            const enrichedBookingData = { ...bookingData, userName };

            if (googleEventId) {
                await updateCalendarEvent(googleEventId, enrichedBookingData, userEmailForCalendar);
            } else {
                // If googleEventId is missing (e.g., for old bookings), create a new event
                googleEventId = await createCalendarEvent(editingBookingId, enrichedBookingData, userEmailForCalendar);
                await bookingRef.update({ googleEventId });
            }
        } else {
            const userRecordForCalendar = await admin.auth().getUser(userId);
            const userEmailForCalendar = userRecordForCalendar.email;
            const bookingRef = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userId}/bookings`).add({
                ...bookingData,
                userName,
                userId: userId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            bookingId = bookingRef.id;
            const googleEventId = await createCalendarEvent(bookingId, { ...bookingData, userName }, userEmailForCalendar);
            await bookingRef.update({ googleEventId });
        }

        // Send confirmation email to client and admin
        const userRecord = await admin.auth().getUser(userId);
        const clientEmail = userRecord.email;
        await sendBookingEmails(editingBookingId ? 'update' : 'create', { ...bookingData, userName }, clientEmail, bookingId);

        res.send({ success: true, bookingId });
    } catch (error) {
        console.error('Error in /api/admin/confirm-booking:', error);
        res.status(500).send({ error: 'Failed to confirm booking by admin.', details: error.message });
    }
});

// Admin endpoint to cancel any booking
app.post('/api/admin/cancel-booking', authenticate, adminOnly, async (req, res) => {
    const { bookingId, userId } = req.body; // Admin needs to specify which user's booking to cancel

    if (!bookingId || !userId) {
        return res.status(400).send({ error: 'Booking ID and User ID are required.' });
    }

    try {
        const bookingRef = db.doc(`artifacts/${APP_ID_FOR_FIRESTORE_PATH}/users/${userId}/bookings/${bookingId}`);
        const doc = await bookingRef.get();

        if (!doc.exists) {
            return res.status(404).send({ error: 'Booking not found for the specified user.' });
        }

        const existingBookingData = doc.data();
        const googleEventId = existingBookingData.googleEventId;

        await bookingRef.delete();
        if (googleEventId) {
            await deleteCalendarEvent(googleEventId);
        }
        const userRecord = await admin.auth().getUser(userId);
        const clientEmail = userRecord.email;
        await sendBookingEmails('cancel', existingBookingData, clientEmail, bookingId);
        res.send({ success: true, message: 'Booking cancelled successfully by admin.' });
    } catch (error) {
        console.error('Error cancelling booking by admin:', error);
        res.status(500).send({ error: 'Failed to cancel booking by admin.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});