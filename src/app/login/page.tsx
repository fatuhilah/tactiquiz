"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, User, ArrowLeft, LogIn, UserPlus, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  hashPassword,
  saveTeacherSession,
  getTeacherSession,
} from "@/lib/auth";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Jika sudah login, langsung arahkan ke Studio Guru
  useEffect(() => {
    if (getTeacherSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      setErrorMsg("Username dan password wajib diisi!");
      return;
    }

    setLoading(true);
    try {
      const hashed = await hashPassword(password);

      if (mode === "LOGIN") {
        const { data, error } = await supabase
          .from("teachers")
          .select("id, username, full_name, password_hash")
          .eq("username", cleanUsername)
          .single();

        if (error || !data || data.password_hash !== hashed) {
          setErrorMsg("Username atau password salah!");
          setLoading(false);
          return;
        }

        saveTeacherSession({
          id: data.id,
          username: data.username,
          full_name: data.full_name,
        });
        router.push("/dashboard");
      } else {
        if (!fullName.trim()) {
          setErrorMsg("Nama lengkap wajib diisi!");
          setLoading(false);
          return;
        }
        if (password.length < 4) {
          setErrorMsg("Password minimal 4 karakter!");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("teachers")
          .insert([
            {
              username: cleanUsername,
              full_name: fullName.trim(),
              password_hash: hashed,
            },
          ])
          .select("id, username, full_name")
          .single();

        if (error) {
          if (error.code === "23505") {
            setErrorMsg("Username sudah dipakai, coba username lain!");
          } else {
            setErrorMsg(error.message);
          }
          setLoading(false);
          return;
        }

        saveTeacherSession({
          id: data.id,
          username: data.username,
          full_name: data.full_name,
        });
        router.push("/dashboard");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-slate-800 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>

        <div className="bg-white p-7 sm:p-8 rounded-[32px] border-2 border-slate-200 border-b-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-3xl shadow-md border-b-4 border-[#135BC4]">
              ♞
            </div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black mb-1.5">
              <Sparkles className="w-3 h-3" /> Area Khusus Guru
            </span>
            <h1 className="text-2xl font-black text-slate-800">
              {mode === "LOGIN" ? "Masuk Studio Guru" : "Buat Akun Guru Baru"}
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Kelola bank kuis dan mulai sesi live di kelas
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#F2F7FC] border border-slate-200 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                mode === "LOGIN"
                  ? "bg-[#2B90FF] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("REGISTER");
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                mode === "REGISTER"
                  ? "bg-[#2B90FF] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-extrabold text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "REGISTER" && (
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Pak Andi, S.Pd"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/\s+/g, ""))
                  }
                  placeholder="Contoh: guru1"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-base flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-md transition cursor-pointer"
            >
              {mode === "LOGIN" ? (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>{loading ? "Memeriksa..." : "Masuk ke Studio"}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>
                    {loading ? "Mendaftarkan..." : "Buat Akun & Masuk"}
                  </span>
                </>
              )}
            </button>
          </form>

          {mode === "LOGIN" && (
            <p className="text-[11px] font-bold text-slate-400 text-center mt-4">
              Akun uji coba: <span className="text-slate-600">guru1</span> /{" "}
              <span className="text-slate-600">123456</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
