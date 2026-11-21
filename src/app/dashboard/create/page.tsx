"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Clock,
  Sparkles,
  Upload,
  Download,
  Copy,
  ImagePlus,
  X,
  Sigma,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Check,
} from "lucide-react";
import ChessQuizBoard, {
  QuestionData,
  OptionKey,
  PieceType,
  PIECE_META,
  OPTION_STYLES,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { PIECE_META_I18N } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { getTeacherSession, TeacherSession } from "@/lib/auth";
import { sound } from "@/lib/sound";

interface DraftQuestion {
  localId: string;
  question_text: string;
  image_url: string | null;
  options: Record<OptionKey, string>;
  correct_options: OptionKey[];
  allow_multiple: boolean;
  time_limit: number;
  piece_type: PieceType;
  obstacles: number;
}

const PIECE_LIST: PieceType[] = [
  "KNIGHT",
  "BISHOP",
  "ROOK",
  "QUEEN",
  "KING",
  "PAWN",
];

const MATH_SYMBOLS = [
  "×",
  "÷",
  "±",
  "≈",
  "≠",
  "≤",
  "≥",
  "√",
  "π",
  "∞",
  "°",
  "²",
  "³",
  "½",
  "¼",
  "¾",
  "α",
  "β",
  "θ",
  "Δ",
  "Ω",
  "μ",
  "λ",
  "∑",
  "∫",
  "→",
  "⇌",
  "↑",
  "↓",
  "∈",
];

function createEmptyQuestion(): DraftQuestion {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    question_text: "",
    image_url: null,
    options: { A: "", B: "", C: "", D: "" },
    correct_options: ["A"],
    allow_multiple: false,
    time_limit: 60,
    piece_type: "KNIGHT",
    obstacles: 3,
  };
}

export default function CreateQuizPage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timerMode, setTimerMode] = useState<"PER_QUESTION" | "TOTAL_QUIZ">(
    "PER_QUESTION",
  );
  const [totalQuizMinutes, setTotalQuizMinutes] = useState<number>(10);

  const [questions, setQuestions] = useState<DraftQuestion[]>([
    createEmptyQuestion(),
  ]);
  const [previewIdx, setPreviewIdx] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // State toolbar format & simbol matematika
  const [openSymbolCardId, setOpenSymbolCardId] = useState<string | null>(null);
  const activeFieldRef = useRef<{
    qIdx: number;
    field: "question_text" | OptionKey;
    el: HTMLTextAreaElement | HTMLInputElement | null;
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacher(session);
  }, [router]);

  const handleBackToLibrary = async () => {
    const hasDraft =
      title.trim().length > 0 ||
      questions.some((q) => q.question_text.trim().length > 0);

    const msg =
      lang === "EN"
        ? "Return to Quiz Library? Unsaved changes will be lost."
        : "Kembali ke Bank Kuis? Perubahan yang belum disimpan akan hilang.";

    if (hasDraft && !(await window.modernConfirm(msg))) {
      return;
    }

    router.push("/dashboard");
    setTimeout(() => {
      if (window.location.pathname !== "/dashboard") {
        window.location.href = "/dashboard";
      }
    }, 300);
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const updateOptionText = (idx: number, optKey: OptionKey, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === idx ? { ...q, options: { ...q.options, [optKey]: val } } : q,
      ),
    );
  };

  const toggleCorrectOption = (idx: number, optKey: OptionKey) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        if (!q.allow_multiple) {
          return { ...q, correct_options: [optKey] };
        }
        const exists = q.correct_options.includes(optKey);
        if (exists && q.correct_options.length === 1) return q;
        const next = exists
          ? q.correct_options.filter((k) => k !== optKey)
          : [...q.correct_options, optKey];
        return { ...q, correct_options: next };
      }),
    );
  };

  const handleAddQuestion = () => {
    const newQ = createEmptyQuestion();
    setQuestions((prev) => {
      const next = [...prev, newQ];
      setPreviewIdx(next.length - 1);
      return next;
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    const source = questions[idx];
    if (!source) return;
    const copy: DraftQuestion = {
      ...source,
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      options: { ...source.options },
      correct_options: [...source.correct_options],
    };
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setPreviewIdx(idx + 1);
      return next;
    });
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviewIdx((p) => Math.min(p, next.length - 1));
      return next;
    });
  };

  const handleSetAllTime = (seconds: number) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, time_limit: seconds })));
  };

  const handleImageUpload = (idx: number, file?: File) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert(
        lang === "EN"
          ? "Image size is too large! Maximum allowed size is 500KB."
          : "Ukuran gambar terlalu besar! Maksimal 500KB.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateQuestion(idx, { image_url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const applyFormatTag = (tag: "b" | "i" | "u" | "s" | "sup" | "sub") => {
    const active = activeFieldRef.current;
    if (!active || !active.el) {
      alert(
        lang === "EN"
          ? "Click or highlight text inside a question or option box first."
          : "Klik atau blok teks pada kotak pertanyaan/opsi terlebih dahulu.",
      );
      return;
    }
    const el = active.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const selected =
      el.value.slice(start, end) || (lang === "EN" ? "text" : "teks");
    const wrapped = `<${tag}>${selected}</${tag}>`;
    const nextVal = el.value.slice(0, start) + wrapped + el.value.slice(end);

    if (active.field === "question_text") {
      updateQuestion(active.qIdx, { question_text: nextVal });
    } else {
      updateOptionText(active.qIdx, active.field, nextVal);
    }
  };

  const insertSymbol = (symbol: string) => {
    const active = activeFieldRef.current;
    if (!active || !active.el) {
      alert(
        lang === "EN"
          ? "Click inside a question or option input first to insert symbols."
          : "Klik pada kotak pertanyaan atau opsi terlebih dahulu untuk menyisipkan simbol.",
      );
      return;
    }
    const el = active.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const nextVal = el.value.slice(0, start) + symbol + el.value.slice(end);

    if (active.field === "question_text") {
      updateQuestion(active.qIdx, { question_text: nextVal });
    } else {
      updateOptionText(active.qIdx, active.field, nextVal);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const header =
      "question_text,option_a,option_b,option_c,option_d,correct_option,piece_type,obstacles,time_limit";

    const rows =
      lang === "EN"
        ? [
            '"What is the SI unit of force?","Joule","Newton","Watt","Pascal","B","KNIGHT",3,60',
            '"Which planet is known as the Red Planet?","Venus","Mars","Jupiter","Saturn","B","BISHOP",3,60',
            '"[Multiple Answer] Which of the following are prime numbers?","2","4","7","9","A;C","QUEEN",4,60',
          ]
        : [
            '"Apa satuan SI untuk gaya?","Joule","Newton","Watt","Pascal","B","KNIGHT",3,60',
            '"Planet manakah yang dijuluki sebagai Planet Merah?","Venus","Mars","Jupiter","Saturnus","B","BISHOP",3,60',
            '"[Jawaban Ganda] Manakah yang termasuk bilangan prima?","2","4","7","9","A;C","QUEEN",4,60',
          ];

    const csvContent = [header, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tactiquiz_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        alert(
          lang === "EN"
            ? "CSV file is empty or invalid."
            : "File CSV kosong atau format tidak valid.",
        );
        return;
      }

      const imported: DraftQuestion[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim());

        if (cols.length < 6) continue;
        const rawCorrect = (cols[5] || "A").toUpperCase();
        const validKeys = rawCorrect
          .split(/[;|,]/)
          .map((k) => k.trim())
          .filter((k): k is OptionKey => ["A", "B", "C", "D"].includes(k));

        const pieceRaw = (cols[6] || "KNIGHT").toUpperCase() as PieceType;
        const piece: PieceType = PIECE_LIST.includes(pieceRaw)
          ? pieceRaw
          : "KNIGHT";
        const obs = Math.min(5, Math.max(0, Number(cols[7]) || 3));
        const tLimit = Math.max(15, Number(cols[8]) || 60);

        imported.push({
          localId: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          question_text: cols[0] || "",
          image_url: null,
          options: {
            A: cols[1] || "",
            B: cols[2] || "",
            C: cols[3] || "",
            D: cols[4] || "",
          },
          correct_options: validKeys.length > 0 ? validKeys : ["A"],
          allow_multiple: validKeys.length > 1,
          piece_type: piece,
          obstacles: obs,
          time_limit: tLimit,
        });
      }

      if (imported.length === 0) {
        alert(
          lang === "EN"
            ? "No valid questions found in the CSV file."
            : "Tidak ada soal valid yang ditemukan pada file CSV.",
        );
        return;
      }

      setQuestions((prev) => {
        const isOnlyBlank =
          prev.length === 1 &&
          !prev[0].question_text.trim() &&
          !prev[0].options.A.trim();
        return isOnlyBlank ? imported : [...prev, ...imported];
      });
      setPreviewIdx(0);
      sound.playPowerUp();
      alert(
        lang === "EN"
          ? `Successfully imported ${imported.length} questions!`
          : `Berhasil mengimpor ${imported.length} soal!`,
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveQuiz = async () => {
    if (!teacher) return;
    if (!title.trim()) {
      alert(
        lang === "EN" ? "Quiz title is required!" : "Judul kuis wajib diisi!",
      );
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        alert(
          lang === "EN"
            ? `Question #${i + 1} text cannot be empty!`
            : `Teks pertanyaan Soal #${i + 1} tidak boleh kosong!`,
        );
        return;
      }
      if (
        !q.options.A.trim() ||
        !q.options.B.trim() ||
        !q.options.C.trim() ||
        !q.options.D.trim()
      ) {
        alert(
          lang === "EN"
            ? `All 4 answer options (A, B, C, D) on Question #${i + 1} must be filled!`
            : `Keempat opsi jawaban (A, B, C, D) pada Soal #${i + 1} wajib diisi!`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const { data: createdQuiz, error: quizErr } = await supabase
        .from("quizzes")
        .insert([
          {
            teacher_id: teacher.id,
            title: title.trim(),
            description: description.trim(),
            timer_mode: timerMode,
            total_time_seconds: totalQuizMinutes * 60,
          },
        ])
        .select("id")
        .single();

      if (quizErr || !createdQuiz) throw quizErr;

      const rowsToInsert = questions.map((q, idx) => ({
        quiz_id: createdQuiz.id,
        question_text: q.question_text.trim(),
        image_url: q.image_url,
        option_a: q.options.A.trim(),
        option_b: q.options.B.trim(),
        option_c: q.options.C.trim(),
        option_d: q.options.D.trim(),
        correct_option: q.correct_options[0] || "A",
        correct_options: q.correct_options,
        allow_multiple: q.allow_multiple,
        time_limit: q.time_limit,
        piece_type: q.piece_type,
        obstacles: q.obstacles,
        order_index: idx,
      }));

      const { error: qErr } = await supabase
        .from("questions")
        .insert(rowsToInsert);
      if (qErr) throw qErr;

      sound.playCorrect();
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      alert(
        lang === "EN"
          ? `Failed to save quiz: ${msg}`
          : `Gagal menyimpan kuis: ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!teacher) return null;

  const estimatedTotalMinutes =
    timerMode === "TOTAL_QUIZ"
      ? totalQuizMinutes
      : Math.max(
          1,
          Math.round(
            questions.reduce((acc, q) => acc + (q.time_limit || 60), 0) / 60,
          ),
        );

  const safePreviewIdx = Math.min(previewIdx, questions.length - 1);
  const currentPreviewDraft = questions[safePreviewIdx] || questions[0];

  const previewQuestionData: QuestionData = {
    id: currentPreviewDraft.localId,
    question_text: currentPreviewDraft.question_text,
    image_url: currentPreviewDraft.image_url,
    options: currentPreviewDraft.options,
    correct_option: currentPreviewDraft.correct_options[0] || "A",
    correct_options: currentPreviewDraft.correct_options,
    allow_multiple: currentPreviewDraft.allow_multiple,
    time_limit: currentPreviewDraft.time_limit,
    piece_type: currentPreviewDraft.piece_type,
    obstacles: currentPreviewDraft.obstacles,
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-16">
      {/* Header Studio */}
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackToLibrary}
              title={
                lang === "EN" ? "Back to Quiz Library" : "Kembali ke Bank Kuis"
              }
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 leading-none">
                {lang === "EN" ? "Quiz Creator Studio" : "Studio Buat Kuis"}
              </h1>
              <span className="text-xs font-bold text-slate-400">
                {lang === "EN"
                  ? `${questions.length} Questions • Est. ${estimatedTotalMinutes} Mins`
                  : `${questions.length} Pertanyaan • Estimasi ${estimatedTotalMinutes} Menit`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveQuiz}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] active:translate-y-0.5 disabled:opacity-50 text-white font-black text-sm border-b-4 border-[#15803D] shadow-sm transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving
                ? lang === "EN"
                  ? "Saving..."
                  : "Menyimpan..."
                : lang === "EN"
                  ? "Save Quiz"
                  : "Simpan Kuis"}
            </span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex flex-col gap-6">
        {/* Kartu 1: Judul & Deskripsi Kuis */}
        <div className="bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              {lang === "EN" ? "QUIZ TITLE *" : "JUDUL KUIS *"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                lang === "EN"
                  ? "e.g. 5th Grade Science & Physics Exam"
                  : "Contoh: Ujian IPA & Fisika Kelas 5"
              }
              className="w-full px-4 py-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              {lang === "EN"
                ? "SHORT DESCRIPTION (OPTIONAL)"
                : "DESKRIPSI SINGKAT (OPSIONAL)"}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                lang === "EN"
                  ? "e.g. States of matter & energy"
                  : "Contoh: Materi perubahan wujud benda & energi"
              }
              className="w-full px-4 py-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
            />
          </div>
        </div>

        {/* Kartu 2: Pengaturan Waktu */}
        <div className="bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-slate-800">
                {lang === "EN" ? "Timer Settings" : "Pengaturan Waktu Menjawab"}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {lang === "EN"
                  ? "Choose whether time is counted per question or for the entire quiz"
                  : "Pilih apakah waktu dihitung per nomor soal atau total keseluruhan kuis"}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="inline-flex p-1.5 rounded-2xl bg-[#F2F7FC] border border-slate-200">
              <button
                type="button"
                onClick={() => setTimerMode("PER_QUESTION")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  timerMode === "PER_QUESTION"
                    ? "bg-[#2B90FF] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang === "EN" ? "Time Per Question" : "Waktu Per Soal"}
              </button>
              <button
                type="button"
                onClick={() => setTimerMode("TOTAL_QUIZ")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  timerMode === "TOTAL_QUIZ"
                    ? "bg-[#2B90FF] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang === "EN" ? "Total Quiz Time" : "Waktu Keseluruhan Kuis"}
              </button>
            </div>

            {timerMode === "PER_QUESTION" ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 text-xs font-bold">
                <span className="text-slate-500">
                  {lang === "EN" ? "Set All:" : "Set Semua:"}
                </span>
                <select
                  defaultValue={60}
                  onChange={(e) => handleSetAllTime(Number(e.target.value))}
                  className="font-black text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value={30}>
                    {lang === "EN" ? "30 Seconds" : "30 Detik"}
                  </option>
                  <option value={45}>
                    {lang === "EN" ? "45 Seconds" : "45 Detik"}
                  </option>
                  <option value={60}>
                    {lang === "EN"
                      ? "60 Seconds (1 Min)"
                      : "60 Detik (1 Menit)"}
                  </option>
                  <option value={90}>
                    {lang === "EN" ? "90 Seconds" : "90 Detik"}
                  </option>
                  <option value={120}>
                    {lang === "EN"
                      ? "120 Seconds (2 Mins)"
                      : "120 Detik (2 Menit)"}
                  </option>
                </select>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 text-xs font-bold">
                <span className="text-slate-500">
                  {lang === "EN" ? "Duration:" : "Durasi:"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={totalQuizMinutes}
                  onChange={(e) =>
                    setTotalQuizMinutes(
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                  className="w-14 font-black text-slate-800 text-center bg-white border border-slate-200 rounded-lg py-0.5"
                />
                <span className="font-black text-slate-700">
                  {lang === "EN" ? "Minutes" : "Menit"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Baris Header Daftar Soal & Tombol CSV */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-black text-lg text-slate-800">
              {lang === "EN"
                ? `All Questions (${questions.length})`
                : `Daftar Semua Soal (${questions.length})`}
            </h2>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === "EN" ? "Add Question" : "Tambah Soal"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border-2 border-indigo-200 font-extrabold text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === "EN" ? "CSV Template" : "Template CSV"}</span>
            </button>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === "EN" ? "Upload CSV" : "Upload CSV"}</span>
            </button>
          </div>
        </div>

        {/* Grid 2 Kolom: Editor Soal (Kiri) + Live Preview (Kanan) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Daftar Kartu Editor Soal */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {questions.map((q, idx) => {
              const isSelectedPreview = safePreviewIdx === idx;
              const pMeta = PIECE_META[q.piece_type] || PIECE_META.KNIGHT;
              const localizedPieceName =
                PIECE_META_I18N?.[lang]?.[q.piece_type]?.name || pMeta.name;

              return (
                <div
                  key={q.localId}
                  onClick={() => setPreviewIdx(idx)}
                  className={`bg-white p-5 sm:p-6 rounded-[28px] border-2 border-b-[6px] transition ${
                    isSelectedPreview
                      ? "border-[#2B90FF] shadow-md"
                      : "border-slate-200/90 hover:border-slate-300"
                  }`}
                >
                  {/* Header Kartu Soal */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-black">
                        {lang === "EN"
                          ? `Question #${String(idx + 1).padStart(2, "0")}`
                          : `Soal #${String(idx + 1).padStart(2, "0")}`}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
                        {pMeta.symbol} {localizedPieceName}
                      </span>

                      {timerMode === "PER_QUESTION" && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-extrabold">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <select
                            value={q.time_limit}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                time_limit: Number(e.target.value),
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent font-black focus:outline-none cursor-pointer"
                          >
                            <option value={30}>
                              {lang === "EN" ? "30 sec" : "30 dtk"}
                            </option>
                            <option value={45}>
                              {lang === "EN" ? "45 sec" : "45 dtk"}
                            </option>
                            <option value={60}>
                              {lang === "EN" ? "60 sec" : "60 dtk"}
                            </option>
                            <option value={90}>
                              {lang === "EN" ? "90 sec" : "90 dtk"}
                            </option>
                            <option value={120}>
                              {lang === "EN" ? "120 sec" : "120 dtk"}
                            </option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewIdx(idx);
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                          isSelectedPreview
                            ? "bg-sky-100 text-[#1E82F5]"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        👁 Preview
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateQuestion(idx);
                        }}
                        title={
                          lang === "EN" ? "Duplicate Question" : "Duplikat Soal"
                        }
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveQuestion(idx);
                          }}
                          title={
                            lang === "EN" ? "Delete Question" : "Hapus Soal"
                          }
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toolbar Format & Simbol Matematika */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-[#F8FBFF] border border-slate-200 mb-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyFormatTag("b")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Bold"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatTag("i")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Italic"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatTag("u")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Underline"
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatTag("s")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Strikethrough"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatTag("sup")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Superscript"
                      >
                        <Superscript className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatTag("sub")}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                        title="Subscript"
                      >
                        <Subscript className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenSymbolCardId(
                          openSymbolCardId === q.localId ? null : q.localId,
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer"
                    >
                      <Sigma className="w-3.5 h-3.5" />
                      <span>
                        {lang === "EN"
                          ? "Math & Symbols f(x)"
                          : "Rumus & Simbol f(x)"}
                      </span>
                    </button>
                  </div>

                  {/* Drawer Simbol Matematika */}
                  {openSymbolCardId === q.localId && (
                    <div className="mb-3 p-2.5 rounded-2xl bg-purple-50 border border-purple-200 flex flex-wrap gap-1.5">
                      {MATH_SYMBOLS.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => insertSymbol(sym)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-purple-600 hover:text-white border border-purple-200 font-bold text-sm transition cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Area Input Pertanyaan + Upload Gambar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
                    <textarea
                      rows={3}
                      value={q.question_text}
                      onFocus={(e) => {
                        activeFieldRef.current = {
                          qIdx: idx,
                          field: "question_text",
                          el: e.currentTarget,
                        };
                      }}
                      onChange={(e) =>
                        updateQuestion(idx, { question_text: e.target.value })
                      }
                      placeholder={
                        lang === "EN"
                          ? "Write your question here (use the toolbar above for exponents/symbols)..."
                          : "Tulis pertanyaan di sini (gunakan toolbar di atas untuk pangkat/rumus)..."
                      }
                      className="sm:col-span-9 p-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800 resize-none"
                    />

                    <div className="sm:col-span-3">
                      {q.image_url ? (
                        <div className="relative h-full min-h-[88px] rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                          <img
                            src={q.image_url}
                            alt="Question attachment"
                            className="max-h-24 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(idx, { image_url: null })
                            }
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="h-full min-h-[88px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#2B90FF] bg-[#F8FBFF] flex flex-col items-center justify-center text-center p-2 cursor-pointer transition">
                          <ImagePlus className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[11px] font-extrabold text-slate-600">
                            {lang === "EN" ? "+ Image" : "+ Gambar"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            Max 500KB
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageUpload(idx, e.target.files?.[0])
                            }
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 4 Opsi Pilihan Ganda A, B, C, D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                      const isCorrect = q.correct_options.includes(key);
                      const style = OPTION_STYLES[key];

                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2.5 p-2.5 rounded-2xl border-2 transition ${
                            isCorrect
                              ? "bg-emerald-50/70 border-emerald-400"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-xl ${style.badgeBg} text-white font-black text-xs flex items-center justify-center shrink-0`}
                          >
                            {key}
                          </span>

                          <input
                            type="text"
                            value={q.options[key]}
                            onFocus={(e) => {
                              activeFieldRef.current = {
                                qIdx: idx,
                                field: key,
                                el: e.currentTarget,
                              };
                            }}
                            onChange={(e) =>
                              updateOptionText(idx, key, e.target.value)
                            }
                            placeholder={
                              lang === "EN" ? `Option ${key}` : `Opsi ${key}`
                            }
                            className="flex-1 min-w-0 bg-transparent font-bold text-xs sm:text-sm text-slate-800 focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => toggleCorrectOption(idx, key)}
                            title={
                              lang === "EN"
                                ? "Mark as correct answer"
                                : "Tandai sebagai jawaban benar"
                            }
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition cursor-pointer ${
                              isCorrect
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 text-transparent hover:border-emerald-400"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Toggle Multiple Correct Answers */}
                  <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        const nextMulti = !q.allow_multiple;
                        updateQuestion(idx, {
                          allow_multiple: nextMulti,
                          correct_options: nextMulti
                            ? q.correct_options
                            : [q.correct_options[0] || "A"],
                        });
                      }}
                      className={`w-10 h-6 rounded-full p-1 transition cursor-pointer ${
                        q.allow_multiple ? "bg-[#2B90FF]" : "bg-slate-200"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          q.allow_multiple ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-xs font-extrabold text-slate-700">
                      {lang === "EN"
                        ? "Multiple correct answers (More than 1 correct option)"
                        : "Multiple correct answers (Lebih dari 1 jawaban benar)"}
                    </span>
                  </div>

                  {/* Pemilih Bidak Catur & Jumlah Batu Rintangan */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PIECE_LIST.map((piece) => {
                        const meta = PIECE_META[piece];
                        const shortName =
                          (
                            PIECE_META_I18N?.[lang]?.[piece]?.name || meta.name
                          ).split(" ")[lang === "EN" ? 1 : 0] || meta.name;
                        const active = q.piece_type === piece;

                        return (
                          <button
                            key={piece}
                            type="button"
                            onClick={() =>
                              updateQuestion(idx, { piece_type: piece })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer ${
                              active
                                ? "bg-amber-50 border-amber-400 text-amber-900"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span>{meta.symbol}</span>
                            <span>{shortName}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-500">
                        🧱 {lang === "EN" ? "Blocks:" : "Batu:"}
                      </span>
                      {[0, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            updateQuestion(idx, { obstacles: num })
                          }
                          className={`w-7 h-7 rounded-lg text-xs font-black border transition cursor-pointer ${
                            q.obstacles === num
                              ? "bg-[#2B90FF] text-white border-[#1D7AFC]"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Tombol Tambah Pertanyaan Baru di Bawah */}
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-4 rounded-[24px] border-2 border-dashed border-sky-300 hover:border-[#2B90FF] bg-white hover:bg-sky-50/50 text-[#1E82F5] font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {lang === "EN"
                  ? `Add New Question (#${questions.length + 1})`
                  : `Tambah Pertanyaan Baru (#${questions.length + 1})`}
              </span>
            </button>
          </div>

          {/* Kolom Kanan: Live Preview Papan Catur */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#2589FF]">
                <Sparkles className="w-3.5 h-3.5" />
                {lang === "EN"
                  ? `LIVE QUESTION PREVIEW #${safePreviewIdx + 1}`
                  : `LIVE PREVIEW SOAL #${safePreviewIdx + 1}`}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {lang === "EN" ? "Click board to test" : "Klik papan untuk tes"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-slate-200 mb-4">
              <p className="text-sm font-extrabold text-slate-700 leading-snug">
                {currentPreviewDraft.question_text.trim() ||
                  (lang === "EN"
                    ? "Question text will appear here..."
                    : "Teks pertanyaan akan muncul di sini...")}
              </p>
            </div>

            <ChessQuizBoard
              key={`preview-${currentPreviewDraft.localId}-${currentPreviewDraft.piece_type}-${currentPreviewDraft.obstacles}`}
              question={previewQuestionData}
              onAnswer={() => {}}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
