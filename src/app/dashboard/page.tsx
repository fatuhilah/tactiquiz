"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Users,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Trash2,
  LogOut,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getTeacherSession,
  clearTeacherSession,
  TeacherSession,
} from "@/lib/auth";

interface QuizItem {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string | null;
  created_at: string;
  questions: { id: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostingId, setHostingId] = useState<string | null>(null);

  const fetchQuizzes = useCallback(async (teacherId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, description, teacher_id, created_at, questions(id)")
      .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setQuizzes(data as QuizItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacher(session);
    fetchQuizzes(session.id);
  }, [router, fetchQuizzes]);

  const handleLogout = () => {
    clearTeacherSession();
    router.push("/");
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!teacher || !confirm("Yakin ingin menghapus kuis ini?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    fetchQuizzes(teacher.id);
  };

  const handleHostLive = async (quizId: string) => {
    setHostingId(quizId);
    const pinCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { error } = await supabase
      .from("rooms")
      .insert([{ pin_code: pinCode, quiz_id: quizId, status: "waiting" }]);

    setHostingId(null);

    if (error) {
      alert(`Gagal membuat room: ${error.message}`);
      return;
    }

    router.push(`/host/${pinCode}`);
  };

  if (!teacher) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        Memeriksa sesi login...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-12">
      {/* Top Navbar */}
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 leading-none">
                Bank Kuis Guru
              </h1>
              <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3.5 h-3.5" /> {teacher.full_name} (@
                {teacher.username})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] active:translate-y-0.5 text-white font-black text-xs sm:text-sm border-b-4 border-[#1359B8] shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kuis Baru</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Keluar Akun"
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border-2 border-rose-200 font-extrabold text-xs sm:text-sm transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-7">
        {/* Banner Hero */}
        <div className="rounded-[28px] bg-gradient-to-r from-[#4AA8FF] to-[#2589FF] p-6 sm:p-7 text-white mb-7 border-b-[6px] border-[#1359B8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Halo,{" "}
              {teacher.full_name}!
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Siap Membuat Tantangan Baru?
            </h2>
            <p className="text-sm font-medium text-sky-100 mt-1">
              Kuis yang kamu buat tersimpan khusus di akun{" "}
              <strong>@{teacher.username}</strong>.
            </p>
          </div>
          <Link
            href="/dashboard/create"
            className="px-6 py-3.5 rounded-2xl bg-[#FFAE19] hover:bg-[#F59E0B] text-slate-950 font-black text-sm border-b-4 border-[#C77700] shrink-0 transition"
          >
            + Mulai Rancang Kuis
          </Link>
        </div>

        {/* Daftar Kuis */}
        {loading ? (
          <div className="text-center py-16 font-extrabold text-slate-400">
            Memuat daftar kuis dari Supabase...
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-[28px] border-2 border-slate-200 border-b-[6px] p-10 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800">
              Belum Ada Kuis Tersimpan
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1 mb-5">
              Yuk buat kuis pertamamu sekarang dan pilih bidak catur favoritmu!
            </p>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#22C55E] text-white font-black text-sm border-b-4 border-[#15803D]"
            >
              <Plus className="w-4 h-4" /> Buat Kuis Pertama
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-[26px] border-2 border-slate-200/90 border-b-[6px] p-5 flex flex-col justify-between shadow-xs hover:border-sky-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-3 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-extrabold text-xs">
                      {quiz.questions?.length || 0} Soal
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 transition cursor-pointer"
                      title="Hapus Kuis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-lg font-black text-slate-800 leading-snug mb-1">
                    {quiz.title}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-5">
                    {quiz.description || "Kuis interaktif papan catur"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
                  <Link
                    href={`/play/${quiz.id}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 font-extrabold text-xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-emerald-600" />
                    <span>Main Solo</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleHostLive(quiz.id)}
                    disabled={hostingId === quiz.id}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white border-b-2 border-[#1359B8] font-extrabold text-xs transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {hostingId === quiz.id ? "Membuat..." : "Host Live"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
