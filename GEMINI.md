# GEMINI.md - Project Overview

This document provides a high-level overview of the `standalone-backend` application, intended for context when interacting with other Gemini instances.

## 1. Project Purpose

This is a **Node.js and Express-based backend** for the DJ booking application. It provides a secure API for both the user-facing frontend and the admin dashboard.

## 2. Technology Stack

*   **Framework:** Express.js
*   **Authentication:** Firebase Admin SDK
*   **Database:** Firebase Firestore
*   **Calendar Integration:** Google Calendar API
*   **Email:** Nodemailer

## 3. API Endpoints

### User-Facing API

*   **`POST /api/check-booked-slots`**: Checks for conflicting bookings.
*   **`POST /api/confirm-booking`**: Creates or updates a booking.
*   **`POST /api/cancel-booking`**: Cancels a booking.
*   **`POST /api/confirm-payment`**: Confirms a payment for a booking.

### Admin API

*   **`GET /api/admin/bookings`**: Retrieves all bookings.
*   **`POST /api/admin/bookings`**: Creates a new booking.
*   **`POST /api/admin/send-login-details`**: Sends login details to a user.

## 4. Related Projects

*   **User-Facing Frontend:** A `vite-project` that provides the user-facing booking interface.
*   **Admin Dashboard:** A separate `admin-front-end` project that provides an administrative interface for managing the application.
