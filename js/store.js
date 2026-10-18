// Dwa magazyny o tym samym interfejsie: lokalny (przeglądarka) i chmurowy (Supabase).
import { ENTRY_COLUMNS, sanitizeEntry } from './entry-model.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const LOCAL_KEY = 'boli-glowa:entries:v1';
const TABLE = 'headache_entries';
const SELECT = [...ENTRY_COLUMNS, 'updated_at'].join(',');
const PAGE = 1000;

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocal(obj) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(obj));
}

export class LocalStore {
  kind = 'local';

  async list() {
    return Object.values(readLocal()).map(sanitizeEntry).filter(Boolean);
  }

  async save(entry) {
    const clean = sanitizeEntry(entry);
    const all = readLocal();
    all[clean.entry_date] = { ...clean, updated_at: new Date().toISOString() };
    writeLocal(all);
    return all[clean.entry_date];
  }

  async saveMany(entries, { overwrite = true } = {}) {
    const all = readLocal();
    let n = 0;
    for (const raw of entries) {
      const e = sanitizeEntry(raw);
      if (!e || (!overwrite && all[e.entry_date])) continue;
      all[e.entry_date] = { ...e, updated_at: new Date().toISOString() };
      n++;
    }
    writeLocal(all);
    return n;
  }

  async remove(date) {
    const all = readLocal();
    delete all[date];
    writeLocal(all);
  }

  count() {
    return Object.keys(readLocal()).length;
  }

  clear() {
    localStorage.removeItem(LOCAL_KEY);
  }
}

export class CloudStore {
  kind = 'cloud';

  constructor(client, user) {
    this.client = client;
    this.user = user;
  }

  row(entry) {
    const clean = sanitizeEntry(entry);
    const row = { user_id: this.user.id };
    for (const k of ENTRY_COLUMNS) row[k] = clean[k];
    return row;
  }

  async list() {
    const out = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await this.client
        .from(TABLE)
        .select(SELECT)
        .order('entry_date')
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) break;
    }
    return out.map(sanitizeEntry).filter(Boolean);
  }

  async save(entry) {
    const { data, error } = await this.client
      .from(TABLE)
      .upsert(this.row(entry), { onConflict: 'user_id,entry_date' })
      .select(SELECT)
      .single();
    if (error) throw error;
    return sanitizeEntry(data);
  }

  async saveMany(entries, { overwrite = true } = {}) {
    const rows = entries.map(sanitizeEntry).filter(Boolean).map((e) => this.row(e));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await this.client
        .from(TABLE)
        .upsert(rows.slice(i, i + 200), { onConflict: 'user_id,entry_date', ignoreDuplicates: !overwrite });
      if (error) throw error;
    }
    return rows.length;
  }

  async remove(date) {
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.user.id).eq('entry_date', date);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Supabase: klient i logowanie
// ---------------------------------------------------------------------------

let client;

export function getClient() {
  if (client !== undefined) return client;
  client = null;
  if (SUPABASE_URL && SUPABASE_KEY && window.supabase?.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Własny klucz: na tej samej domenie github.io mogą działać inne aplikacje tego projektu.
        storageKey: 'boli-glowa-auth',
      },
    });
  }
  return client;
}

const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Nieprawidłowy e-mail lub hasło.'],
  [/email not confirmed/i, 'Najpierw potwierdź adres e-mail: kliknij link z wiadomości aktywacyjnej.'],
  [/already registered|already been registered|user already exists/i, 'Konto z tym adresem już istnieje. Zaloguj się.'],
  [/password should be at least|weak password|password is too short/i, 'Hasło musi mieć co najmniej 6 znaków.'],
  [/rate limit|too many requests|security purposes/i, 'Zbyt wiele prób w krótkim czasie. Spróbuj ponownie za kilka minut.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'Sprawdź, czy adres e-mail jest poprawny.'],
  [/signups not allowed|signup is disabled/i, 'Rejestracja nowych kont jest wyłączona.'],
  [/failed to fetch|network|load failed/i, 'Brak połączenia z serwerem. Sprawdź internet.'],
];

export function authErrorMessage(err) {
  const msg = String(err?.message || err || '');
  for (const [re, text] of AUTH_ERRORS) if (re.test(msg)) return text;
  return msg || 'Coś poszło nie tak. Spróbuj ponownie.';
}

const redirectUrl = () => window.location.origin + window.location.pathname;

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Zwraca { session } albo { needsConfirmation: true }, gdy projekt wymaga potwierdzenia e-maila. */
export async function signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) throw error;
  // Przy włączonym potwierdzaniu Supabase nie zdradza, że konto istnieje — zwraca użytkownika bez tożsamości.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('User already registered');
  }
  return data.session ? { session: data.session } : { needsConfirmation: true };
}

export async function sendPasswordReset(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await getClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await getClient()?.auth.signOut();
}
