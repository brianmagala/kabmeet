// Browser side of Web Push. The bell never depends on any of this.

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyToBytes(base64Url: string): Uint8Array {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type PushResult = 'on' | 'denied' | 'unsupported' | 'failed';

/** Asks the browser for permission (must run from a tap) and registers this browser with the server. */
export async function enablePush(
  publicKey: string,
  send: (url: string, body: unknown) => Promise<unknown>,
): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) as BufferSource }));
    await send('/api/notifications/push/subscribe', sub.toJSON());
    return 'on';
  } catch {
    return 'failed';
  }
}

export async function disablePush(send: (url: string, body: unknown) => Promise<unknown>): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* the server forgets it anyway */
  }
  await send('/api/notifications/push/unsubscribe', { endpoint });
}

/** Called after a successful follow. The page that owns the opt-in card listens for it. */
export const announceFollow = (): void => {
  window.dispatchEvent(new Event('kabmeet:followed'));
};
