import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { VendorItem, WeddingConfig } from '../types';
import { formatIDR, getVendorRemaining } from '../utils/formatters';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory only caching per security instructions (never localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleWorkspaceSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Token akses Google tidak diterima. Silakan coba masuk kembali.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => cachedAccessToken;

export const googleWorkspaceLogout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface GoogleCalendarEventSummary {
  id: string;
  summary: string;
  start: string;
  htmlLink?: string;
}

export async function syncVendorToGoogleCalendar(
  accessToken: string,
  vendor: VendorItem,
  config: WeddingConfig
): Promise<{ eventId: string; htmlLink?: string }> {
  const remaining = getVendorRemaining(vendor);
  const targetDate = (vendor.dueDate || vendor.eventDate || config.weddingDate.split('T')[0]).split('T')[0];
  const nextDayDate = new Date(`${targetDate}T00:00:00`);
  nextDayDate.setDate(nextDayDate.getDate() + 1);
  const endDate = nextDayDate.toISOString().split('T')[0];

  const eventPayload = {
    summary:
      remaining > 0
        ? `[Tagihan Vendor] ${vendor.name} — Sisa ${formatIDR(remaining)}`
        : `[Terjadwal] ${vendor.name} — ${vendor.eventLabel || 'Lunas'}`,
    location: `${config.venueName}, ${config.city}`,
    description: [
      `Pernikahan: ${config.coupleNames}`,
      `Kategori: ${vendor.category}`,
      `PIC: ${vendor.picName} (${vendor.picPhone})`,
      `Layanan: ${vendor.serviceDescription}`,
      `Jadwal Acara Vendor: ${vendor.eventLabel || '-'} (${vendor.eventDate || '-'})`,
      `Nilai Kontrak: ${formatIDR(vendor.contractPrice || vendor.estimatedPrice)}`,
      `Sudah Dibayar: ${formatIDR(vendor.paidAmount)}`,
      `Sisa Tagihan: ${formatIDR(remaining)}`,
      vendor.notes ? `Catatan: ${vendor.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { date: targetDate },
    end: { date: endDate },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 },
        { method: 'popup', minutes: 3 * 24 * 60 },
        { method: 'email', minutes: 7 * 24 * 60 },
      ],
    },
  };

  const isUpdate = Boolean(vendor.calendarEventId);
  const url = isUpdate
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(vendor.calendarEventId!)}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const res = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (res.status === 404 && isUpdate) {
    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Gagal menyinkronkan ke Google Calendar: ${errText}`);
    }
    const created = await createRes.json();
    return { eventId: created.id, htmlLink: created.htmlLink };
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menyinkronkan ke Google Calendar: ${errText}`);
  }

  const data = await res.json();
  return { eventId: data.id, htmlLink: data.htmlLink };
}

export async function fetchUpcomingGoogleCalendarEvents(
  accessToken: string
): Promise<GoogleCalendarEventSummary[]> {
  const timeMin = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal mengambil agenda Google Calendar: ${errText}`);
  }
  const data = await res.json();
  return (data.items || []).map((item: { id: string; summary?: string; start?: { date?: string; dateTime?: string }; htmlLink?: string }) => ({
    id: item.id,
    summary: item.summary || '(Tanpa Judul)',
    start: item.start?.date || item.start?.dateTime || '',
    htmlLink: item.htmlLink,
  }));
}

export async function deleteGoogleCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errText = await res.text();
    throw new Error(`Gagal menghapus acara dari Google Calendar: ${errText}`);
  }
}
