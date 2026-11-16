"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Sparkles, BookOpen, ArrowRight, Hash, Lock } from "lucide-react";
import { getTeacherSession, TeacherSession } from "@/lib/auth";

export default function HomeHubPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);

  useEffect(() => {
    setTeacher(getTeacherSession());
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pin.trim();
    if (cleaned.length < 6) {
      alert("Masukkan 6 digit kode PIN dari gurumu!");
      return;
    }
    router.push(`/join/${cleaned}`);
  };

  const studioHref = teacher ? "/dashboard" : "/login";

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-2xl shadow-sm border-b-4 border-[#135BC4]">
              ♞
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-800 block leading-none">
                Tacti<span className="text-[#2589FF]">Quiz</span>
              </span>
              <span className="text-xs font-bold text-slate-400">
                Kuis Catur Interaktif
              </span>
            </div>
          </div>

          <Link
            href={studioHref}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-[#1E82F5] border-2 border-sky-200 font-extrabold text-sm transition"
          >
            {teacher ? (
              <BookOpen className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>
              {teacher ? `Studio (${teacher.username})` : "Login Guru"}
            </span>
          </Link>
        </div>
      </header>

      {/* Main Hero */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center gap-8">
        {/* Card Join PIN Siswa */}
        <div className="rounded-[32px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-7 sm:p-10 text-white shadow-xl border-b-8 border-[#1359B8] grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/20 text-xs font-extrabold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Belajar Sambil
              Bermain
            </span>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight mb-2">
              Jawab Kuis dengan Jurus Bidak Catur! 🦉
            </h1>
            <p className="text-sky-100 font-medium text-sm sm:text-base">
              Masukkan 6 digit kode permainan dari gurumu untuk bergabung ke
              arena live, atau coba latihan langsung.
            </p>
          </div>

          <form
            onSubmit={handleJoinRoom}
            className="md:col-span-5 bg-white p-4 rounded-3xl shadow-lg text-slate-800 flex flex-col gap-3"
          >
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-[#2B90FF]" /> Kode PIN Permainan
            </label>
            <input
              type="text"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full text-center tracking-[0.25em] text-2xl font-black py-3 rounded-2xl bg-[#F2F7FC] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none text-slate-800"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] active:translate-y-0.5 text-white font-black text-base flex items-center justify-center gap-2 border-b-4 border-[#15803D] transition cursor-pointer"
            >
              <span>Masuk Arena</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* 2 Kartu Pilihan Cepat */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/play/demo"
            className="group bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] hover:border-amber-300 flex items-center gap-4 transition"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Play className="w-8 h-8 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Coba Mode Latihan
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Mainkan 6 soal contoh dengan berbagai bidak catur tanpa perlu
                PIN.
              </p>
            </div>
          </Link>

          <Link
            href={studioHref}
            className="group bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] hover:border-sky-300 flex items-center gap-4 transition"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800">
                  Buat Kuis Sendiri
                </h2>
                {!teacher && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    <Lock className="w-2.5 h-2.5" /> Login
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                {teacher
                  ? `Masuk sebagai ${teacher.full_name} untuk mengelola kuis.`
                  : "Login dengan akun guru untuk menyusun soal baru ke Supabase."}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
