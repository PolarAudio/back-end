# Project Style Guide

This document outlines the coding conventions and architectural patterns observed in this project. Adhering to these guidelines ensures consistency, readability, and maintainability across the codebase.

## 1. General Principles

*   **Consistency is Key:** Always prioritize consistency with existing code. If a guideline here conflicts with a strong existing pattern, follow the existing pattern and consider updating this guide.
*   **Readability:** Write code that is easy to understand for other developers.
*   **Modularity:** Break down complex logic into smaller, reusable functions and components.

## 2. File Naming and Structure

*   **Components:** React components should be named in `PascalCase` and reside in `.jsx` files (e.g., `MyComponent.jsx`).
*   **Utility/Constant Files:** JavaScript utility and constant files should be named in `camelCase` and reside in `.js` files (e.g., `utils.js`, `constants.js`).
*   **Directories:** Directory names should be `camelCase` (e.g., `components`, `firebase`, `assets`).
*   **Root Files:** Main application files (e.g., `App.jsx`, `main.jsx`, `index.css`) reside in the `src` root.
*   **Dedicated Folders:**
    *   `components/`: For reusable React components.
    *   `firebase/`: For Firebase initialization, rules, and utility functions.
    *   `assets/`: For static assets like images.

## 3. React Components

*   **Functional Components & Hooks:** Prefer functional components with React Hooks for state and lifecycle management.
*   **Props Destructuring:** Destructure props in the function signature for clarity.
*   **Inline Styling (Utility Classes):** Prefer Tailwind CSS utility classes for styling directly within JSX `className` attributes. Avoid inline `style` objects unless for dynamic, computed styles.
*   **State Management:** Use `useState` and `useReducer` for local component state. For global state, Firebase's real-time listeners are used.
*   **Memoization:** Use `useMemo` and `useCallback` for optimizing performance of expensive calculations or preventing unnecessary re-renders of child components, especially for functions passed as props.

## 4. JavaScript/TypeScript

*   **ES Modules:** Use `import` and `export` syntax.
*   **Relative Imports:** Use relative paths for imports within the project (e.g., `import { db } from './firebase/init';`).
*   **Constants:** Define global or widely used constants in `constants.js`.
*   **Utility Functions:** Place reusable helper functions in `utils.js`.
*   **Firebase Integration:**
    *   Firebase app, database (Firestore), and authentication instances are initialized in `firebase/init.js`.
    *   Firebase-related utility functions (e.g., `getFirebaseProjectId`) are in `firebase/utils.js`.
    *   Firebase authentication functions (e.g., `onAuthStateChanged`, `signInWithCustomToken`, `updateProfile`, `updatePassword`) are imported directly from `firebase/auth`.
    *   Firestore functions (e.g., `collection`, `query`, `addDoc`, `onSnapshot`) are imported directly from `firebase/firestore`.

## 5. Styling

*   **CSS Files:** Global styles are defined in `index.css` and `App.css`.
*   **Tailwind CSS:** The project utilizes Tailwind CSS for rapid UI development. Apply utility classes directly in JSX.

## 6. Backend Interaction

*   **API Base URL:** The backend API base URL is configured via environment variables (`import.meta.env.VITE_BACKEND_API_BASE_URL`).
*   **Fetch API:** Use the native `fetch` API for making HTTP requests to the backend.
*   **Authentication Headers:** Include `Authorization: Bearer <idToken>` for authenticated API calls.

## 7. Firebase Security Rules

*   **`firestore.rules`:** Firebase Firestore security rules are defined in `src/firebase/rules.js`.
*   **Helper Functions:** Rules utilize helper functions (`isAuthenticated()`, `getUserId()`, `isAdmin()`) for clarity and reusability.
*   **User-Specific Access:** Rules enforce that users can only read/write their own data (e.g., profiles, bookings).
*   **Admin Access:** Specific rules grant broader access (read/write all bookings) to users with an 'admin' role, as determined by their user profile data.
*   **`appId` Consistency:** Ensure the `appId` used in rules matches the `APP_ID_FOR_FIRESTORE_PATH` derived in the frontend.

## 8. Error Handling

*   **UI Feedback:** Provide clear error messages to the user in the UI (e.g., `error` state, `profileError`, `paymentConfirmMessage`).
*   **Console Logging:** Use `console.error` for logging errors during development.

## 9. Routing

*   **React Router DOM:** Use `react-router-dom` for client-side routing. `Routes` and `Route` components define application paths.

---
