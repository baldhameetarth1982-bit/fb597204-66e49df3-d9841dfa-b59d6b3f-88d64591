/**
 * FCM push notifications: request permission, fetch token, save to backend.
 */
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging, isFirebaseConfigured, VAPID_KEY } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function enablePushNotifications(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  if (!isFirebaseConfigured()) return { ok: false, reason: "Firebase not configured." };
  if (typeof window === "undefined" || !("Notification" in window))
    return { ok: false, reason: "This device does not support notifications." };
  if (!VAPID_KEY) return { ok: false, reason: "VITE_FB_VAPID_KEY missing." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission denied." };

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { ok: false, reason: "Messaging unsupported in this browser." };

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e: any) {
    return { ok: false, reason: "Service worker failed: " + e.message };
  }

  let token: string;
  try {
    token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  } catch (e: any) {
    return { ok: false, reason: e.message ?? "Could not retrieve token." };
  }
  if (!token) return { ok: false, reason: "Empty token from FCM." };

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, reason: "Sign in first." };

  const { error } = await (supabase as any).from("fcm_tokens").upsert(
    {
      user_id: u.user.id,
      token,
      platform: "web",
      device_info: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "token" },
  );
  if (error) return { ok: false, reason: error.message };

  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "New notification";
    const body = payload.notification?.body ?? "";
    toast(title, { description: body });
  });

  return { ok: true, token };
}
