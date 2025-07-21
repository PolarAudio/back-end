
/*
This file documents the necessary Firestore indexes for the application.

To create the required indexes, follow these steps:
1. Go to your Firebase project console.
2. Navigate to Firestore Database > Indexes.
3. Click on "Composite" and then "Add Index".
4. Use the information below to create the index.

Required Index for Admin Bookings:
- Collection ID: bookings
- Fields to index:
  - date (Descending)
  - timestamp (Descending)
- Query scope: Collection group

Required Index for Admin Users:
- Collection ID: profiles
- Query scope: Collection group
*/
