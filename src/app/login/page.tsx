"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Lock,
  LogIn,
  Sparkles,
  Mail,
  Copy,
  Check,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTeacherSession, saveTeacherSession } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

export default function TeacherLoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [activeTab, setActiveTab] = useState<"LOGIN" | "REGISTER_INFO">(
    "LOGIN",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const existing = getTeacherSession();
    if (existing) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    try {
      // Gunakan select('*') agar aman baik kolomnya 'password' maupun 'password_hash'
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .ilike("username", username.trim())
        .maybeSingle();

      if (error) {
        alert(`Error Supabase: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data) {
        alert(
          lang === "EN"
            ? "Username not found!"
            : "Username tidak ditemukan di database!",
        );
        setLoading(false);
        return;
      }

      // Ambil nilai dari kolom 'password' atau 'password_hash'
      const storedPass: string = data.password ?? data.password_hash ?? "";

      // Hitung SHA-256 sebagai cadangan jika password di database di-hash
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashedInput = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const isMatch = storedPass === password || storedPass === hashedInput;

      if (!isMatch) {
        alert(lang === "EN" ? "Incorrect password!" : "Password salah!");
        setLoading(false);
        return;
      }

      saveTeacherSession({
        id: data.id,
        username: data.username,
        full_name: data.full_name,
      });

      sound.playPowerUp();
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Login Error: ${msg}`);
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("fatuhilah23@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-[#2B90FF] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === "EN" ? "Back to Home" : "Kembali ke Beranda"}</span>
        </Link>
      </div>

      <div className="w-full max-w-md bg-white p-7 sm:p-8 rounded-[32px] border-2 border-slate-200/90 border-b-8 shadow-xl">
        {/* Logo & Judul */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-3xl shadow-md border-b-4 border-[#135BC4]">
            ♞
          </div>

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100 text-[#1E82F5] text-xs font-extrabold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {lang === "EN" ? "Teacher Area" : "Area Khusus Guru"}
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {lang === "EN" ? "Teacher Studio Login" : "Masuk Studio Guru"}
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {lang === "EN"
              ? "Manage your quiz library and host live classroom sessions"
              : "Kelola bank kuis dan mulai sesi live di kelas"}
          </p>
        </div>

        {/* Switcher Tab: Masuk Akun | Daftar Akun Baru */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#EEF4FA] border border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("LOGIN")}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              activeTab === "LOGIN"
                ? "bg-[#2B90FF] text-white shadow-xs border border-slate-900/15"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {lang === "EN" ? "Sign In" : "Masuk Akun"}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("REGISTER_INFO")}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              activeTab === "REGISTER_INFO"
                ? "bg-[#2B90FF] text-white shadow-xs border border-slate-900/15"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {lang === "EN" ? "Register Account" : "Daftar Akun Baru"}
          </button>
        </div>

        {/* Konten Tab 1: Form Login */}
        {activeTab === "LOGIN" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                USERNAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    lang === "EN" ? "Enter your username" : "Masukkan username"
                  }
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:bg-white focus:outline-none font-bold text-sm text-slate-800 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:bg-white focus:outline-none font-bold text-sm text-slate-800 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-base flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-md transition cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>
                {loading
                  ? lang === "EN"
                    ? "Signing in..."
                    : "Memproses..."
                  : lang === "EN"
                    ? "Enter Studio"
                    : "Masuk ke Studio"}
              </span>
            </button>
          </form>
        ) : (
          /* Konten Tab 2: Informasi Pendaftaran Akun Baru */
          <div className="p-6 rounded-2xl bg-[#F8FBFF] border-2 border-sky-200 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#2B90FF] flex items-center justify-center mb-3">
              <Mail className="w-6 h-6" />
            </div>

            <p className="text-sm sm:text-base font-extrabold text-slate-800 leading-relaxed">
              {lang === "EN" ? (
                <>
                  To register a new account, please contact{" "}
                  <a
                    href="mailto:fatuhilah23@gmail.com"
                    className="text-[#2B90FF] underline break-all"
                  >
                    fatuhilah23@gmail.com
                  </a>
                </>
              ) : (
                <>
                  Untuk pendaftaran akun baru, silakan hubungi{" "}
                  <a
                    href="mailto:fatuhilah23@gmail.com"
                    className="text-[#2B90FF] underline break-all"
                  >
                    fatuhilah23@gmail.com
                  </a>
                </>
              )}
            </p>

            <div className="flex items-center gap-2 mt-5 w-full">
              <a
                href="mailto:fatuhilah23@gmail.com?subject=Pendaftaran%20Akun%20TactiQuiz"
                className="flex-1 py-3 px-4 rounded-xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-xs flex items-center justify-center gap-1.5 border-b-4 border-[#1359B8] transition"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{lang === "EN" ? "Send Email" : "Kirim Email"}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">
                      {lang === "EN" ? "Copied" : "Tersalin"}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === "EN" ? "Copy" : "Salin"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
