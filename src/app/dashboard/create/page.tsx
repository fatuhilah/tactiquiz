"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ChessQuizBoard, {
  PieceType,
  OptionKey,
  PIECE_META,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { getTeacherSession, TeacherSession } from "@/lib/auth";

interface DraftQuestion {
  tempId: string;
  question_text: string;
  options: Record<OptionKey, string>;
  correct_option: OptionKey;
  piece_type: PieceType;
  obstacles: number;
}

const PIECE_OPTIONS: PieceType[] = [
  "KNIGHT",
  "BISHOP",
  "ROOK",
  "QUEEN",
  "KING",
  "PAWN",
];

export default function CreateQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);

  React.useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacher(session);
  }, [router]);

  const [questions, setQuestions] = useState<DraftQuestion[]>([
    {
      tempId: "q-1",
      question_text: "",
      options: { A: "", B: "", C: "", D: "" },
      correct_option: "A",
      piece_type: "KNIGHT",
      obstacles: 3,
    },
  ]);

  const activeQuestion = questions[activeIndex] || questions[0];

  const addQuestion = () => {
    const nextPiece = PIECE_OPTIONS[questions.length % PIECE_OPTIONS.length];
    const newQ: DraftQuestion = {
      tempId: `q-${Date.now()}`,
      question_text: "",
      options: { A: "", B: "", C: "", D: "" },
      correct_option: "A",
      piece_type: nextPiece,
      obstacles: 3,
    };
    setQuestions((prev) => [...prev, newQ]);
    setActiveIndex(questions.length);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    setActiveIndex(Math.max(0, index - 1));
  };

  const updateCurrentQuestion = (patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === activeIndex ? { ...q, ...patch } : q)),
    );
  };

  const updateOptionText = (key: OptionKey, value: string) => {
    updateCurrentQuestion({
      options: { ...activeQuestion.options, [key]: value },
    });
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      alert("Judul kuis wajib diisi ya!");
      return;
    }

    const isIncomplete = questions.some(
      (q) =>
        !q.question_text.trim() ||
        !q.options.A.trim() ||
        !q.options.B.trim() ||
        !q.options.C.trim() ||
        !q.options.D.trim(),
    );

    if (isIncomplete) {
      alert(
        "Pastikan semua pertanyaan dan opsi A, B, C, D sudah terisi lengkap!",
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Simpan ke tabel quizzes
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            teacher_id: teacher?.id || null,
          },
        ])
        .select()
        .single();

      if (quizError) throw quizError;

      // 2. Simpan semua pertanyaan ke tabel questions
      const rowsToInsert = questions.map((q, idx) => ({
        quiz_id: quizData.id,
        question_text: q.question_text.trim(),
        option_a: q.options.A.trim(),
        option_b: q.options.B.trim(),
        option_c: q.options.C.trim(),
        option_d: q.options.D.trim(),
        correct_option: q.correct_option,
        piece_type: q.piece_type,
        obstacles: q.obstacles,
        order_index: idx,
      }));

      const { error: qError } = await supabase
        .from("questions")
        .insert(rowsToInsert);
      if (qError) throw qError;

      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan";
      alert(`Gagal menyimpan kuis: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  // Data untuk komponen Preview Papan Catur
  const previewData: QuestionData = {
    id: activeQuestion.tempId,
    question_text: activeQuestion.question_text || "Contoh Pertanyaan",
    options: activeQuestion.options,
    correct_option: activeQuestion.correct_option,
    piece_type: activeQuestion.piece_type,
    obstacles: activeQuestion.obstacles,
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-12">
      {/* Header Studio */}
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 leading-none">
                Studio Buat Kuis
              </h1>
              <span className="text-xs font-bold text-slate-400">
                Rancang soal & pilih bidak tantangan
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
            <span>{saving ? "Menyimpan..." : "Simpan Kuis"}</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Info Utama Kuis */}
        <div className="bg-white p-5 sm:p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Judul Kuis *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Petualangan IPA Kelas 5"
              className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Latihan tata surya & energi"
              className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-semibold text-slate-700"
            />
          </div>
        </div>

        {/* Navigasi Tab Nomor Soal */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
          {questions.map((q, idx) => (
            <button
              key={q.tempId}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm border-2 border-b-4 shrink-0 transition cursor-pointer ${
                idx === activeIndex
                  ? "bg-[#2B90FF] text-white border-[#1D7AFC] border-b-[#1359B8]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-sky-50"
              }`}
            >
              <span>Soal {idx + 1}</span>
              <span className="text-base">
                {PIECE_META[q.piece_type].symbol}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-dashed border-emerald-300 font-extrabold text-sm shrink-0 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah Soal
          </button>
        </div>

        {/* Editor 2 Kolom */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KIRI: Form Soal & Pengaturan Bidak (7 Kolom) */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black">
                <Layers className="w-3.5 h-3.5" /> Edit Pertanyaan #
                {activeIndex + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(activeIndex)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Soal
                </button>
              )}
            </div>

            {/* Input Teks Pertanyaan */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Teks Pertanyaan *
              </label>
              <textarea
                rows={2}
                value={activeQuestion.question_text}
                onChange={(e) =>
                  updateCurrentQuestion({ question_text: e.target.value })
                }
                placeholder="Tulis pertanyaan di sini..."
                className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-slate-800 text-base"
              />
            </div>

            {/* Pilihan Jawaban A, B, C, D + Pilih Kunci Jawaban */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Opsi Jawaban (Klik ikon centang untuk kunci jawaban)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                  const isCorrect = activeQuestion.correct_option === key;
                  const style = OPTION_STYLES[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl border-2 transition ${
                        isCorrect
                          ? "bg-emerald-50/70 border-emerald-400"
                          : "bg-[#F8FBFF] border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl ${style.badgeBg} text-white font-black text-sm flex items-center justify-center shrink-0`}
                      >
                        {key}
                      </span>
                      <input
                        type="text"
                        value={activeQuestion.options[key]}
                        onChange={(e) => updateOptionText(key, e.target.value)}
                        placeholder={`Jawaban ${key}`}
                        className="w-full bg-transparent font-bold text-sm text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentQuestion({ correct_option: key })
                        }
                        title="Jadikan Kunci Jawaban"
                        className={`p-1.5 rounded-xl transition cursor-pointer ${
                          isCorrect
                            ? "text-emerald-600 bg-emerald-100"
                            : "text-slate-300 hover:text-slate-500"
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pemilih Bidak Catur */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Pilih Bidak Catur untuk Soal Ini
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PIECE_OPTIONS.map((piece) => {
                  const meta = PIECE_META[piece];
                  const selected = activeQuestion.piece_type === piece;
                  return (
                    <button
                      key={piece}
                      type="button"
                      onClick={() =>
                        updateCurrentQuestion({ piece_type: piece })
                      }
                      className={`flex flex-col items-center p-2.5 rounded-2xl border-2 border-b-4 transition cursor-pointer ${
                        selected
                          ? "bg-amber-50 border-amber-400 border-b-amber-500 scale-[1.03]"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-2xl mb-1">{meta.symbol}</span>
                      <span className="text-[11px] font-extrabold text-slate-700 text-center leading-tight">
                        {meta.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider Jumlah Rintangan */}
            <div className="flex items-center justify-between bg-[#F8FBFF] px-4 py-3 rounded-2xl border-2 border-slate-200">
              <div>
                <p className="text-sm font-extrabold text-slate-700">
                  Balok Rintangan 🧱
                </p>
                <p className="text-xs font-medium text-slate-400">
                  Makin banyak balok, makin menantang jalurnya
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[0, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => updateCurrentQuestion({ obstacles: num })}
                    className={`w-9 h-9 rounded-xl font-black text-sm border-2 transition cursor-pointer ${
                      activeQuestion.obstacles === num
                        ? "bg-[#2B90FF] text-white border-[#1D7AFC]"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KANAN: Live Preview Papan Catur (5 Kolom) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px]">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sky-600">
                <Sparkles className="w-4 h-4" /> Live Preview Papan
              </span>
              <span className="text-xs font-bold text-slate-400">
                Coba klik untuk tes!
              </span>
            </div>

            <ChessQuizBoard
              key={`${activeQuestion.tempId}-${activeQuestion.piece_type}-${activeQuestion.obstacles}`}
              question={previewData}
              onAnswer={() => {}}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
