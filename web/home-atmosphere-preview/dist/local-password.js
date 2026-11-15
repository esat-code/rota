// Local preview lock only. No account, network request, or plain-text password.
const KEY = 'rota-home-local-password-v1';
const iterations = 210000;
export function storage() {
  try { if (window.parent !== window && window.parent.localStorage) return window.parent.localStorage; } catch {}
  return localStorage;
}
function saved() { if (window.parent !== window) window.parent.postMessage({type:'rota:password-saved'}, '*'); }
export function readPassword() {
  const raw = storage().getItem(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{64}$/.test(value.hash)) {
    throw Error('Şifre kaydı okunamadı.');
  }
  return value;
}
const hex = bytes => [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: Uint8Array.from(salt.match(/../g), n => parseInt(n,16)), iterations, hash: 'SHA-256'}, key, 256);
  return hex(new Uint8Array(bits));
}
export async function matchesPassword(password) {
  const record = readPassword();
  return !record || await derive(password, record.salt) === record.hash;
}
export async function savePassword(password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derive(password, salt);
  storage().setItem(KEY, JSON.stringify({salt, hash}));
  saved();
}
export function removePassword() { storage().removeItem(KEY); saved(); }
