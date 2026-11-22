"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Users,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Trash2,
  LogOut,
  FileBarChart,
  Clock,
  Radio,
  UserCog,
  X,
  Presentation,
  UserCheck,
  ShieldAlert,
  Zap,
  ArrowRight,
  Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getTeacherSession,
  logoutTeacher,
  isSuperAdmin,
  TeacherSession,
} from "@/lib/auth";
import {
  HostingMode,
  RoomSessionSettings,
  DEFAULT_SESSION_SETTINGS,
  ShowAnswerEachMode,
  ShowAnswersAfterMode,
} from "@/lib/sessionSettings";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

interface QuizRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  question_count?: number;
}

interface QuizQueryRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  questions: { id: string }[] | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Pengaturan Host Live
  const [configQuiz, setConfigQuiz] = useState<QuizRow | null>(null);
  const [hostingMode, setHostingMode] = useState<HostingMode>("STUDENT_PACED");
  const [settings, setSettings] = useState<RoomSessionSettings>({
    ...DEFAULT_SESSION_SETTINGS,
  });
  const [creatingRoom, setCreatingRoom] = useState(false);

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacher(session);
    loadQuizzes(session.id);
  }, [router]);

  async function loadQuizzes(teacherId: string) {
    const { data } = await supabase
      .from("quizzes")
      .select("id, title, description, created_at, questions(id)")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped: QuizRow[] = (data as QuizQueryRow[]).map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        created_at: q.created_at,
        question_count: q.questions ? q.questions.length : 0,
      }));
      setQuizzes(mapped);
    }
    setLoading(false);
  }

  const handleLogout = async () => {
    const msg =
      lang === "EN"
        ? "Are you sure you want to log out?"
        : "Yakin ingin keluar dari akun?";

    if (await window.modernConfirm(msg)) {
      logoutTeacher();
      router.replace("/login");
    }
  };

  const handleDelete = async (
    e: React.MouseEvent,
    id: string,
    title: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const msg =
      lang === "EN"
        ? `Are you sure you want to delete the quiz "${title}" permanently?`
        : `Hapus kuis "${title}" secara permanen?`;

    if (!(await window.modernConfirm(msg))) return;

    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (!error) {
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    }
  };

  const openHostSetupModal = (quiz: QuizRow) => {
    setConfigQuiz(quiz);
    setHostingMode("STUDENT_PACED");
    setSettings({ ...DEFAULT_SESSION_SETTINGS });
  };

  const handleSelectHostingMode = (mode: HostingMode) => {
    setHostingMode(mode);
    if (mode === "TEACHER_LED") {
      // Power-ups, redemption, dan acak urutan dinonaktifkan pada Teacher-Led agar sinkron dengan share screen guru
      setSettings((prev) => ({
        ...prev,
        enable_powerups: false,
        redemption_questions: false,
        shuffle_questions: false,
        shuffle_answers: false,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        enable_powerups: true,
      }));
    }
  };

  const handleConfirmCreateRoom = async () => {
    if (!configQuiz) return;
    setCreatingRoom(true);
    sound.playPowerUp();

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const finalSettings: RoomSessionSettings =
      hostingMode === "TEACHER_LED"
        ? {
            ...settings,
            enable_powerups: false,
            redemption_questions: false,
            shuffle_questions: false,
            shuffle_answers: false,
          }
        : settings;

    const { data, error } = await supabase
      .from("rooms")
      .insert([
        {
          quiz_id: configQuiz.id,
          pin_code: pin,
          status: "waiting",
          hosting_mode: hostingMode,
          current_question_index: 0,
          reveal_answer: false,
          settings: finalSettings,
        },
      ])
      .select("pin_code")
      .single();

    if (error || !data) {
      alert(
        lang === "EN"
          ? `Failed to create live room: ${error?.message || ""}`
          : `Gagal membuat ruang kelas: ${error?.message || ""}`,
      );
      setCreatingRoom(false);
      return;
    }

    router.push(`/host/${data.pin_code}`);
  };

  if (!teacher) return null;

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-16">
      {/* Header Dashboard */}
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              title={lang === "EN" ? "Back to Home" : "Kembali ke Beranda"}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-2xl shadow-sm border-b-4 border-[#135BC4] group-hover:scale-105 transition">
                ♞
              </div>
              <div>
                <span className="font-black text-xl tracking-tight text-slate-800 block leading-none">
                  Tacti<span className="text-[#2589FF]">Quiz</span> Studio
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {lang === "EN"
                    ? `Hi, ${teacher.full_name}`
                    : `Halo, ${teacher.full_name}`}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            {isSuperAdmin(teacher) && (
              <Link
                href="/dashboard/users"
                title={lang === "EN" ? "User Management" : "Kelola Akun"}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border-2 border-amber-200 font-extrabold text-xs sm:text-sm transition"
              >
                <UserCog className="w-4 h-4" />
                <span className="hidden lg:inline">
                  {lang === "EN" ? "Users" : "Kelola Akun"}
                </span>
              </Link>
            )}

            <Link
              href="/dashboard/reports"
              title={t("reportsBtn")}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 font-extrabold text-xs sm:text-sm transition"
            >
              <FileBarChart className="w-4 h-4" />
              <span className="hidden md:inline">{t("reportsBtn")}</span>
            </Link>

            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] active:translate-y-0.5 text-white font-black text-xs sm:text-sm border-b-4 border-[#1359B8] shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t("createQuizBtn")}</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title={t("logoutBtn")}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border-2 border-rose-200 font-extrabold text-xs sm:text-sm transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("logoutBtn")}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#2B90FF] flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">
              {t("myQuizzes")}
            </h2>
            <p className="text-sm font-bold text-slate-500">
              {lang === "EN"
                ? "Manage and host your interactive chess quizzes."
                : "Kelola dan mainkan kuis interaktif yang telah Anda buat."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 font-bold text-slate-400">
            {t("loading")}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white p-10 rounded-[28px] border-2 border-slate-200 text-center shadow-sm">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-xl font-black text-slate-700">
              {lang === "EN" ? "No Quizzes Found" : "Belum Ada Kuis"}
            </h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              {lang === "EN"
                ? "You haven't created any quizzes yet. Click the button below to get started!"
                : "Anda belum membuat kuis apa pun. Klik tombol di bawah untuk mulai membuat!"}
            </p>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] active:translate-y-0.5 text-white font-black text-sm border-b-4 border-[#1359B8] shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t("createQuizBtn")}</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quizzes.map((quiz) => {
              const date = new Date(quiz.created_at).toLocaleDateString(
                lang === "EN" ? "en-US" : "id-ID",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                },
              );

              return (
                <div
                  key={quiz.id}
                  className="bg-white p-5 rounded-[28px] border-2 border-slate-200 border-b-[6px] hover:border-sky-200 hover:shadow-md transition flex flex-col justify-between gap-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                        <BookOpen className="w-3.5 h-3.5" />
                        {quiz.question_count} {t("questionsCount")}
                      </span>

                      {/* Bungkus tombol Edit & Hapus di sini */}
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/edit/${quiz.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title={
                            lang === "EN"
                              ? "Edit Quiz & Questions"
                              : "Edit Kuis & Soal"
                          }
                          className="w-8 h-8 rounded-full bg-sky-50 hover:bg-[#2B90FF] text-[#2B90FF] hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, quiz.id, quiz.title)}
                          className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title={t("delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-black text-xl text-slate-800 leading-snug mb-1">
                      {quiz.title}
                    </h3>
                    <p className="text-sm font-semibold text-slate-500 line-clamp-2">
                      {quiz.description ||
                        (lang === "EN"
                          ? "No description"
                          : "Tidak ada deskripsi")}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{date}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/play/${quiz.id}`}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm transition"
                      >
                        <Users className="w-4 h-4" />
                        <span>{t("soloPlayBtn")}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => openHostSetupModal(quiz)}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] hover:bg-[#1EB054] active:translate-y-0.5 text-white font-extrabold text-xs sm:text-sm border-b-2 border-[#15803D] transition cursor-pointer"
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span>{t("startLiveBtn")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== MODAL PENGATURAN SESI HOST LIVE ==================== */}
      {configQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-[32px] border-2 border-slate-200 border-b-8 shadow-2xl overflow-hidden my-auto">
            {/* Header Modal */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-[#F8FBFF]">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#2B90FF]">
                  {configQuiz.title}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  {lang === "EN"
                    ? "How would you like to host the session?"
                    : "Bagaimana Anda ingin memandu sesi ini?"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfigQuiz(null)}
                className="p-2 rounded-xl hover:bg-slate-200/70 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto flex flex-col gap-6">
              {/* 1. Pilih Mode: Student Paced vs Teacher Led */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleSelectHostingMode("STUDENT_PACED")}
                  className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                    hostingMode === "STUDENT_PACED"
                      ? "border-[#2B90FF] bg-sky-50/70 ring-2 ring-sky-400/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="w-full h-24 rounded-xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white p-3.5 mb-3 flex items-center justify-between">
                    <UserCheck className="w-9 h-9 text-amber-300" />
                    <span className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-black">
                      {lang === "EN" ? "Self-Paced" : "Mandiri"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-slate-900">
                      Student paced
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {lang === "EN"
                      ? "Students work at their own pace with Power-Ups enabled."
                      : "Siswa mengerjakan sesuai kecepatan masing-masing (mendukung Power-Up)."}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectHostingMode("TEACHER_LED")}
                  className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                    hostingMode === "TEACHER_LED"
                      ? "border-[#2B90FF] bg-sky-50/70 ring-2 ring-sky-400/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="w-full h-24 rounded-xl bg-gradient-to-br from-sky-900 via-blue-900 to-slate-900 text-white p-3.5 mb-3 flex items-center justify-between">
                    <Presentation className="w-9 h-9 text-emerald-300" />
                    <span className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-black">
                      {lang === "EN" ? "Share Screen" : "Layar Guru"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-slate-900">
                      Teacher led
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {lang === "EN"
                      ? "You lead and share the question screen; students answer on their devices."
                      : "Guru share screen soal di depan kelas, siswa menjawab dari perangkat mereka."}
                  </p>
                </button>
              </div>

              {/* 2. Pengaturan Detail Sesi */}
              <div className="flex flex-col gap-4 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {lang === "EN" ? "Session Settings" : "Pengaturan Sesi Kuis"}
                </h4>

                {/* Power-ups (Hanya untuk Student Paced) */}
                <div
                  className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border ${
                    hostingMode === "STUDENT_PACED"
                      ? "bg-[#F8FBFF] border-slate-200"
                      : "bg-slate-50 border-slate-200/60 opacity-60"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <p className="font-extrabold text-sm text-slate-800">
                        Power-ups
                      </p>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                        {lang === "EN"
                          ? "1x use per session"
                          : "1x pakai per sesi"}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {hostingMode === "STUDENT_PACED"
                        ? lang === "EN"
                          ? "Students can use 50:50 and Super Queen once during the session."
                          : "Siswa dapat memakai bantuan 50:50 dan Ratu Super masing-masing 1 kali."
                        : lang === "EN"
                          ? "Disabled automatically in Teacher-led mode."
                          : "Otomatis nonaktif pada mode Teacher-led."}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={
                      hostingMode === "STUDENT_PACED" &&
                      settings.enable_powerups
                    }
                    disabled={hostingMode !== "STUDENT_PACED"}
                    onChange={(val) =>
                      setSettings((s) => ({ ...s, enable_powerups: val }))
                    }
                  />
                </div>

                {/* Redemption questions (Hanya Student Paced) */}
                <div
                  className={`flex items-center justify-between gap-4 ${
                    hostingMode !== "STUDENT_PACED" ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Redemption questions
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Allow students to reattempt a few incorrect questions."
                        : "Izinkan siswa mengulang beberapa soal yang dijawab salah."}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={
                      hostingMode === "STUDENT_PACED" &&
                      settings.redemption_questions
                    }
                    disabled={hostingMode !== "STUDENT_PACED"}
                    onChange={(val) =>
                      setSettings((s) => ({ ...s, redemption_questions: val }))
                    }
                  />
                </div>

                {/* Show answer after each question */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Show answer after each question
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Feedback shown right after a student answers"
                        : "Tampilan umpan balik langsung setelah siswa menjawab"}
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start">
                    {(
                      [
                        { id: "ON", label: "On" },
                        { id: "VALIDATE_ONLY", label: "Validate only" },
                        { id: "OFF", label: "Off" },
                      ] as { id: ShowAnswerEachMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            show_answer_each: opt.id,
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          settings.show_answer_each === opt.id
                            ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show all answers after session */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Show all answers after session
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Review panel shown when the quiz finishes"
                        : "Tampilan pembahasan soal setelah kuis selesai"}
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start">
                    {(
                      [
                        { id: "ON", label: "On" },
                        { id: "QUESTIONS_ONLY", label: "Questions only" },
                        { id: "OFF", label: "Off" },
                      ] as { id: ShowAnswersAfterMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            show_answers_after: opt.id,
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          settings.show_answers_after === opt.id
                            ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question timer */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Question timer
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Enable countdown timer and speed bonus points"
                        : "Aktifkan hitungan mundur waktu dan bonus kecepatan"}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.question_timer}
                    onChange={(val) =>
                      setSettings((s) => ({ ...s, question_timer: val }))
                    }
                  />
                </div>

                {/* Shuffle questions & answers (Khusus Student Paced) */}
                <div
                  className={`flex items-center justify-between gap-4 ${
                    hostingMode !== "STUDENT_PACED" ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Shuffle questions
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Randomize question order per student (Student-paced)"
                        : "Acak urutan nomor soal tiap siswa (khusus Student-paced)"}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={
                      hostingMode === "STUDENT_PACED" &&
                      settings.shuffle_questions
                    }
                    disabled={hostingMode !== "STUDENT_PACED"}
                    onChange={(val) =>
                      setSettings((s) => ({ ...s, shuffle_questions: val }))
                    }
                  />
                </div>

                <div
                  className={`flex items-center justify-between gap-4 ${
                    hostingMode !== "STUDENT_PACED" ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Shuffle answers
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {lang === "EN"
                        ? "Randomize A, B, C, D option positions (Student-paced)"
                        : "Acak posisi pilihan A, B, C, D (khusus Student-paced)"}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={
                      hostingMode === "STUDENT_PACED" &&
                      settings.shuffle_answers
                    }
                    disabled={hostingMode !== "STUDENT_PACED"}
                    onChange={(val) =>
                      setSettings((s) => ({ ...s, shuffle_answers: val }))
                    }
                  />
                </div>

                {/* Anti-cheating */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span>Anti-cheating Monitor</span>
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {lang === "EN"
                          ? "Warn students when switching browser tabs or leaving window"
                          : "Peringatkan siswa jika berpindah tab atau meninggalkan layar kuis"}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={settings.anti_cheating}
                      onChange={(val) =>
                        setSettings((s) => ({
                          ...s,
                          anti_cheating: val,
                          disable_right_click: val
                            ? s.disable_right_click
                            : false,
                          disable_copy_paste: val
                            ? s.disable_copy_paste
                            : false,
                        }))
                      }
                    />
                  </div>

                  {settings.anti_cheating && (
                    <div className="pl-4 border-l-2 border-slate-300 flex flex-col gap-2.5 pt-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-xs text-slate-700">
                            Disable right click
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {lang === "EN"
                              ? "Prevent context menu / external lookup via right click"
                              : "Blokir klik kanan pada perangkat siswa"}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.disable_right_click}
                          onChange={(val) =>
                            setSettings((s) => ({
                              ...s,
                              disable_right_click: val,
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-xs text-slate-700">
                            Disable copy and paste
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {lang === "EN"
                              ? "Prevent copying question text during session"
                              : "Cegah menyalin teks soal saat kuis berlangsung"}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.disable_copy_paste}
                          onChange={(val) =>
                            setSettings((s) => ({
                              ...s,
                              disable_copy_paste: val,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfigQuiz(null)}
                className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-extrabold text-sm cursor-pointer"
              >
                {t("cancel")}
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateRoom}
                disabled={creatingRoom}
                className="px-6 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 text-white font-black text-sm flex items-center gap-2 border-b-4 border-[#15803D] shadow-sm cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>
                  {creatingRoom
                    ? t("loading")
                    : lang === "EN"
                      ? "Continue to Lobby"
                      : "Buat Ruang & Masuk Lobby"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ToggleSwitch({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`w-11 h-6 rounded-full p-1 transition shrink-0 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${checked ? "bg-[#22C55E]" : "bg-slate-300"}`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
