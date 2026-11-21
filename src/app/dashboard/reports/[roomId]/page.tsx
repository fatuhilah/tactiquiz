"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Check,
  X,
  Medal,
  Activity,
  Users,
  Globe,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTeacherSession } from "@/lib/auth";
import { OptionKey } from "@/components/ChessQuizBoard";
import FormattedText from "@/components/FormattedText";

type ReportLang = "ID" | "EN";

interface ReportPlayer {
  id: string;
  nickname: string;
  correct_count: number;
  wrong_count: number;
  score100: number;
  answers: {
    question_id: string;
    question_index?: number;
    selected_option: OptionKey | null;
    is_correct: boolean;
  }[];
}

interface QuestionDetail {
  id: string;
  text: string;
  image_url?: string | null;
  order_index: number;
  correct_options: OptionKey[];
  options: Record<OptionKey, string>;
}

const PDF_LABELS: Record<
  ReportLang,
  {
    reportTitle: string;
    studentName: string;
    quizDate: string;
    roomPin: string;
    finalScore: string;
    correctLabel: string;
    wrongLabel: string;
    sectionTitle: string;
    unanswered: string;
    correctKeyBadge: string;
    studentChoiceBadge: string;
    teacherRole: string;
  }
> = {
  ID: {
    reportTitle: "Laporan Evaluasi Hasil Belajar",
    studentName: "Nama Peserta",
    quizDate: "Tanggal Pelaksanaan",
    roomPin: "Kode Ruang",
    finalScore: "Nilai Akhir",
    correctLabel: "Benar",
    wrongLabel: "Salah",
    sectionTitle: "Rincian Pertanyaan & Seluruh Pilihan Jawaban",
    unanswered: "Tidak Menjawab / Waktu Habis",
    correctKeyBadge: "✓ Kunci Jawaban",
    studentChoiceBadge: "Pilihan Siswa",
    teacherRole: "Pengajar",
  },
  EN: {
    reportTitle: "Learning Evaluation Report",
    studentName: "Student Name",
    quizDate: "Quiz Date",
    roomPin: "Room Code",
    finalScore: "Final Score",
    correctLabel: "Correct",
    wrongLabel: "Incorrect",
    sectionTitle: "Questions & Complete Answer Choices Breakdown",
    unanswered: "Not Answered / Time Expired",
    correctKeyBadge: "✓ Correct Answer",
    studentChoiceBadge: "Student's Choice",
    teacherRole: "Teacher",
  },
};

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState("");
  const [roomPin, setRoomPin] = useState("");
  const [rawCreatedAt, setRawCreatedAt] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [players, setPlayers] = useState<ReportPlayer[]>([]);
  const [teacherName, setTeacherName] = useState("");

  // State modal pemilihan bahasa cetak & data siswa yang sedang dicetak
  const [langModalStudent, setLangModalStudent] = useState<ReportPlayer | null>(
    null,
  );
  const [printStudent, setPrintStudent] = useState<ReportPlayer | null>(null);
  const [printLang, setPrintLang] = useState<ReportLang>("ID");

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacherName(session.full_name);

    async function fetchData() {
      const { data: room } = await supabase
        .from("rooms")
        .select("pin_code, created_at, quiz_id")
        .eq("id", roomId)
        .single();

      if (!room) return;
      setRoomPin(room.pin_code);
      setRawCreatedAt(room.created_at);

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("title")
        .eq("id", room.quiz_id)
        .single();
      if (quiz) setQuizTitle(quiz.title);

      const { data: qRows } = await supabase
        .from("questions")
        .select(
          "id, question_text, image_url, option_a, option_b, option_c, option_d, correct_option, correct_options, order_index",
        )
        .eq("quiz_id", room.quiz_id)
        .order("order_index", { ascending: true });

      let mappedQuestions: QuestionDetail[] = [];
      if (qRows) {
        mappedQuestions = qRows.map((q) => ({
          id: q.id,
          text: q.question_text,
          image_url: q.image_url || null,
          order_index: q.order_index,
          correct_options:
            Array.isArray(q.correct_options) && q.correct_options.length > 0
              ? (q.correct_options as OptionKey[])
              : [q.correct_option as OptionKey],
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d,
          },
        }));
        setQuestions(mappedQuestions);
      }

      const { data: pRows } = await supabase
        .from("players")
        .select("id, nickname, correct_count, wrong_count, answers")
        .eq("room_id", roomId)
        .order("correct_count", { ascending: false });

      if (pRows) {
        const qCount = mappedQuestions.length || 1;
        const mappedPlayers: ReportPlayer[] = pRows.map((p) => {
          let ansList = [];
          if (typeof p.answers === "string") {
            try {
              ansList = JSON.parse(p.answers);
            } catch {
              ansList = [];
            }
          } else if (Array.isArray(p.answers)) {
            ansList = p.answers;
          }

          const correct = p.correct_count || 0;
          const score100 = Math.round((correct / qCount) * 100);

          return {
            id: p.id,
            nickname: p.nickname,
            correct_count: correct,
            wrong_count: p.wrong_count || 0,
            score100,
            answers: ansList,
          };
        });
        setPlayers(mappedPlayers);
      }
      setLoading(false);
    }

    fetchData();
  }, [roomId, router]);

  const triggerPrintWithLanguage = (
    student: ReportPlayer,
    lang: ReportLang,
  ) => {
    setPrintStudent(student);
    setPrintLang(lang);
    setLangModalStudent(null);

    setTimeout(() => {
      window.print();
    }, 350);
  };

  const avgScore = useMemo(() => {
    if (players.length === 0) return 0;
    const total = players.reduce((acc, p) => acc + p.score100, 0);
    return Math.round(total / players.length);
  }, [players]);

  const formattedDateDashboard = useMemo(() => {
    if (!rawCreatedAt) return "";
    return new Date(rawCreatedAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [rawCreatedAt]);

  const formattedDatePdf = useMemo(() => {
    if (!rawCreatedAt) return "";
    return new Date(rawCreatedAt).toLocaleDateString(
      printLang === "EN" ? "en-US" : "id-ID",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );
  }, [rawCreatedAt, printLang]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-bold text-slate-400">
        Menyusun laporan...
      </main>
    );
  }

  const t = PDF_LABELS[printLang];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
        }
      `,
        }}
      />

      {/* ==================== A. UI DASHBOARD GURU (Tersembunyi saat print) ==================== */}
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-16 print:hidden">
        <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center gap-4">
            <Link
              href="/dashboard/reports"
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 leading-none">
                Detail Laporan Kelas
              </h1>
              <span className="text-xs font-bold text-slate-400">
                {quizTitle} • {formattedDateDashboard}
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
          {/* Kartu Ringkasan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-[24px] border-2 border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase">
                  Rata-rata Kelas
                </p>
                <p className="text-3xl font-black text-slate-800">{avgScore}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border-2 border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase">
                  Total Peserta
                </p>
                <p className="text-3xl font-black text-slate-800">
                  {players.length}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border-2 border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Medal className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase">
                  Jumlah Soal
                </p>
                <p className="text-3xl font-black text-slate-800">
                  {questions.length}
                </p>
              </div>
            </div>
          </div>

          {/* Tabel Grid Nilai Siswa */}
          <div className="bg-white rounded-[28px] border-2 border-slate-200 border-b-[6px] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-lg text-slate-800">
                Tabel Rincian Jawaban
              </h2>
              <span className="text-xs font-bold text-slate-500">
                Skor berskala 0–100
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-white">
                    <th className="p-4 border-b-2 border-slate-200 font-extrabold text-sm text-slate-500 w-48 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      Peserta
                    </th>
                    <th className="p-4 border-b-2 border-slate-200 font-extrabold text-sm text-slate-500 text-center border-l">
                      Nilai
                    </th>
                    <th className="p-4 border-b-2 border-slate-200 font-extrabold text-sm text-slate-500 text-center border-r">
                      Aksi
                    </th>
                    {questions.map((q, i) => (
                      <th
                        key={q.id}
                        className="p-4 border-b-2 border-slate-200 font-extrabold text-xs text-slate-400 text-center min-w-[50px]"
                      >
                        Q{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 border-b border-slate-100 transition-colors"
                    >
                      <td className="p-4 font-black text-slate-800 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {p.nickname}
                      </td>
                      <td className="p-4 text-center border-l font-black text-lg text-[#2B90FF]">
                        {p.score100}
                      </td>
                      <td className="p-4 text-center border-r">
                        <button
                          type="button"
                          onClick={() => setLangModalStudent(p)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-black transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak PDF
                        </button>
                      </td>
                      {questions.map((q, idx) => {
                        const ans = p.answers.find(
                          (a) =>
                            String(a.question_id) === String(q.id) ||
                            a.question_index === idx,
                        );
                        return (
                          <td
                            key={q.id}
                            className="p-4 text-center border-l border-slate-100"
                          >
                            {ans ? (
                              ans.is_correct ? (
                                <div className="w-6 h-6 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                  <X className="w-4 h-4" />
                                </div>
                              )
                            ) : (
                              <span className="text-slate-300 font-black">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ==================== MODAL PILIH BAHASA CETAK PDF ==================== */}
        {langModalStudent && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[28px] border-2 border-slate-200 border-b-8 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#2B90FF] flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-800 leading-none">
                      Pilih Bahasa Laporan PDF
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Peserta:{" "}
                      <span className="text-slate-700">
                        {langModalStudent.nickname}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLangModalStudent(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs font-medium text-slate-500 mb-5">
                Pilih bahasa yang akan digunakan pada kop surat, keterangan
                nilai, dan label pembahasan jawaban di dokumen PDF:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    triggerPrintWithLanguage(langModalStudent, "ID")
                  }
                  className="flex flex-col items-center p-4 rounded-2xl bg-[#F8FBFF] hover:bg-sky-50 border-2 border-slate-200 hover:border-[#2B90FF] border-b-4 transition cursor-pointer"
                >
                  <span className="text-2xl mb-1">🇮🇩</span>
                  <span className="font-black text-sm text-slate-800">
                    Bahasa Indonesia
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 mt-0.5">
                    Laporan Evaluasi
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    triggerPrintWithLanguage(langModalStudent, "EN")
                  }
                  className="flex flex-col items-center p-4 rounded-2xl bg-[#F8FBFF] hover:bg-sky-50 border-2 border-slate-200 hover:border-[#2B90FF] border-b-4 transition cursor-pointer"
                >
                  <span className="text-2xl mb-1">🇬🇧</span>
                  <span className="font-black text-sm text-slate-800">
                    English
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 mt-0.5">
                    Evaluation Report
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLangModalStudent(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ==================== B. TEMPLATE PDF FORMAL (Hanya tampil saat Print) ==================== */}
      {printStudent && (
        <div className="hidden print:block w-full bg-white text-slate-900 font-sans leading-snug">
          {/* Header Kop Surat Laporan */}
          <div className="flex justify-between items-end border-b-[3px] border-slate-800 pb-4 mb-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-1">
                TactiQuiz Academic Assessment
              </p>
              <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                {t.reportTitle}
              </h1>
              <h2 className="text-base font-bold text-slate-600 mt-1">
                {quizTitle}
              </h2>
            </div>
            <div className="text-right">
              <div className="w-11 h-11 bg-slate-900 text-white flex items-center justify-center text-2xl font-black rounded-lg ml-auto mb-1">
                ♞
              </div>
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                TactiQuiz
              </p>
            </div>
          </div>

          {/* Identitas Siswa & Nilai Akhir (Skala 0-100) */}
          <div className="flex justify-between items-center bg-slate-50 border-2 border-slate-300 p-5 rounded-xl mb-7">
            <div>
              <table className="text-sm font-bold text-slate-700">
                <tbody>
                  <tr>
                    <td className="py-1 pr-6 uppercase text-slate-400 text-xs">
                      {t.studentName}
                    </td>
                    <td className="text-lg font-black text-slate-900">
                      : {printStudent.nickname}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-6 uppercase text-slate-400 text-xs">
                      {t.quizDate}
                    </td>
                    <td>: {formattedDatePdf}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-6 uppercase text-slate-400 text-xs">
                      {t.roomPin}
                    </td>
                    <td>: {roomPin}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-right border-l-2 border-slate-300 pl-8">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {t.finalScore}
              </p>
              <p className="text-5xl font-black text-slate-900 leading-none">
                {printStudent.score100}
              </p>
              <p className="text-xs font-extrabold text-slate-600 mt-2">
                <span className="text-emerald-700">
                  ✓ {printStudent.correct_count} {t.correctLabel}
                </span>{" "}
                •{" "}
                <span className="text-rose-700">
                  ✗ {printStudent.wrong_count} {t.wrongLabel}
                </span>
              </p>
            </div>
          </div>

          {/* Rincian Pertanyaan & Seluruh Pilihan Jawaban (A, B, C, D) */}
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b-2 border-slate-200 pb-2">
            {t.sectionTitle}
          </h3>

          <div className="flex flex-col gap-4 text-sm">
            {questions.map((q, idx) => {
              const ans = printStudent.answers.find(
                (a) =>
                  String(a.question_id) === String(q.id) ||
                  a.question_index === idx,
              );
              const isAnsCorrect = ans?.is_correct || false;

              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-slate-300 bg-white break-inside-avoid"
                >
                  {/* Baris Nomor, Pertanyaan, dan Status Benar/Salah */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="font-black text-slate-800 shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="flex-1">
                        {q.image_url && (
                          <img
                            src={q.image_url}
                            alt={`Question ${idx + 1}`}
                            className="max-h-32 mb-2 rounded-lg border border-slate-200 object-contain"
                          />
                        )}
                        <p className="font-bold text-slate-900 leading-snug">
                          <FormattedText text={q.text} />
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isAnsCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black">
                          <Check className="w-3.5 h-3.5" /> {t.correctLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black">
                          <X className="w-3.5 h-3.5" /> {t.wrongLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Semua Opsi Pilihan Ganda A, B, C, D */}
                  <div className="grid grid-cols-2 gap-2 pl-5">
                    {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                      const isKeyCorrect = q.correct_options.includes(key);
                      const isStudentChoice = ans?.selected_option === key;

                      let optBoxClass =
                        "border-slate-200 bg-slate-50/60 text-slate-700";
                      if (isKeyCorrect) {
                        optBoxClass =
                          "border-emerald-500 bg-emerald-50 text-emerald-950";
                      } else if (isStudentChoice && !isKeyCorrect) {
                        optBoxClass =
                          "border-rose-400 bg-rose-50 text-rose-950";
                      }

                      return (
                        <div
                          key={key}
                          className={`flex items-start justify-between gap-2 p-2.5 rounded-lg border ${optBoxClass}`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className="font-black text-xs shrink-0 mt-0.5">
                              {key}.
                            </span>
                            <span className="text-xs font-semibold whitespace-normal break-words leading-snug">
                              <FormattedText text={q.options[key]} />
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {isKeyCorrect && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap">
                                {t.correctKeyBadge}
                              </span>
                            )}
                            {isStudentChoice && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white whitespace-nowrap ${
                                  isKeyCorrect ? "bg-sky-600" : "bg-rose-600"
                                }`}
                              >
                                {t.studentChoiceBadge}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Keterangan jika siswa tidak menjawab / kehabisan waktu */}
                  {!ans?.selected_option && (
                    <p className="pl-5 mt-2 text-[11px] font-bold text-rose-600 italic">
                      * {t.unanswered}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tanda Tangan Pengajar (Tanpa Kolom Orang Tua / Wali) */}
          <div className="mt-12 flex justify-end w-full px-6 text-sm font-bold text-slate-800 break-inside-avoid">
            <div className="text-center min-w-[200px]">
              <p className="mb-16">{t.teacherRole}</p>
              <p className="border-t border-slate-500 pt-1.5 font-black text-slate-900">
                {teacherName}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
