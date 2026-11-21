export interface TeacherSession {
  id: string;
  username: string;
  full_name: string;
}

const STORAGE_KEY = "tactiquiz_teacher_session";

// Hash password menggunakan Web Crypto API (cocok dengan sha256 PostgreSQL)
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getTeacherSession(): TeacherSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TeacherSession) : null;
  } catch {
    return null;
  }
}

export function saveTeacherSession(teacher: TeacherSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teacher));
}

export function clearTeacherSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function logoutTeacher() {
  clearTeacherSession();
}

const SUPER_ADMIN_USERNAMES = ["fatuh"];

export function isSuperAdmin(session: TeacherSession | null): boolean {
  if (!session || !session.username) return false;
  return SUPER_ADMIN_USERNAMES.includes(session.username.trim().toLowerCase());
}
