/**
 * Firebase client — Phone OTP + FCM push notifications.
 * Config is read from VITE_FB_* env vars. Get these from your Firebase
 * Console → Project Settings → General → "Your apps" → Web app config.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FB_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FB_APP_ID as string | undefined,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let messaging: Messaging | null = null;

export function isFirebaseConfigured() {
  return !!(config.apiKey && config.projectId && config.appId && config.messagingSenderId);
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add VITE_FB_API_KEY, VITE_FB_AUTH_DOMAIN, VITE_FB_PROJECT_ID, VITE_FB_STORAGE_BUCKET, VITE_FB_MESSAGING_SENDER_ID, VITE_FB_APP_ID to your project secrets.",
    );
  }
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config as any);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  messaging = getMessaging(getFirebaseApp());
  return messaging;
}

export const VAPID_KEY = import.meta.env.VITE_FB_VAPID_KEY as string | undefined;
