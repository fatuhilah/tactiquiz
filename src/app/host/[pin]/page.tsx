"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Play,
  Trophy,
  Star,
  Flame,
  Copy,
  Check,
  Sparkles,
  Home,
  Flag,
  BookOpen,
  CheckCircle2,
  FileQuestion,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  PIECE_META,
  PieceType,
  OptionKey,
  OPTION_STYLES,
} from "@/components/ChessQuizBoard";
import { sound } from "@/lib/sound";

interface RoomData {
  id: string;
  pin_code: string;
  quiz_id: string;
  status: "waiting" | "playing" | "finished";
}

interface QuestionRow {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
  piece_type: PieceType;
  order_index: number;
}

interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  piece_skin: PieceType;
  score: number;
  streak: number;
  current_question_index?: number;
  is_finished?: boolean;
  joined_at: string;
}

export default function HostRoomPage() {
  const params = useParams();
  const router = useRouter();
  const pin = params.pin as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [quizTitle, setQuizTitle] = useState("Memuat Kuis...");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("score", { ascending: false })
      .order("joined_at", { ascending: true });

    if (data) setPlayers(data as PlayerRow[]);
  }, []);

  useEffect(() => {
    async function initHost() {
      const { data: roomData, error } = await supabase
        .from("rooms")
        .select("id, pin_code, quiz_id, status")
        .eq("pin_code", pin)
        .single();

      if (error || !roomData) {
        alert("Room tidak ditemukan!");
        router.push("/dashboard");
        return;
      }

      setRoom(roomData as RoomData);

      const [{ data: quiz }, { data: qList }] = await Promise.all([
        supabase
          .from("quizzes")
          .select("title")
          .eq("id", roomData.quiz_id)
          .single(),
        supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", roomData.quiz_id)
          .order("order_index", { ascending: true }),
      ]);

      if (quiz) setQuizTitle(quiz.title);
      if (qList) setQuestions(qList as QuestionRow[]);

      await fetchPlayers(roomData.id);
      setLoading(false);
    }

    initHost();
  }, [pin, router, fetchPlayers]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`host-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchPlayers(room.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          setRoom(payload.new as RoomData);
        },
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchPlayers(room.id);
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room?.id, fetchPlayers]);

  const handleCopyPin = () => {
    const joinUrl = `${window.location.origin}/join/${pin}`;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    if (!room) return;
    if (players.length === 0) {
      alert("Tunggu minimal 1 pemain bergabung sebelum memulai!");
      return;
    }
    setUpdating(true);
    sound.playPowerUp();
    const { data } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", room.id)
      .select("id, pin_code, quiz_id, status")
      .single();

    if (data) setRoom(data as RoomData);
    setUpdating(false);
  };

  const handleFinishSession = async (skipConfirm = false) => {
    if (!room) return;
    if (
      !skipConfirm &&
      !confirm("Akhiri permainan sekarang dan tampilkan podium pemenang?")
    ) {
      return;
    }
    setUpdating(true);
    sound.playCorrect();
    const { data } = await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", room.id)
      .select("id, pin_code, quiz_id, status")
      .single();
    if (data) setRoom(data as RoomData);
    setUpdating(false);
  };

  if (loading || !room) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        Menyiapkan Ruang Live...
      </main>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topScore = Math.max(100, sortedPlayers[0]?.score || 100);
  const finishedCount = players.filter((p) => p.is_finished).length;
  const allStudentsFinished =
    players.length > 0 && finishedCount === players.length;

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-12">
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-2xl shadow-sm border-b-4 border-[#135BC4]">
              ♞
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-800 block leading-none">
                Tacti<span className="text-[#2589FF]">Quiz</span> Live
              </span>
              <span className="text-xs font-bold text-slate-400">
                {quizTitle} • {questions.length} Soal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-50 border-2 border-sky-200 text-[#1E82F5] font-black text-sm">
              <Users className="w-4 h-4" />
              <span>{players.length} Pemain</span>
            </div>

            {room.status === "playing" && (
              <button
                type="button"
                onClick={() => handleFinishSession(allStudentsFinished)}
                disabled={updating}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm border-b-4 transition cursor-pointer ${
                  allStudentsFinished
                    ? "bg-[#22C55E] hover:bg-[#1EB054] text-white border-[#15803D] shadow-md"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>
                  {allStudentsFinished ? "Lihat Podium Juara" : "Akhiri Sesi"}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-7">
        {/* ==================== STATE 1: LOBBY MENUNGGU PEMAIN ==================== */}
        {room.status === "waiting" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-[32px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-7 text-white shadow-xl border-b-8 border-[#1359B8] text-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/20 text-xs font-extrabold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Kode Masuk
                Arena
              </span>
              <p className="text-sm font-bold text-sky-100">
                Buka halaman utama lalu masukkan PIN:
              </p>

              <div className="my-5 py-5 px-4 rounded-3xl bg-white text-slate-900 shadow-inner">
                <span className="text-4xl sm:text-5xl font-black tracking-[0.2em] text-[#1D7AFC]">
                  {room.pin_code}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyPin}
                className="w-full py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition mb-4 cursor-pointer"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>
                  {copied ? "Link Undangan Tersalin!" : "Salin Link Join Siswa"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartGame}
                disabled={updating || players.length === 0}
                className="w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-lg flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-lg transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Mulai Permainan ({players.length})</span>
              </button>
            </div>

            <div className="lg:col-span-7 bg-white p-6 rounded-[32px] border-2 border-slate-200/90 border-b-[6px] min-h-[360px]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-slate-800">
                  Peserta di Ruang Tunggu
                </h2>
                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-pulse">
                  ● Menunggu pemain...
                </span>
              </div>

              {players.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="text-5xl mb-3">🦉</div>
                  <p className="font-extrabold text-base text-slate-600">
                    Belum ada siswa yang masuk
                  </p>
                  <p className="text-xs font-medium mt-1">
                    Bagikan kode PIN <strong>{room.pin_code}</strong> kepada
                    siswa untuk mulai bergabung.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {players.map((p) => {
                      const meta =
                        PIECE_META[p.piece_skin] || PIECE_META.KNIGHT;
                      return (
                        <motion.div
                          key={p.id}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FBFF] border-2 border-sky-100 border-b-4 shadow-xs"
                        >
                          <div
                            className={`w-10 h-10 rounded-xl ${meta.badgeColor} text-white flex items-center justify-center text-2xl shrink-0`}
                          >
                            {meta.symbol}
                          </div>
                          <span className="font-extrabold text-sm text-slate-800 truncate">
                            {p.nickname}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== STATE 2: LIVE MONITOR & KLASEMEN SISWA ==================== */}
        {room.status === "playing" && (
          <div className="flex flex-col gap-6">
            {/* Ringkasan Status Kelas (Tanpa Tombol Next) */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs animate-pulse">
                    ● Sesi Berlangsung Mandiri
                  </span>
                  <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 font-black text-xs">
                    Total {questions.length} Soal
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800">
                  Pantauan Langsung Progres Siswa
                </h2>
                <p className="text-xs font-bold text-slate-400">
                  Siswa mengerjakan soal sesuai kecepatan masing-masing •{" "}
                  <strong className="text-slate-600">
                    {finishedCount}/{players.length}
                  </strong>{" "}
                  siswa telah selesai
                </p>
              </div>

              {allStudentsFinished && (
                <button
                  type="button"
                  onClick={() => handleFinishSession(true)}
                  disabled={updating}
                  className="px-6 py-3.5 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] text-white font-black text-sm border-b-4 border-[#15803D] shadow-md transition cursor-pointer shrink-0"
                >
                  🏆 Semua Selesai! Buka Podium
                </button>
              )}
            </div>

            {/* Live Racing Leaderboard + Info Soal yang Sedang Dikerjakan */}
            <div className="bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Klasemen & Posisi Soal Siswa
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  Update otomatis setiap kali siswa menjawab
                </span>
              </div>

              <div className="flex flex-col gap-3.5">
                {sortedPlayers.map((player, index) => {
                  const meta =
                    PIECE_META[player.piece_skin] || PIECE_META.KNIGHT;
                  const barWidth = Math.max(
                    12,
                    Math.round((player.score / topScore) * 100),
                  );
                  const qIdx = player.current_question_index ?? 0;
                  const activeQuestionObj = questions[qIdx];

                  return (
                    <motion.div
                      layout
                      key={player.id}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 28,
                      }}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200/70"
                    >
                      {/* Peringkat */}
                      <div
                        className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                          index === 0
                            ? "bg-amber-400 text-slate-950"
                            : index === 1
                              ? "bg-slate-300 text-slate-800"
                              : index === 2
                                ? "bg-amber-700/20 text-amber-900"
                                : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        #{index + 1}
                      </div>

                      {/* Avatar Bidak */}
                      <div
                        className={`w-11 h-11 rounded-xl ${meta.badgeColor} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
                      >
                        {meta.symbol}
                      </div>

                      {/* Nama, Posisi Nomor Soal, Teks Soal & Progress Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-black text-sm sm:text-base text-slate-800 truncate">
                              {player.nickname}
                            </span>

                            {player.is_finished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black shrink-0">
                                <FileQuestion className="w-3 h-3" /> Soal{" "}
                                {qIdx + 1}/{questions.length}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {player.streak >= 2 && (
                              <span className="inline-flex items-center gap-0.5 text-xs font-black text-orange-500">
                                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                                {player.streak}x
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-sm font-black text-[#1E82F5]">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              {player.score}
                            </span>
                          </div>
                        </div>

                        {/* Teks Soal yang Sedang Dikerjakan Siswa */}
                        <p className="text-xs font-semibold text-slate-500 truncate mb-2">
                          {player.is_finished
                            ? "🎉 Semua pertanyaan telah selesai dikerjakan."
                            : activeQuestionObj
                              ? `Sedang mengerjakan: "${activeQuestionObj.question_text}"`
                              : "Memuat soal..."}
                        </p>

                        <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                          <motion.div
                            animate={{ width: `${barWidth}%` }}
                            className="h-full bg-gradient-to-r from-[#3B9EFF] to-[#22C55E] rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STATE 3: PODIUM & PEMBAHASAN SOAL KELAS ==================== */}
        {room.status === "finished" && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="bg-white p-8 rounded-[32px] border-2 border-slate-200 border-b-8 text-center shadow-lg">
              <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] flex items-center justify-center border-b-4 border-[#CC8E00] shadow-md">
                <Trophy className="w-10 h-10 text-amber-950" />
              </div>
              <h2 className="text-3xl font-black text-slate-800">
                Podium Pemenang! 🎉
              </h2>
              <p className="text-sm font-bold text-slate-400 mt-1 mb-8">
                {quizTitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-end">
                {sortedPlayers.slice(0, 3).map((p, idx) => {
                  const meta = PIECE_META[p.piece_skin] || PIECE_META.KNIGHT;
                  const badge =
                    idx === 0
                      ? "🥇 Juara 1"
                      : idx === 1
                        ? "🥈 Juara 2"
                        : "🥉 Juara 3";
                  const cardStyle =
                    idx === 0
                      ? "bg-amber-50 border-amber-300 border-b-amber-400 sm:order-2 sm:py-8"
                      : idx === 1
                        ? "bg-slate-50 border-slate-300 border-b-slate-400 sm:order-1"
                        : "bg-orange-50/70 border-orange-200 border-b-orange-300 sm:order-3";

                  return (
                    <div
                      key={p.id}
                      className={`p-5 rounded-3xl border-2 border-b-[6px] flex flex-col items-center ${cardStyle}`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider mb-2">
                        {badge}
                      </span>
                      <div
                        className={`w-14 h-14 rounded-2xl ${meta.badgeColor} text-white flex items-center justify-center text-3xl mb-2 shadow-sm`}
                      >
                        {meta.symbol}
                      </div>
                      <p className="font-black text-lg text-slate-800 truncate max-w-full">
                        {p.nickname}
                      </p>
                      <p className="font-black text-xl text-[#1E82F5] mt-1 flex items-center gap-1">
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        {p.score}
                      </p>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-base border-b-4 border-[#1359B8] transition"
              >
                <Home className="w-5 h-5" /> Kembali ke Bank Kuis
              </Link>
            </div>

            <div className="bg-white border-2 border-slate-200/90 border-b-[6px] rounded-[32px] p-6 sm:p-8 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 text-[#2589FF] flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    Pembahasan & Kunci Jawaban Kelas
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    Tampilkan ke siswa untuk mengulas jawaban tiap nomor soal
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {questions.map((q, idx) => {
                  const opts: Record<OptionKey, string> = {
                    A: q.option_a,
                    B: q.option_b,
                    C: q.option_c,
                    D: q.option_d,
                  };
                  const pieceMeta =
                    PIECE_META[q.piece_type] || PIECE_META.KNIGHT;

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-3xl bg-[#F8FBFF] border-2 border-slate-200/80"
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-black">
                          Soal #{idx + 1}
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
                          {pieceMeta.symbol} {pieceMeta.name}
                        </span>
                      </div>

                      <p className="font-extrabold text-base sm:text-lg text-slate-800 mb-3.5">
                        {q.question_text}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                          const isCorrect = key === q.correct_option;
                          const style = OPTION_STYLES[key];

                          return (
                            <div
                              key={key}
                              className={`flex items-center justify-between gap-2 p-3 rounded-2xl border-2 ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                                  : "bg-white border-slate-200 text-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-lg ${style.badgeBg} text-white font-black text-xs flex items-center justify-center shrink-0`}
                                >
                                  {key}
                                </span>
                                <span className="text-sm font-extrabold truncate">
                                  {opts[key]}
                                </span>
                              </div>
                              {isCorrect && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">
                                  ✓ Jawaban Benar
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
