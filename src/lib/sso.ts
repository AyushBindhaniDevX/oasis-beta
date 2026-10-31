/**
 * Robust SSO Ticket Decoder & Session Manager for Oasis HRMS & HHC
 * Synchronizes session across localStorage keys (oasis_sso_session, smh_sso_session, sso_user_session)
 * and shared cookie sso_user_session
 */
export function decodeSsoTicket(ticket: string): Record<string, any> | null {
  if (!ticket) return null;
  try {
    let clean = decodeURIComponent(ticket).trim();
    let b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) {
      b64 += '=';
    }
    let binary = '';
    if (typeof atob === 'function') {
      binary = atob(b64);
    } else if (typeof (globalThis as any).Buffer !== 'undefined') {
      binary = (globalThis as any).Buffer.from(b64, 'base64').toString('binary');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = typeof TextDecoder !== 'undefined'
      ? new TextDecoder().decode(bytes)
      : decodeURIComponent(escape(binary));
    return JSON.parse(json);
  } catch (e) {
    try {
      if (typeof atob === 'function') {
        return JSON.parse(decodeURIComponent(escape(atob(ticket))));
      }
    } catch (err2) {}
    return null;
  }
}

export function syncSsoSession(decoded: Record<string, any>, rawTicket?: string): void {
  if (typeof window === 'undefined' || !decoded) return;
  try {
    const str = JSON.stringify(decoded);
    localStorage.setItem('oasis_sso_session', str);
    localStorage.setItem('smh_sso_session', str);
    localStorage.setItem('sso_user_session', str);

    const isProd = window.location.hostname.endsWith('subedge.com');
    const domainPart = isProd ? '; domain=.subedge.com' : '';
    const cookieVal = rawTicket || encodeURIComponent(btoa(unescape(encodeURIComponent(str))));
    document.cookie = `sso_user_session=${cookieVal}; path=/; max-age=86400; SameSite=Lax${domainPart}`;
  } catch (e) {}
}

export function getSsoSession(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL parameters (both query string and hash query for Expo Router Web)
  try {
    let ticketRaw: string | null = null;
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      ticketRaw = params.get('sso_ticket');
    }
    if (!ticketRaw && window.location.hash && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashQuery);
      ticketRaw = hashParams.get('sso_ticket');
    }

    if (ticketRaw) {
      const decoded = decodeSsoTicket(ticketRaw);
      if (decoded && (decoded.uid || decoded.email) && (Date.now() - (decoded.ts || 0)) < 86400000) {
        syncSsoSession(decoded, ticketRaw);
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('sso_ticket');
          cleanUrl.searchParams.delete('app');
          window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.searchParams.toString() ? '?' + cleanUrl.searchParams.toString() : ''));
        } catch (e) {}
        return decoded;
      }
    }
  } catch (e) {}

  // 2. Check Shared Cookie (shared across *.subedge.com or localhost across ports)
  try {
    const match = document.cookie.match(/(^|;\s*)sso_user_session=([^;]*)/);
    if (match && match[2]) {
      const decoded = decodeSsoTicket(decodeURIComponent(match[2]));
      if (decoded && (decoded.uid || decoded.email) && (Date.now() - (decoded.ts || 0)) < 86400000) {
        syncSsoSession(decoded, match[2]);
        return decoded;
      }
    }
  } catch (e) {}

  // 3. Check LocalStorage across all known portal keys
  try {
    const keys = ['oasis_sso_session', 'smh_sso_session', 'sso_user_session'];
    for (const key of keys) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.uid || parsed.email) && (Date.now() - (parsed.ts || 0)) < 86400000) {
          syncSsoSession(parsed);
          return parsed;
        } else {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {}

  return null;
}

export function clearSsoSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('oasis_sso_session');
    localStorage.removeItem('smh_sso_session');
    localStorage.removeItem('sso_user_session');
    const isProd = window.location.hostname.endsWith('subedge.com');
    const domainPart = isProd ? '; domain=.subedge.com' : '';
    document.cookie = `sso_user_session=; path=/; max-age=0; SameSite=Lax${domainPart}`;
  } catch (e) {}
}
