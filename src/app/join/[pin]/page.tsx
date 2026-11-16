"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Star,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Crown,
  Scissors,
  Trophy,
  Home,
  ArrowRight,
  BookOpen,
  Volume2,
  VolumeX,
} from "lucide-react";
import ChessQuizBoard, {
  QuestionData,
  OptionKey,
  PieceType,
  PIECE_META,
  OPTION_STYLES,
} from "@/components/ChessQuizBoard";
import { supabase } from "@/lib/supabase";
import { sound } from "@/lib/sound";

interface RoomData {
  id: string;
  pin_code: string;
  quiz_id: string;
  status: "waiting" | "playing" | "finished";
}

interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  piece_skin: PieceType;
  score: number;
  streak: number;
}

interface AnswerRecord {
  question: QuestionData;
  selectedOption: OptionKey | null;
  isCorrect: boolean;
}

const AVATAR_PIECES: PieceType[] = [
  "KNIGHT",
  "BISHOP",
  "ROOK",
  "QUEEN",
  "KING",
  "PAWN",
];
const QUESTION_TIME = 60;

export default function PlayerJoinAndPlayPage() {
  const params = useParams();
  const router = useRouter();
  const pin = params.pin as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<PieceType>("KNIGHT");
  const [joining, setJoining] = useState(false);

  // Menggunakan Index Lokal agar siswa bisa jalan sendiri
  const [localQIndex, setLocalQIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [feedback, setFeedback] = useState<
    "CORRECT" | "WRONG" | "TIMEOUT" | null
  >(null);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);

  // Status selesai khusus siswa ini
  const [isSelfFinished, setIsSelfFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PlayerRow[]>([]);
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);

  const [eliminatedOptions, setEliminatedOptions] = useState<OptionKey[]>([]);
  const [queenOverride, setQueenOverride] = useState(false);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedQueenBoost, setUsedQueenBoost] = useState(false);

  // Kontrol musik kalem saat sesi live playing berlangsung
  useEffect(() => {
    setIsMuted(sound.getMuted());

    if (player && room?.status === "playing" && !isSelfFinished) {
      sound.startMusic();
    } else {
      sound.stopMusic();
    }

    const unlockAudio = () => {
      if (
        !sound.getMuted() &&
        player &&
        room?.status === "playing" &&
        !isSelfFinished
      ) {
        sound.startMusic();
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      sound.stopMusic();
    };
  }, [player, room?.status, isSelfFinished]);

  const handleToggleMusic = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  const syncRoomState = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("rooms")
      .select("id, pin_code, quiz_id, status")
      .eq("id", roomId)
      .single();

    if (data) {
      setRoom(data as RoomData);
    }
  }, []);

  useEffect(() => {
    async function initPlayerRoom() {
      const { data: roomData, error } = await supabase
        .from("rooms")
        .select("id, pin_code, quiz_id, status")
        .eq("pin_code", pin)
        .single();

      if (error || !roomData) {
        alert("Kode PIN tidak ditemukan atau sesi sudah berakhir!");
        router.push("/");
        return;
      }

      setRoom(roomData as RoomData);

      const { data: qRows } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", roomData.quiz_id)
        .order("order_index", { ascending: true });

      if (qRows) {
        const mapped: QuestionData[] = qRows.map((row) => ({
          id: row.id,
          question_text: row.question_text,
          options: {
            A: row.option_a,
            B: row.option_b,
            C: row.option_c,
            D: row.option_d,
          },
          correct_option: row.correct_option as OptionKey,
          piece_type: (row.piece_type || "KNIGHT") as PieceType,
          obstacles: row.obstacles ?? 3,
        }));
        setQuestions(mapped);
      }

      setLoading(false);
    }

    initPlayerRoom();
  }, [pin, router]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`player-room-${room.id}`)
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
      syncRoomState(room.id);
    }, 2500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room?.id, syncRoomState]);

  useEffect(() => {
    if ((room?.status === "finished" || isSelfFinished) && room?.id) {
      supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .order("score", { ascending: false })
        .then(({ data }) => {
          if (data) setLeaderboard(data as PlayerRow[]);
        });
    }
  }, [room?.status, room?.id, isSelfFinished]);

  const goToNextQuestion = useCallback(() => {
    setFeedback(null);
    setLastPoints(null);
    setEliminatedOptions([]);
    setQueenOverride(false);
    setHasAnsweredCurrent(false);

    if (localQIndex + 1 >= questions.length) {
      setIsSelfFinished(true);
    } else {
      setLocalQIndex((prev) => prev + 1);
      setTimeLeft(QUESTION_TIME);
    }
  }, [localQIndex, questions.length]);

  // Timer mandiri siswa
  useEffect(() => {
    if (
      !player ||
      room?.status !== "playing" ||
      hasAnsweredCurrent ||
      isSelfFinished
    )
      return;
    const currentQ = questions[localQIndex];

    if (timeLeft <= 0) {
      sound.playWrong();
      setHasAnsweredCurrent(true);
      setFeedback("TIMEOUT");
      if (currentQ) {
        setAnswerHistory((prev) => [
          ...prev,
          { question: currentQ, selectedOption: null, isCorrect: false },
        ]);
      }

      supabase
        .from("players")
        .update({ streak: 0 })
        .eq("id", player.id)
        .then(() => {
          setPlayer((prev) => (prev ? { ...prev, streak: 0 } : null));
          setTimeout(goToNextQuestion, 1800);
        });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 0.1));
    }, 100);

    return () => clearInterval(timer);
  }, [
    player,
    room?.status,
    localQIndex,
    hasAnsweredCurrent,
    timeLeft,
    questions,
    isSelfFinished,
    goToNextQuestion,
  ]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !nickname.trim()) return;

    setJoining(true);
    const { data, error } = await supabase
      .from("players")
      .insert([
        {
          room_id: room.id,
          nickname: nickname.trim(),
          piece_skin: selectedAvatar,
          score: 0,
          streak: 0,
        },
      ])
      .select()
      .single();

    setJoining(false);

    if (error || !data) {
      alert(`Gagal bergabung: ${error?.message}`);
      return;
    }

    sound.playPowerUp();
    setPlayer(data as PlayerRow);
  };

  const handleAnswer = async (
    selected: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => {
    if (!player || hasAnsweredCurrent || !room || isSelfFinished) return;
    setHasAnsweredCurrent(true);

    const currentQ = questions[localQIndex];
    if (currentQ) {
      setAnswerHistory((prev) => [
        ...prev,
        { question: currentQ, selectedOption: selected, isCorrect },
      ]);
    }

    if (isCorrect) {
      const nextStreak = player.streak + 1;
      const multiplier = nextStreak >= 3 ? 1.5 : nextStreak === 2 ? 1.2 : 1;
      const speedBonus = Math.round((timeLeft / QUESTION_TIME) * 50);
      const efficiencyBonus = movesUsed === 1 ? 25 : 0;
      const earned = Math.round(
        (100 + speedBonus + efficiencyBonus) * multiplier,
      );
      const nextScore = player.score + earned;

      setLastPoints(earned);
      setFeedback("CORRECT");
      setPlayer({ ...player, score: nextScore, streak: nextStreak });

      await supabase
        .from("players")
        .update({ score: nextScore, streak: nextStreak })
        .eq("id", player.id);
    } else {
      setFeedback("WRONG");
      setPlayer({ ...player, streak: 0 });

      await supabase.from("players").update({ streak: 0 }).eq("id", player.id);
    }

    setTimeout(goToNextQuestion, 1800);
  };

  if (loading || !room) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        Menghubungkan ke Arena...
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 flex items-center justify-center p-4">
        <form
          onSubmit={handleJoinSubmit}
          className="w-full max-w-md bg-white p-7 rounded-[32px] border-2 border-slate-200 border-b-8 shadow-xl"
        >
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black mb-2">
              <Sparkles className="w-3.5 h-3.5" /> PIN Room: {room.pin_code}
            </span>
            <h1 className="text-2xl font-black text-slate-800">
              Siapkan Karaktermu!
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Tulis nama panggilan dan pilih bidak favoritmu
            </p>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              Nama Panggilan
            </label>
            <input
              type="text"
              maxLength={16}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Contoh: Bintang"
              className="w-full px-4 py-3.5 rounded-2xl bg-[#F2F7FC] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-black text-lg text-slate-800 text-center"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Pilih Avatar Bidak
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {AVATAR_PIECES.map((piece) => {
                const meta = PIECE_META[piece];
                const isSelected = selectedAvatar === piece;
                return (
                  <button
                    key={piece}
                    type="button"
                    onClick={() => setSelectedAvatar(piece)}
                    className={`flex flex-col items-center p-3 rounded-2xl border-2 border-b-4 transition cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-400 border-b-amber-500 scale-105"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-3xl mb-1">{meta.symbol}</span>
                    <span className="text-xs font-extrabold text-slate-700">
                      {meta.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={joining || !nickname.trim()}
            className="w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-lg flex items-center justify-center gap-2 border-b-4 border-[#15803D] transition cursor-pointer"
          >
            <span>{joining ? "Masuk..." : "Gabung Sekarang!"}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </main>
    );
  }

  if (room.status === "waiting") {
    const avatarMeta = PIECE_META[player.piece_skin] || PIECE_META.KNIGHT;
    return (
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-[32px] border-2 border-slate-200 border-b-8 text-center shadow-xl">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className={`w-20 h-20 mx-auto mb-4 rounded-3xl ${avatarMeta.badgeColor} text-white flex items-center justify-center text-5xl shadow-md border-b-4 border-black/20`}
          >
            {avatarMeta.symbol}
          </motion.div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs">
            ✓ Berhasil Bergabung
          </span>
          <h1 className="text-2xl font-black text-slate-800 mt-3">
            Halo, {player.nickname}! 👋
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Lihat namamu di layar depan kelas. Permainan akan segera dimulai
            oleh gurumu!
          </p>
        </div>
      </main>
    );
  }

  // Jika siswa sudah selesai sendiri ATAU guru mengakhiri permainan duluan
  if (room.status === "finished" || isSelfFinished) {
    const myRank = leaderboard.findIndex((p) => p.id === player.id) + 1;
    return (
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-200 border-b-8 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] flex items-center justify-center border-b-4 border-[#CC8E00]">
              <Trophy className="w-10 h-10 text-amber-950" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">
              Permainan Selesai! 🎉
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-1">
              {player.nickname}
            </p>

            <div className="my-6 grid grid-cols-2 gap-3 max-w-md mx-auto">
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
                <p className="text-xs font-extrabold text-amber-700">
                  {room.status === "finished"
                    ? "Peringkatmu"
                    : "Peringkat Sementara"}
                </p>
                <p className="text-3xl font-black text-amber-600 mt-1">
                  {myRank > 0 ? `#${myRank}` : "-"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <p className="text-xs font-extrabold text-sky-700">
                  Total Bintang
                </p>
                <p className="text-3xl font-black text-[#1E82F5] mt-1 flex items-center justify-center gap-1">
                  <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                  {player.score}
                </p>
              </div>
            </div>

            {room.status !== "finished" && (
              <p className="text-sm font-bold text-slate-500 mb-6 animate-pulse">
                Menunggu guru mengakhiri permainan untuk melihat hasil kelas...
              </p>
            )}

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-base border-b-4 border-[#1359B8] transition"
            >
              <Home className="w-5 h-5" /> Kembali ke Beranda
            </Link>
          </div>

          {answerHistory.length > 0 && (
            <div className="bg-white border-2 border-slate-200/90 border-b-[6px] rounded-[32px] p-6 sm:p-7 shadow-md">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#2589FF] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    Pembahasan Jawabanmu
                  </h2>
                  <p className="text-xs font-bold text-slate-400">
                    Lihat soal yang sudah kamu jawab tadi
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {answerHistory.map((record, idx) => (
                  <div
                    key={record.question.id}
                    className={`p-5 rounded-3xl border-2 border-b-4 ${
                      record.isCorrect
                        ? "bg-[#F8FCFA] border-emerald-200"
                        : "bg-[#FFF9FA] border-rose-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-black">
                        Soal #{idx + 1}
                      </span>
                      {record.isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-black">
                          <XCircle className="w-3.5 h-3.5" />{" "}
                          {record.selectedOption === null
                            ? "Waktu Habis"
                            : "Kurang Tepat"}
                        </span>
                      )}
                    </div>

                    <p className="font-extrabold text-base text-slate-800 mb-3">
                      {record.question.question_text}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                        const isKeyCorrect =
                          key === record.question.correct_option;
                        const isUserChoice = key === record.selectedOption;
                        const style = OPTION_STYLES[key];

                        let boxStyle =
                          "bg-white border-slate-200 text-slate-600";
                        if (isKeyCorrect) {
                          boxStyle =
                            "bg-emerald-50 border-emerald-400 text-emerald-900";
                        } else if (isUserChoice && !record.isCorrect) {
                          boxStyle = "bg-rose-50 border-rose-400 text-rose-900";
                        }

                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border-2 ${boxStyle}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-lg ${style.badgeBg} text-white font-black text-xs flex items-center justify-center shrink-0`}
                              >
                                {key}
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold truncate">
                                {record.question.options[key]}
                              </span>
                            </div>

                            {isKeyCorrect && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">
                                ✓ Kunci
                              </span>
                            )}
                            {isUserChoice && !isKeyCorrect && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white shrink-0">
                                Pilihanmu
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  const currentQuestion = questions[localQIndex] || questions[0];
  const activePiece: PieceType = queenOverride
    ? "QUEEN"
    : currentQuestion?.piece_type || "KNIGHT";
  const timerPercent = (timeLeft / QUESTION_TIME) * 100;

  const activateFiftyFifty = () => {
    if (usedFiftyFifty || hasAnsweredCurrent || !currentQuestion) return;
    sound.playPowerUp();
    const wrongKeys = (["A", "B", "C", "D"] as OptionKey[]).filter(
      (k) => k !== currentQuestion.correct_option,
    );
    setEliminatedOptions(
      [...wrongKeys].sort(() => Math.random() - 0.5).slice(0, 2),
    );
    setUsedFiftyFifty(true);
  };

  const activateQueenBoost = () => {
    if (usedQueenBoost || hasAnsweredCurrent || activePiece === "QUEEN") return;
    sound.playPowerUp();
    setQueenOverride(true);
    setUsedQueenBoost(true);
  };

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-8">
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-base sm:text-lg text-slate-800">
              {player.nickname}
            </span>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-sky-100 text-sky-700">
              Soal {localQIndex + 1}/{questions.length}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleMusic}
              title={
                isMuted ? "Nyalakan Musik Belajar" : "Matikan Musik (Mute)"
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 font-black text-xs transition cursor-pointer ${
                isMuted
                  ? "bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="hidden sm:inline">Mute</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Musik</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-orange-50 border-2 border-orange-200 text-orange-600 font-black text-sm">
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
              <span>{player.streak}</span>
            </div>

            <div className="relative flex items-center gap-1 px-3.5 py-1.5 rounded-2xl bg-sky-50 border-2 border-sky-200 text-[#1E82F5] font-black text-sm">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{player.score}</span>
              <AnimatePresence>
                {lastPoints && (
                  <motion.span
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 34, scale: 1.1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-black shadow-md pointer-events-none"
                  >
                    +{lastPoints}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="rounded-[28px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-6 text-white shadow-lg border-b-[6px] border-[#1359B8]">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-extrabold bg-white/20 px-3 py-1 rounded-full">
                  Soal #{localQIndex + 1}
                </span>
                <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <div className="w-24 h-2 bg-white/25 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-300 rounded-full transition-all duration-100"
                      style={{ width: `${timerPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-black">
                    {Math.ceil(timeLeft)}s
                  </span>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-black leading-snug">
                {currentQuestion.question_text}
              </h1>
            </div>

            {feedback && (
              <div
                className={`p-4 rounded-2xl border-2 border-b-4 text-center font-black text-sm sm:text-base ${
                  feedback === "CORRECT"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-rose-50 border-rose-300 text-rose-700"
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  {feedback === "CORRECT" ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span>Tepat Sekali! (+{lastPoints} Bintang)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-500" />
                      <span>
                        {feedback === "TIMEOUT"
                          ? "Waktu habis! "
                          : "Kurang tepat! "}
                        Jawaban benar: {currentQuestion.correct_option}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs font-bold opacity-75">
                  ⏳ Melanjutkan ke soal berikutnya...
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                const isEliminated = eliminatedOptions.includes(key);
                const style = OPTION_STYLES[key];
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 border-b-4 ${
                      isEliminated
                        ? "opacity-35 line-through bg-slate-100 border-slate-200"
                        : `${style.cardBg} ${style.cardBorder}`
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl ${style.badgeBg} text-white font-black text-sm flex items-center justify-center shrink-0`}
                    >
                      {key}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-700">
                      {currentQuestion.options[key]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={activateFiftyFifty}
                disabled={usedFiftyFifty || hasAnsweredCurrent}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 border-b-4 text-left transition ${
                  usedFiftyFifty
                    ? "bg-slate-100 border-slate-200 opacity-50"
                    : "bg-[#F3EFFF] border-[#D8CEFF] border-b-[#C2B2FF] cursor-pointer"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#7C5CFC] text-white flex items-center justify-center shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs text-slate-800">
                  50:50 Hapus 2
                </span>
              </button>

              <button
                type="button"
                onClick={activateQueenBoost}
                disabled={
                  usedQueenBoost ||
                  hasAnsweredCurrent ||
                  activePiece === "QUEEN"
                }
                className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 border-b-4 text-left transition ${
                  usedQueenBoost || activePiece === "QUEEN"
                    ? "bg-slate-100 border-slate-200 opacity-50"
                    : "bg-[#FFF5E6] border-[#FFE0B2] border-b-[#FFCC80] cursor-pointer"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#FF9800] text-white flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xs text-slate-800">
                  Mode Ratu Super
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-md">
            <ChessQuizBoard
              key={`live-q-${localQIndex}`}
              question={currentQuestion}
              activePiece={activePiece}
              eliminatedOptions={eliminatedOptions}
              disabled={hasAnsweredCurrent}
              onAnswer={handleAnswer}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
