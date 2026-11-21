"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, BookOpen, Sparkles, ArrowRight, Hash } from "lucide-react";
import { getTeacherSession, TeacherSession } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

export default function HomePage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [pinInput, setPinInput] = useState("");
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);

  useEffect(() => {
    const session = getTeacherSession();
    if (session) setTeacher(session);
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!cleaned) return;
    sound.playPowerUp();
    router.push(`/join/${cleaned}`);
  };

  const teacherShortName = teacher
    ? (teacher as { username?: string }).username ||
      teacher.full_name.split(" ")[0].toLowerCase()
    : "";

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-16">
      {/* Header Atas */}
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-2xl shadow-sm border-b-4 border-[#135BC4]">
              ♞
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-800 block leading-none">
                Tacti<span className="text-[#2589FF]">Quiz</span>
              </span>
              <span className="text-xs font-bold text-slate-400">
                {lang === "EN"
                  ? "Interactive Chess Quiz"
                  : "Kuis Catur Interaktif"}
              </span>
            </div>
          </Link>

          <Link
            href={teacher ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-[#1E82F5] border-2 border-sky-200 font-black text-xs sm:text-sm transition"
          >
            <BookOpen className="w-4 h-4" />
            <span>
              {teacher
                ? `Studio (${teacherShortName})`
                : lang === "EN"
                  ? "Teacher Login"
                  : "Masuk Guru"}
            </span>
          </Link>
        </div>
      </header>

      {/* Konten Utama */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16">
        {/* Hero Banner Biru */}
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-7 sm:p-12 text-white shadow-xl border-b-8 border-[#1359B8] mb-8">
          <div className="absolute -right-12 -bottom-16 w-72 h-72 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute right-1/3 -top-16 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 text-xs font-extrabold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {lang === "EN"
                  ? "Learn While Playing"
                  : "Belajar Sambil Bermain"}
              </span>

              <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight mb-4">
                {lang === "EN"
                  ? "Answer Quizzes with Chess Piece Moves! 🦉"
                  : "Jawab Kuis dengan Jurus Bidak Catur! 🦉"}
              </h1>

              <p className="text-sm sm:text-base font-semibold text-sky-100 max-w-xl leading-relaxed">
                {lang === "EN"
                  ? "Enter the 6-digit game code from your teacher to join the live arena, or jump straight into a practice match."
                  : "Masukkan 6 digit kode permainan dari gurumu untuk bergabung ke arena live, atau coba latihan langsung."}
              </p>
            </div>

            {/* Kotak Input PIN */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleJoinSubmit}
                className="bg-white p-6 rounded-[28px] text-slate-800 shadow-lg border-b-[6px] border-slate-200"
              >
                <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
                  <Hash className="w-3.5 h-3.5 text-[#2B90FF]" />
                  <span>
                    {lang === "EN" ? "GAME PIN CODE" : "KODE PIN PERMAINAN"}
                  </span>
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="1 2 3 4 5 6"
                  className="w-full px-4 py-4 rounded-2xl bg-[#EEF4FA] border-2 border-slate-200 focus:border-[#2B90FF] focus:bg-white focus:outline-none font-black text-2xl text-center tracking-[0.25em] text-slate-800 placeholder:text-slate-400 mb-3.5 transition"
                />

                <button
                  type="submit"
                  disabled={pinInput.trim().length < 4}
                  className="w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-md transition cursor-pointer"
                >
                  <span>{lang === "EN" ? "Join Arena" : "Masuk Arena"}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Dua Kartu Menu Bawah */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            href="/play/demo"
            className="flex items-center gap-5 p-6 rounded-[28px] bg-white border-2 border-amber-200 hover:border-amber-400 border-b-[6px] shadow-sm hover:shadow-md transition group"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Play className="w-7 h-7 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">
                {lang === "EN" ? "Try Practice Mode" : "Coba Mode Latihan"}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 leading-snug">
                {lang === "EN"
                  ? "Play 6 sample questions with different chess pieces without needing a PIN."
                  : "Mainkan 6 soal contoh dengan berbagai bidak catur tanpa perlu PIN."}
              </p>
            </div>
          </Link>

          <Link
            href={teacher ? "/dashboard" : "/login"}
            className="flex items-center gap-5 p-6 rounded-[28px] bg-white border-2 border-slate-200 hover:border-sky-300 border-b-[6px] shadow-sm hover:shadow-md transition group"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-100 text-[#2B90FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">
                {lang === "EN" ? "Create Your Own Quiz" : "Buat Kuis Sendiri"}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 leading-snug">
                {teacher
                  ? lang === "EN"
                    ? `Signed in as ${teacher.full_name} to manage quizzes.`
                    : `Masuk sebagai ${teacher.full_name} untuk mengelola kuis.`
                  : lang === "EN"
                    ? "Log in as a teacher to build quizzes and host live classroom games."
                    : "Masuk sebagai guru untuk membuat soal dan memandu permainan kelas."}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
