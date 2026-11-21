"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
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
  XCircle,
  FileQuestion,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Radio,
  Crosshair,
  Presentation,
  ArrowRight,
  Clock,
  SkipForward,
  Volume2,
  VolumeX,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTeacherSession, TeacherSession } from "@/lib/auth";
import {
  HostingMode,
  RoomSessionSettings,
  DEFAULT_SESSION_SETTINGS,
  parseSessionSettings,
} from "@/lib/sessionSettings";
import {
  PIECE_META,
  PieceType,
  OptionKey,
  OPTION_STYLES,
} from "@/components/ChessQuizBoard";
import FormattedText from "@/components/FormattedText";
import { useLanguage } from "@/components/LanguageProvider";
import { PIECE_META_I18N } from "@/lib/i18n";
import { sound } from "@/lib/sound";

interface RoomData {
  id: string;
  pin_code: string;
  quiz_id: string;
  status: "waiting" | "playing" | "finished";
  hosting_mode?: HostingMode;
  current_question_index?: number;
  reveal_answer?: boolean;
  settings?: RoomSessionSettings;
}

interface QuestionRow {
  id: string;
  question_text: string;
  image_url?: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
  correct_options?: OptionKey[];
  allow_multiple?: boolean;
  time_limit?: number;
  piece_type: PieceType;
  order_index: number;
}

interface StoredAnswer {
  question_id: string;
  question_index: number;
  selected_option: OptionKey | null;
  is_correct: boolean;
}

interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  piece_skin: PieceType;
  score: number;
  streak: number;
  correct_count?: number;
  wrong_count?: number;
  tab_switches?: number;
  answers?: StoredAnswer[] | string;
  current_question_index?: number;
  is_finished?: boolean;
  joined_at: string;
}

function parsePlayerAnswers(raw: unknown): StoredAnswer[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as StoredAnswer[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredAnswer[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function findAnswerForQuestion(
  ansList: StoredAnswer[],
  questionId: string,
  qIndex: number,
): StoredAnswer | undefined {
  return ansList.find(
    (a) =>
      String(a.question_id) === String(questionId) ||
      a.question_index === qIndex,
  );
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export default function HostRoomPage() {
  const params = useParams();
  const router = useRouter();
  const pin = params.pin as string;
  const { lang, t } = useLanguage();

  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [sessionSettings, setSessionSettings] = useState<RoomSessionSettings>({
    ...DEFAULT_SESSION_SETTINGS,
  });
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [activeTab, setActiveTab] = useState<"LEADERBOARD" | "QUESTIONS">(
    "LEADERBOARD",
  );
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number>(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | "ALL">(
    "ALL",
  );
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // Timer & phase kontrol khusus mode Teacher-Led
  const [hostTimeLeft, setHostTimeLeft] = useState<number>(60);
  const [hostMaxTime, setHostMaxTime] = useState<number>(60);
  const revealedRoundRef = useRef<number | null>(null);
  const prevRevealStateRef = useRef<boolean>(false);

  // Kontrol Audio & Sound Effects
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const lastTickSecondRef = useRef<number | null>(null);

  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("score", { ascending: false })
      .order("joined_at", { ascending: true });

    if (data) setPlayers(data as PlayerRow[]);
  }, []);

  const syncRoom = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("rooms")
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .eq("id", roomId)
      .single();

    if (data) {
      setRoom((prev) => {
        if (
          prev &&
          prev.status === data.status &&
          prev.current_question_index === data.current_question_index &&
          prev.reveal_answer === data.reveal_answer &&
          prev.hosting_mode === data.hosting_mode
        ) {
          return prev;
        }
        return data as RoomData;
      });
    }
  }, []);

  useEffect(() => {
    async function initHost() {
      const session = getTeacherSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: roomData, error } = await supabase
        .from("rooms")
        .select(
          "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
        )
        .eq("pin_code", pin)
        .single();

      if (error || !roomData) {
        alert(lang === "EN" ? "Room not found!" : "Room tidak ditemukan!");
        router.replace("/dashboard");
        return;
      }

      const [{ data: quiz }, { data: qList }] = await Promise.all([
        supabase
          .from("quizzes")
          .select("title, teacher_id")
          .eq("id", roomData.quiz_id)
          .single(),
        supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", roomData.quiz_id)
          .order("order_index", { ascending: true }),
      ]);

      if (!quiz || quiz.teacher_id !== session.id) {
        alert(
          lang === "EN"
            ? "Access denied! You do not have permission to host this room."
            : "Akses ditolak! Anda tidak memiliki izin untuk mengakses ruang host ini.",
        );
        router.replace("/dashboard");
        return;
      }

      const typedRoom = roomData as RoomData;
      const typedQuestions = (qList || []) as QuestionRow[];
      const parsedSettings = parseSessionSettings(typedRoom.settings);

      setTeacher(session);
      setRoom(typedRoom);
      setSessionSettings(parsedSettings);
      setQuizTitle(quiz.title);
      setQuestions(typedQuestions);

      if (typedRoom.hosting_mode === "TEACHER_LED") {
        const activeIdx = Math.min(
          typedRoom.current_question_index ?? 0,
          Math.max(0, typedQuestions.length - 1),
        );
        const qLimit = typedQuestions[activeIdx]?.time_limit || 60;
        setHostTimeLeft(qLimit);
        setHostMaxTime(qLimit);
        setActiveTab(typedRoom.reveal_answer ? "LEADERBOARD" : "QUESTIONS");
        prevRevealStateRef.current = Boolean(typedRoom.reveal_answer);
      }

      await fetchPlayers(typedRoom.id);
      setLoading(false);
    }

    initHost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, router, fetchPlayers]);

  useEffect(() => {
    if (!room?.id || !teacher) return;

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
      syncRoom(room.id);
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room?.id, teacher, fetchPlayers, syncRoom]);

  const isTeacherLed = room?.hosting_mode === "TEACHER_LED";
  const teacherLedQIdx = Math.min(
    room?.current_question_index ?? 0,
    Math.max(0, questions.length - 1),
  );
  const roomStatus = room?.status;

  // Musik latar otomatis saat Lobby & Gameplay, lalu Fanfare saat Podium muncul
  useEffect(() => {
    setIsMuted(sound.getMuted());

    if (!roomStatus || loading) return;

    if (roomStatus === "waiting" || roomStatus === "playing") {
      sound.startMusic();
    } else if (roomStatus === "finished") {
      sound.stopMusic();
      sound.playFanfare();
    }

    const unlockAudio = () => {
      if (
        !sound.getMuted() &&
        (roomStatus === "waiting" || roomStatus === "playing")
      ) {
        sound.startMusic();
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      sound.stopMusic();
    };
  }, [roomStatus, loading]);

  // Efek detak timer pada 5 detik terakhir di mode Teacher-Led
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || room?.reveal_answer) {
      lastTickSecondRef.current = null;
      return;
    }
    const wholeSec = Math.ceil(hostTimeLeft);
    if (
      wholeSec <= 5 &&
      wholeSec >= 1 &&
      lastTickSecondRef.current !== wholeSec
    ) {
      lastTickSecondRef.current = wholeSec;
      sound.playTick();
    }
  }, [isTeacherLed, room?.status, room?.reveal_answer, hostTimeLeft]);

  const handleToggleHostMusic = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  // Sinkronkan tampilan otomatis saat phase Teacher-Led berpindah (Soal <-> Leaderboard)
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing") return;

    const isRevealed = Boolean(room.reveal_answer);
    if (isRevealed && !prevRevealStateRef.current) {
      setActiveTab("LEADERBOARD");
    } else if (!isRevealed && prevRevealStateRef.current) {
      setActiveTab("QUESTIONS");
    }
    prevRevealStateRef.current = isRevealed;
  }, [isTeacherLed, room?.status, room?.reveal_answer]);

  // Reset timer Host setiap kali nomor soal Teacher-Led berubah
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || questions.length === 0)
      return;
    if (room.reveal_answer) return;

    const qLimit = questions[teacherLedQIdx]?.time_limit || 60;
    setHostTimeLeft(qLimit);
    setHostMaxTime(qLimit);
    revealedRoundRef.current = null;
  }, [
    isTeacherLed,
    room?.status,
    room?.reveal_answer,
    teacherLedQIdx,
    questions,
  ]);

  // Selesaikan babak soal aktif & munculkan Leaderboard
  const completeCurrentTeacherLedRound = useCallback(async () => {
    if (!room || !isTeacherLed || room.reveal_answer) return;
    if (revealedRoundRef.current === teacherLedQIdx) return;

    revealedRoundRef.current = teacherLedQIdx;
    sound.playCorrect();
    setActiveTab("LEADERBOARD");

    const { data } = await supabase
      .from("rooms")
      .update({ reveal_answer: true })
      .eq("id", room.id)
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .single();

    if (data) setRoom(data as RoomData);
  }, [room, isTeacherLed, teacherLedQIdx]);

  // Hitung mundur timer Teacher-Led di layar Guru
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || room?.reveal_answer)
      return;
    if (!sessionSettings.question_timer) return;

    if (hostTimeLeft <= 0) {
      completeCurrentTeacherLedRound();
      return;
    }

    const timer = setInterval(() => {
      setHostTimeLeft((prev) => Math.max(0, Number((prev - 0.1).toFixed(1))));
    }, 100);

    return () => clearInterval(timer);
  }, [
    isTeacherLed,
    room?.status,
    room?.reveal_answer,
    sessionSettings.question_timer,
    hostTimeLeft,
    completeCurrentTeacherLedRound,
  ]);

  // Otomatis munculkan Leaderboard jika SELURUH siswa sudah menjawab soal aktif
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || room?.reveal_answer)
      return;
    if (players.length === 0 || questions.length === 0) return;

    const currentQ = questions[teacherLedQIdx];
    if (!currentQ) return;

    const answeredCount = players.filter((p) =>
      Boolean(
        findAnswerForQuestion(
          parsePlayerAnswers(p.answers),
          currentQ.id,
          teacherLedQIdx,
        ),
      ),
    ).length;

    if (answeredCount >= players.length) {
      completeCurrentTeacherLedRound();
    }
  }, [
    isTeacherLed,
    room?.status,
    room?.reveal_answer,
    players,
    questions,
    teacherLedQIdx,
    completeCurrentTeacherLedRound,
  ]);

  const handleCopyPin = () => {
    const joinUrl = `${window.location.origin}/join/${pin}`;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    if (!room || !teacher) return;
    if (players.length === 0) {
      alert(
        lang === "EN"
          ? "Wait for at least 1 player to join before starting!"
          : "Tunggu minimal 1 pemain bergabung sebelum memulai!",
      );
      return;
    }
    setUpdating(true);
    sound.playPowerUp();

    const firstLimit = questions[0]?.time_limit || 60;
    setHostTimeLeft(firstLimit);
    setHostMaxTime(firstLimit);
    revealedRoundRef.current = null;
    prevRevealStateRef.current = false;

    if (isTeacherLed) {
      setActiveTab("QUESTIONS");
    }

    const { data } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        current_question_index: 0,
        reveal_answer: false,
      })
      .eq("id", room.id)
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .single();

    if (data) setRoom(data as RoomData);
    setUpdating(false);
  };

  const handleNextTeacherLedQuestion = async () => {
    if (!room || updating) return;

    if (teacherLedQIdx + 1 >= questions.length) {
      await handleFinishSession(true);
      return;
    }

    setUpdating(true);
    sound.playMove();

    const nextIdx = teacherLedQIdx + 1;
    const nextLimit = questions[nextIdx]?.time_limit || 60;
    setHostTimeLeft(nextLimit);
    setHostMaxTime(nextLimit);
    revealedRoundRef.current = null;
    prevRevealStateRef.current = false;
    setActiveTab("QUESTIONS");

    const { data } = await supabase
      .from("rooms")
      .update({
        current_question_index: nextIdx,
        reveal_answer: false,
      })
      .eq("id", room.id)
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .single();

    if (data) setRoom(data as RoomData);
    setUpdating(false);
  };

  const handleFinishSession = async (skipConfirm = false) => {
    if (!room || !teacher) return;
    const confirmMsg =
      lang === "EN"
        ? "End the game now and show the winners podium?"
        : "Akhiri permainan sekarang dan tampilkan podium pemenang?";

    if (!skipConfirm && !(await window.modernConfirm(confirmMsg))) {
      return;
    }
    setUpdating(true);
    sound.playCorrect();
    const { data } = await supabase
      .from("rooms")
      .update({ status: "finished", reveal_answer: false })
      .eq("id", room.id)
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .single();
    if (data) setRoom(data as RoomData);
    setUpdating(false);
  };

  if (loading || !room || !teacher) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        {lang === "EN"
          ? "Verifying Host Access..."
          : "Memverifikasi Akses Host..."}
      </main>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topScore = Math.max(100, sortedPlayers[0]?.score || 100);
  const finishedCount = players.filter((p) => p.is_finished).length;
  const allStudentsFinished =
    players.length > 0 && finishedCount === players.length;

  // ==================== LAYAR SOAL SHARE SCREEN (TEACHER-LED) ====================
  const renderTeacherLedStage = () => {
    const currentQ = questions[teacherLedQIdx];
    if (!currentQ) return null;

    const optsMap: Record<OptionKey, string> = {
      A: currentQ.option_a,
      B: currentQ.option_b,
      C: currentQ.option_c,
      D: currentQ.option_d,
    };

    const validCorrectKeys: OptionKey[] =
      Array.isArray(currentQ.correct_options) &&
      currentQ.correct_options.length > 0
        ? currentQ.correct_options
        : [currentQ.correct_option];

    const pieceMeta = PIECE_META[currentQ.piece_type] || PIECE_META.KNIGHT;
    const localizedPiece =
      PIECE_META_I18N?.[lang]?.[currentQ.piece_type] || pieceMeta;

    const answersOnThisQ = players
      .map((p) =>
        findAnswerForQuestion(
          parsePlayerAnswers(p.answers),
          currentQ.id,
          teacherLedQIdx,
        ),
      )
      .filter((a): a is StoredAnswer => Boolean(a));

    const timerPercent = (hostTimeLeft / Math.max(1, hostMaxTime)) * 100;
    const isLastQuestion = teacherLedQIdx + 1 >= questions.length;

    return (
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border-2 border-slate-200/90 border-b-[6px] shadow-md flex flex-col gap-6">
        {/* Bar Status Atas: Nomor Soal + Timer + Jumlah Siswa Menjawab */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-black">
              {lang === "EN"
                ? `Question ${teacherLedQIdx + 1} of ${questions.length}`
                : `Soal ${teacherLedQIdx + 1} dari ${questions.length}`}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
              {pieceMeta.symbol} {localizedPiece.name}
            </span>
            {currentQ.allow_multiple && (
              <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 text-xs font-black">
                {lang === "EN" ? "Multiple Answers" : "Jawaban Ganda"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Timer Hitung Mundur Soal */}
            {sessionSettings.question_timer && !room.reveal_answer && (
              <div
                className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border-2 font-black text-sm ${
                  hostTimeLeft <= 10
                    ? "bg-rose-50 border-rose-300 text-rose-600 animate-pulse"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                <div className="w-24 sm:w-32 h-2.5 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      timerPercent > 30 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
                <span className="min-w-[2.4rem] text-right">
                  {formatSeconds(hostTimeLeft)}
                </span>
              </div>
            )}

            {/* Counter Siswa yang Sudah Menjawab */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-black text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span>
                {answersOnThisQ.length} / {players.length}{" "}
                {lang === "EN" ? "Answered" : "Menjawab"}
              </span>
            </div>
          </div>
        </div>

        {/* Kartu Soal Utama untuk Share Screen */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-6 sm:p-8 text-white shadow-lg border-b-[6px] border-[#1359B8]">
          {currentQ.image_url && (
            <div className="mb-5 bg-white/95 p-3 rounded-2xl shadow-inner">
              <img
                src={currentQ.image_url}
                alt="Question"
                className="max-h-72 mx-auto rounded-xl object-contain"
              />
            </div>
          )}
          <h2 className="text-xl sm:text-3xl font-black leading-snug tracking-tight">
            {teacherLedQIdx + 1}.{" "}
            <FormattedText text={currentQ.question_text} />
          </h2>
        </div>

        {/* 4 Pilihan Jawaban Besar di Layar Guru */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
            const style = OPTION_STYLES[key];
            const isCorrect = validCorrectKeys.includes(key);
            const countPicked = answersOnThisQ.filter(
              (a) => a.selected_option === key,
            ).length;

            let boxClass = "bg-[#F8FBFF] border-slate-200";
            if (room.reveal_answer) {
              boxClass = isCorrect
                ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40"
                : "bg-slate-50 border-slate-200 opacity-55";
            }

            return (
              <div
                key={key}
                className={`p-4 sm:p-5 rounded-2xl border-2 border-b-4 flex items-start justify-between gap-3 transition ${boxClass}`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span
                    className={`w-10 h-10 rounded-xl ${style.badgeBg} text-white font-black text-base flex items-center justify-center shrink-0`}
                  >
                    {key}
                  </span>
                  <span className="text-base sm:text-xl font-extrabold text-slate-800 whitespace-normal break-words leading-snug pt-1">
                    <FormattedText text={optsMap[key]} />
                  </span>
                </div>

                {room.reveal_answer && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isCorrect && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-black">
                        {lang === "EN" ? "✓ Key" : "✓ Kunci"}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-600">
                      {countPicked} {lang === "EN" ? "picks" : "pilih"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tombol Kontrol Cepat di Bawah Soal */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          {!room.reveal_answer ? (
            <>
              <p className="text-xs font-bold text-slate-500">
                {lang === "EN"
                  ? "Leaderboard will appear automatically once all students answer or the timer ends."
                  : "Leaderboard akan muncul otomatis setelah semua siswa menjawab atau waktu habis."}
              </p>
              <button
                type="button"
                onClick={completeCurrentTeacherLedRound}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
                <span>
                  {lang === "EN"
                    ? "End Question & Show Leaderboard"
                    : "Akhiri Soal & Lihat Leaderboard"}
                </span>
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-end">
              <button
                type="button"
                onClick={handleNextTeacherLedQuestion}
                disabled={updating}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] text-white font-black text-sm sm:text-base border-b-4 border-[#15803D] shadow-md transition cursor-pointer"
              >
                {isLastQuestion ? (
                  <>
                    <Trophy className="w-5 h-5" />
                    <span>{t("openPodiumBtn")}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {lang === "EN" ? "Next Question" : "Soal Berikutnya"}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== PANEL TAB 1: LEADERBOARD ====================
  const renderLeaderboardPanel = () => {
    const currentRoundQ =
      isTeacherLed && room.status === "playing" && room.reveal_answer
        ? questions[teacherLedQIdx]
        : null;

    const roundOptsMap: Record<OptionKey, string> | null = currentRoundQ
      ? {
          A: currentRoundQ.option_a,
          B: currentRoundQ.option_b,
          C: currentRoundQ.option_c,
          D: currentRoundQ.option_d,
        }
      : null;

    const roundValidKeys: OptionKey[] = currentRoundQ
      ? Array.isArray(currentRoundQ.correct_options) &&
        currentRoundQ.correct_options.length > 0
        ? currentRoundQ.correct_options
        : [currentRoundQ.correct_option]
      : [];

    const isLastQuestion = teacherLedQIdx + 1 >= questions.length;

    return (
      <div className="flex flex-col gap-5">
        {/* Banner Kunci Jawaban + Tombol Next Question saat babak soal Teacher-Led selesai */}
        {currentRoundQ && roundOptsMap && (
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border-2 border-emerald-300 border-b-[6px] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === "EN"
                  ? `Question #${teacherLedQIdx + 1} Completed!`
                  : `Soal #${teacherLedQIdx + 1} Selesai!`}
              </span>
              <p className="text-sm sm:text-base font-black text-slate-800">
                {lang === "EN" ? "Correct Answer: " : "Kunci Jawaban: "}
                <span className="text-emerald-600">
                  {roundValidKeys.map((k, idx) => (
                    <span key={k}>
                      {idx > 0 && " / "}
                      {k}. <FormattedText text={roundOptsMap[k]} />
                    </span>
                  ))}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextTeacherLedQuestion}
              disabled={updating}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] active:translate-y-0.5 text-white font-black text-sm sm:text-base border-b-4 border-[#15803D] shadow-md transition cursor-pointer shrink-0"
            >
              {isLastQuestion ? (
                <>
                  <Trophy className="w-5 h-5" />
                  <span>{t("openPodiumBtn")}</span>
                </>
              ) : (
                <>
                  <span>
                    {lang === "EN"
                      ? "Next Question"
                      : "Next Question (Soal Berikutnya)"}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        <div className="bg-white p-5 sm:p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              {lang === "EN"
                ? "Leaderboard & Student Answer Breakdown"
                : "Klasemen & Rincian Jawaban Siswa"}
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {lang === "EN"
                ? "Click a student row to inspect question details"
                : "Klik baris siswa untuk melihat detail soal benar/salah"}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {sortedPlayers.map((player, index) => {
              const meta = PIECE_META[player.piece_skin] || PIECE_META.KNIGHT;
              const barWidth = Math.max(
                12,
                Math.round((player.score / topScore) * 100),
              );
              const qIdx = player.current_question_index ?? 0;
              const activeQuestionObj = questions[qIdx];

              const ansList = parsePlayerAnswers(player.answers);
              const correctNum =
                player.correct_count ??
                ansList.filter((a) => a.is_correct).length;
              const wrongNum =
                player.wrong_count ??
                ansList.filter((a) => !a.is_correct).length;
              const wrongQuestions = ansList.filter((a) => !a.is_correct);
              const isExpanded = expandedPlayerId === player.id;

              const roundAnswer = currentRoundQ
                ? findAnswerForQuestion(
                    ansList,
                    currentRoundQ.id,
                    teacherLedQIdx,
                  )
                : undefined;

              return (
                <motion.div
                  layout
                  key={player.id}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="rounded-2xl bg-[#F8FBFF] border-2 border-slate-200/80 overflow-hidden"
                >
                  <div
                    onClick={() =>
                      setExpandedPlayerId(isExpanded ? null : player.id)
                    }
                    className="flex items-center gap-3.5 p-3.5 cursor-pointer hover:bg-sky-50/60 transition"
                  >
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

                    <div
                      className={`w-11 h-11 rounded-xl ${meta.badgeColor} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
                    >
                      {meta.symbol}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-black text-sm sm:text-base text-slate-800">
                            {player.nickname}
                          </span>

                          {currentRoundQ ? (
                            roundAnswer ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                  roundAnswer.is_correct
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {roundAnswer.is_correct
                                  ? `✓ ${roundAnswer.selected_option} (${t("filterCorrect")})`
                                  : `✗ ${roundAnswer.selected_option || "Timeout"} (${t(
                                      "filterWrong",
                                    )})`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-black">
                                {lang === "EN" ? "No Answer" : "Tidak Menjawab"}
                              </span>
                            )
                          ) : player.is_finished ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">
                              <CheckCircle2 className="w-3 h-3" />{" "}
                              {lang === "EN" ? "Finished" : "Selesai"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">
                              <FileQuestion className="w-3 h-3" />{" "}
                              {lang === "EN"
                                ? `Q ${qIdx + 1}/${questions.length}`
                                : `Soal ${qIdx + 1}/${questions.length}`}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                            ✓ {correctNum} {t("filterCorrect")}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black">
                            ✗ {wrongNum} {t("filterWrong")}
                          </span>
                          {(player.tab_switches ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-700 text-[11px] font-black">
                              <ShieldAlert className="w-3 h-3" />
                              {lang === "EN"
                                ? `Left screen ${player.tab_switches}x`
                                : `Keluar layar ${player.tab_switches}x`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isTeacherLed && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(player.id);
                                setSelectedQuestionIdx(
                                  Math.min(
                                    qIdx,
                                    Math.max(0, questions.length - 1),
                                  ),
                                );
                                setActiveTab("QUESTIONS");
                              }}
                              className="px-2.5 py-1 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-700 text-[11px] font-black transition cursor-pointer"
                            >
                              {lang === "EN" ? "Live View →" : "Pantau Live →"}
                            </button>
                          )}

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
                          <span className="text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </span>
                        </div>
                      </div>

                      {!isTeacherLed && (
                        <p className="text-xs font-semibold text-slate-500 mb-2">
                          {player.is_finished ? (
                            wrongQuestions.length > 0 ? (
                              <span className="text-rose-600 font-bold">
                                {lang === "EN"
                                  ? "Incorrect on questions: "
                                  : "Salah pada soal nomor: "}
                                {wrongQuestions
                                  .map((w) => `#${w.question_index + 1}`)
                                  .join(", ")}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">
                                {lang === "EN"
                                  ? "🌟 Perfect! Answered all questions correctly."
                                  : "🌟 Sempurna! Menjawab semua soal dengan benar."}
                              </span>
                            )
                          ) : activeQuestionObj ? (
                            <>
                              {lang === "EN"
                                ? "Currently solving: "
                                : "Sedang mengerjakan: "}
                              <FormattedText
                                text={activeQuestionObj.question_text}
                                className="font-bold text-slate-700"
                              />
                            </>
                          ) : lang === "EN" ? (
                            "Loading question..."
                          ) : (
                            "Memuat soal..."
                          )}
                        </p>
                      )}

                      <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${barWidth}%` }}
                          className="h-full bg-gradient-to-r from-[#3B9EFF] to-[#22C55E] rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 bg-white">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
                        {lang === "EN"
                          ? `Answer History for ${player.nickname} (${ansList.length}/${questions.length} answered)`
                          : `Riwayat Jawaban ${player.nickname} (${ansList.length}/${questions.length} dijawab)`}
                      </p>

                      {ansList.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400">
                          {lang === "EN"
                            ? "Student has not completed any question yet."
                            : "Siswa belum menyelesaikan soal."}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {ansList.map((ans) => {
                            const qObj = questions[ans.question_index];
                            if (!qObj) return null;
                            const optsMap: Record<OptionKey, string> = {
                              A: qObj.option_a,
                              B: qObj.option_b,
                              C: qObj.option_c,
                              D: qObj.option_d,
                            };
                            const validKeys =
                              Array.isArray(qObj.correct_options) &&
                              qObj.correct_options.length > 0
                                ? qObj.correct_options
                                : [qObj.correct_option];

                            return (
                              <div
                                key={`${player.id}-${ans.question_id}-${ans.question_index}`}
                                className={`p-3 rounded-2xl border-2 text-xs ${
                                  ans.is_correct
                                    ? "bg-emerald-50/70 border-emerald-200"
                                    : "bg-rose-50/70 border-rose-200"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-black text-slate-800">
                                    {lang === "EN"
                                      ? `Question #${ans.question_index + 1}`
                                      : `Soal #${ans.question_index + 1}`}
                                  </span>
                                  <span
                                    className={`font-black px-2 py-0.5 rounded-full text-[10px] ${
                                      ans.is_correct
                                        ? "bg-emerald-500 text-white"
                                        : "bg-rose-500 text-white"
                                    }`}
                                  >
                                    {ans.is_correct
                                      ? `✓ ${t("filterCorrect")}`
                                      : `✗ ${t("filterWrong")}`}
                                  </span>
                                </div>
                                <p className="font-bold text-slate-700 mb-1.5 whitespace-normal break-words">
                                  <FormattedText text={qObj.question_text} />
                                </p>
                                <p className="text-[11px] font-semibold text-slate-600 whitespace-normal break-words">
                                  {lang === "EN"
                                    ? "Student answer: "
                                    : "Jawaban siswa: "}
                                  <strong>
                                    {ans.selected_option ? (
                                      <>
                                        {ans.selected_option}.{" "}
                                        <FormattedText
                                          text={optsMap[ans.selected_option]}
                                        />
                                      </>
                                    ) : lang === "EN" ? (
                                      "Time Expired"
                                    ) : (
                                      "Waktu Habis"
                                    )}
                                  </strong>
                                </p>
                                {!ans.is_correct && (
                                  <p className="text-[11px] font-extrabold text-emerald-700 mt-0.5 whitespace-normal break-words">
                                    {lang === "EN"
                                      ? "Correct key: "
                                      : "Kunci benar: "}
                                    {validKeys.map((k, i) => (
                                      <span key={k}>
                                        {i > 0 && " / "}
                                        {k}. <FormattedText text={optsMap[k]} />
                                      </span>
                                    ))}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ==================== PANEL TAB 2: ANALISIS PER SOAL (STUDENT-PACED & POST-GAME) ====================
  const renderQuestionsAnalyticsPanel = () => {
    const inspectedQuestion = questions[selectedQuestionIdx] || questions[0];
    if (!inspectedQuestion) return null;

    const optsMap: Record<OptionKey, string> = {
      A: inspectedQuestion.option_a,
      B: inspectedQuestion.option_b,
      C: inspectedQuestion.option_c,
      D: inspectedQuestion.option_d,
    };

    const validCorrectKeys: OptionKey[] =
      Array.isArray(inspectedQuestion.correct_options) &&
      inspectedQuestion.correct_options.length > 0
        ? inspectedQuestion.correct_options
        : [inspectedQuestion.correct_option];

    const pieceMeta =
      PIECE_META[inspectedQuestion.piece_type] || PIECE_META.KNIGHT;
    const localizedPiece =
      PIECE_META_I18N?.[lang]?.[inspectedQuestion.piece_type] || pieceMeta;

    const focusedStudent =
      selectedStudentId === "ALL"
        ? null
        : players.find((p) => p.id === selectedStudentId) || null;

    const focusedStudentAnswers = focusedStudent
      ? parsePlayerAnswers(focusedStudent.answers)
      : [];

    const focusedStudentAnswerOnThisQ = focusedStudent
      ? findAnswerForQuestion(
          focusedStudentAnswers,
          inspectedQuestion.id,
          selectedQuestionIdx,
        )
      : undefined;

    const focusedStudentCurrentQ = focusedStudent
      ? (focusedStudent.current_question_index ?? 0)
      : 0;

    const allAnswersForThisQ = players
      .map((p) => {
        const ans = findAnswerForQuestion(
          parsePlayerAnswers(p.answers),
          inspectedQuestion.id,
          selectedQuestionIdx,
        );
        return ans ? { player: p, answer: ans } : null;
      })
      .filter(
        (item): item is { player: PlayerRow; answer: StoredAnswer } =>
          item !== null,
      );

    const studentsCurrentlyWorkingHere = players.filter(
      (p) =>
        !p.is_finished &&
        (p.current_question_index ?? 0) === selectedQuestionIdx,
    );

    const qCorrectCount = allAnswersForThisQ.filter(
      (a) => a.answer.is_correct,
    ).length;
    const qWrongCount = allAnswersForThisQ.filter(
      (a) => !a.answer.is_correct,
    ).length;
    const correctRatio =
      allAnswersForThisQ.length > 0
        ? Math.round((qCorrectCount / allAnswersForThisQ.length) * 100)
        : 0;

    return (
      <div className="bg-white p-5 sm:p-7 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-sm flex flex-col gap-5">
        <div className="bg-[#F8FBFF] p-3.5 rounded-2xl border-2 border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              {lang === "EN"
                ? "Select Student to Monitor Live:"
                : "Pilih Siswa untuk Dipantau Live:"}
            </span>

            {focusedStudent && !focusedStudent.is_finished && (
              <button
                type="button"
                onClick={() =>
                  setSelectedQuestionIdx(
                    Math.min(
                      focusedStudentCurrentQ,
                      Math.max(0, questions.length - 1),
                    ),
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-700 text-xs font-black transition cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {lang === "EN"
                  ? `Follow ${focusedStudent.nickname} (Q #${focusedStudentCurrentQ + 1})`
                  : `Ikuti Posisi ${focusedStudent.nickname} (Soal #${focusedStudentCurrentQ + 1})`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedStudentId("ALL")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black border-2 shrink-0 transition cursor-pointer ${
                selectedStudentId === "ALL"
                  ? "bg-[#2B90FF] text-white border-[#1D7AFC] shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-sky-50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                {lang === "EN"
                  ? `All Students (${players.length})`
                  : `Semua Siswa (${players.length})`}
              </span>
            </button>

            {players.map((p) => {
              const pMeta = PIECE_META[p.piece_skin] || PIECE_META.KNIGHT;
              const isSelected = selectedStudentId === p.id;
              const pQIdx = p.current_question_index ?? 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(p.id);
                    setSelectedQuestionIdx(
                      Math.min(pQIdx, Math.max(0, questions.length - 1)),
                    );
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black border-2 shrink-0 transition cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50"
                  }`}
                >
                  <span className="text-base leading-none">{pMeta.symbol}</span>
                  <span>{p.nickname}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                      p.is_finished
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isSelected
                          ? "bg-sky-500 text-white"
                          : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {p.is_finished
                      ? lang === "EN"
                        ? "Done"
                        : "Selesai"
                      : `#${pQIdx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {lang === "EN"
                ? `Select Question Number (${questions.length} Questions)`
                : `Pilih Nomor Soal (${questions.length} Soal)`}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {questions.map((q, idx) => {
              const isSelected = idx === selectedQuestionIdx;

              let btnStyle =
                "bg-[#F2F7FC] text-slate-600 border-slate-200 hover:bg-sky-50";
              let statusDot: React.ReactNode = null;

              if (focusedStudent) {
                const ans = findAnswerForQuestion(
                  focusedStudentAnswers,
                  q.id,
                  idx,
                );
                const isWorkingHere =
                  !focusedStudent.is_finished && focusedStudentCurrentQ === idx;

                if (ans) {
                  btnStyle = ans.is_correct
                    ? "bg-emerald-50 text-emerald-800 border-emerald-400"
                    : "bg-rose-50 text-rose-800 border-rose-400";
                } else if (isWorkingHere) {
                  btnStyle =
                    "bg-sky-50 text-sky-800 border-sky-400 ring-2 ring-sky-300";
                  statusDot = (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                  );
                }
              }

              if (isSelected) {
                btnStyle =
                  "bg-[#2B90FF] text-white border-[#1D7AFC] shadow-sm scale-105";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuestionIdx(idx)}
                  className={`relative w-10 h-10 rounded-xl font-black text-sm shrink-0 border-2 transition cursor-pointer ${btnStyle}`}
                >
                  {idx + 1}
                  {statusDot}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-black">
              {lang === "EN"
                ? `Question #${selectedQuestionIdx + 1}`
                : `Soal #${selectedQuestionIdx + 1}`}
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
              {pieceMeta.symbol} {localizedPiece.name}
            </span>
          </div>

          {focusedStudent ? (
            <div>
              {focusedStudentAnswerOnThisQ ? (
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black ${
                    focusedStudentAnswerOnThisQ.is_correct
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {focusedStudentAnswerOnThisQ.is_correct ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {lang === "EN"
                        ? `${focusedStudent.nickname} answered ${focusedStudentAnswerOnThisQ.selected_option} (Correct)`
                        : `${focusedStudent.nickname} menjawab ${focusedStudentAnswerOnThisQ.selected_option} (Benar)`}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      {lang === "EN"
                        ? `${focusedStudent.nickname} answered ${
                            focusedStudentAnswerOnThisQ.selected_option ||
                            "Time Expired"
                          } (Incorrect)`
                        : `${focusedStudent.nickname} menjawab ${
                            focusedStudentAnswerOnThisQ.selected_option ||
                            "Waktu Habis"
                          } (Salah)`}
                    </>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                  {lang === "EN"
                    ? `${focusedStudent.nickname} has not answered this question yet`
                    : `${focusedStudent.nickname} belum menjawab soal ini`}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[#F8FBFF] px-4 py-2 rounded-2xl border border-slate-200">
              <div className="w-24 h-2.5 bg-rose-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${correctRatio}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-700">
                <span className="text-emerald-600">
                  {qCorrectCount} {lang === "EN" ? "correct" : "benar"}
                </span>
                ,{" "}
                <span className="text-rose-600">
                  {qWrongCount} {lang === "EN" ? "incorrect" : "salah"}
                </span>
              </span>
            </div>
          )}
        </div>

        {!focusedStudent && studentsCurrentlyWorkingHere.length > 0 && (
          <div className="px-4 py-2.5 rounded-2xl bg-sky-50 border border-sky-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-black text-sky-700 animate-pulse">
              {lang === "EN"
                ? "● Currently solving this question:"
                : "● Sedang mengerjakan soal ini:"}
            </span>
            {studentsCurrentlyWorkingHere.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStudentId(s.id)}
                className="px-2.5 py-0.5 rounded-full bg-white border border-sky-300 text-sky-800 font-extrabold hover:bg-sky-100 cursor-pointer"
              >
                {s.nickname}
              </button>
            ))}
          </div>
        )}

        <div>
          {inspectedQuestion.image_url && (
            <img
              src={inspectedQuestion.image_url}
              alt="Question"
              className="max-h-52 rounded-2xl mb-3 object-contain border border-slate-200 bg-slate-50"
            />
          )}
          <h3 className="text-lg sm:text-xl font-black text-slate-800 leading-snug">
            {selectedQuestionIdx + 1}.{" "}
            <FormattedText text={inspectedQuestion.question_text} />
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
            const isCorrect = validCorrectKeys.includes(key);
            const style = OPTION_STYLES[key];

            const pickers = allAnswersForThisQ.filter(
              (item) => item.answer.selected_option === key,
            );

            const isPickedByFocusedStudent =
              focusedStudent &&
              focusedStudentAnswerOnThisQ?.selected_option === key;

            let cardStyle = "bg-[#F8FBFF] border-slate-200";
            if (isCorrect) {
              cardStyle = "bg-emerald-50/80 border-emerald-400";
            } else if (isPickedByFocusedStudent) {
              cardStyle = "bg-rose-50/90 border-rose-400";
            }

            return (
              <div
                key={key}
                className={`p-4 rounded-2xl border-2 transition ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-xl ${style.badgeBg} text-white font-black text-sm flex items-center justify-center shrink-0`}
                    >
                      {key}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-800 whitespace-normal break-words leading-snug pt-1">
                      <FormattedText text={optsMap[key]} />
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                    {isPickedByFocusedStudent && focusedStudent && (
                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-full text-white ${
                          isCorrect ? "bg-sky-600" : "bg-rose-500"
                        }`}
                      >
                        {lang === "EN"
                          ? `${focusedStudent.nickname}'s Choice`
                          : `Pilihan ${focusedStudent.nickname}`}
                      </span>
                    )}
                    {isCorrect && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500 text-white">
                        {lang === "EN" ? "✓ Correct Answer" : "✓ Kunci Jawaban"}
                      </span>
                    )}
                    {!focusedStudent && (
                      <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-600">
                        {pickers.length} {lang === "EN" ? "students" : "siswa"}
                      </span>
                    )}
                  </div>
                </div>

                {!focusedStudent && pickers.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-wrap gap-1.5">
                    {pickers.map(({ player: p }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedStudentId(p.id)}
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full cursor-pointer transition ${
                          isCorrect
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                        }`}
                      >
                        {p.nickname}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
                {quizTitle} • {questions.length} {t("questionsCount")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Tombol Mute / Unmute Audio */}
            <button
              type="button"
              onClick={handleToggleHostMusic}
              title={
                isMuted
                  ? lang === "EN"
                    ? "Turn On Classroom Audio"
                    : "Nyalakan Suara & Musik"
                  : lang === "EN"
                    ? "Mute Audio"
                    : "Matikan Suara (Mute)"
              }
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border-2 font-black text-xs sm:text-sm transition cursor-pointer ${
                isMuted
                  ? "bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("musicMuted")}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("musicOn")}</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-50 border-2 border-sky-200 text-[#1E82F5] font-black text-sm">
              <Users className="w-4 h-4" />
              <span>
                {players.length} {lang === "EN" ? "Players" : "Pemain"}
              </span>
            </div>

            {room.status === "playing" && (
              <button
                type="button"
                onClick={() => handleFinishSession(allStudentsFinished)}
                disabled={updating}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm border-b-4 transition cursor-pointer ${
                  allStudentsFinished && !isTeacherLed
                    ? "bg-[#22C55E] hover:bg-[#1EB054] text-white border-[#15803D] shadow-md"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>
                  {allStudentsFinished && !isTeacherLed
                    ? t("openPodiumBtn")
                    : t("endSessionBtn")}
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
                {isTeacherLed ? (
                  <>
                    <Presentation className="w-3.5 h-3.5 text-amber-300" />
                    <span>Teacher-Led (Share Screen)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Student-Paced Arena</span>
                  </>
                )}
              </span>
              <p className="text-sm font-bold text-sky-100">
                {lang === "EN"
                  ? "Open the main page and enter PIN:"
                  : "Buka halaman utama lalu masukkan PIN:"}
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
                  {copied
                    ? lang === "EN"
                      ? "Invite Link Copied!"
                      : "Link Undangan Tersalin!"
                    : lang === "EN"
                      ? "Copy Student Join Link"
                      : "Salin Link Join Siswa"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartGame}
                disabled={updating || players.length === 0}
                className="w-full py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-lg flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-lg transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>
                  {t("startGameBtn")} ({players.length})
                </span>
              </button>
            </div>

            <div className="lg:col-span-7 bg-white p-6 rounded-[32px] border-2 border-slate-200/90 border-b-[6px] min-h-[360px]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black text-slate-800">
                  {t("waitingRoomTitle")}
                </h2>
                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-pulse">
                  {lang === "EN"
                    ? "● Waiting for players..."
                    : "● Menunggu pemain..."}
                </span>
              </div>

              {players.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="text-5xl mb-3">🦉</div>
                  <p className="font-extrabold text-base text-slate-600">
                    {lang === "EN"
                      ? "No students have joined yet"
                      : "Belum ada siswa yang masuk"}
                  </p>
                  <p className="text-xs font-medium mt-1">
                    {lang === "EN" ? (
                      <>
                        Share PIN code <strong>{room.pin_code}</strong> with
                        students to join.
                      </>
                    ) : (
                      <>
                        Bagikan kode PIN <strong>{room.pin_code}</strong> kepada
                        siswa untuk mulai bergabung.
                      </>
                    )}
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

        {/* ==================== STATE 2: LIVE MONITOR ==================== */}
        {room.status === "playing" && (
          <div className="flex flex-col gap-5">
            {sessionSettings.anti_cheating &&
              players.some((p) => (p.tab_switches ?? 0) > 0) && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                    <span>
                      {lang === "EN"
                        ? "Anti-Cheating Alert: Students detected leaving the quiz screen:"
                        : "Peringatan Anti-Cheating: Siswa terdeteksi meninggalkan layar kuis:"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {players
                      .filter((p) => (p.tab_switches ?? 0) > 0)
                      .map((p) => (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black"
                        >
                          {p.nickname} ({p.tab_switches}x)
                        </span>
                      ))}
                  </div>
                </div>
              )}
            {isTeacherLed ? (
              activeTab === "LEADERBOARD" ? (
                renderLeaderboardPanel()
              ) : (
                renderTeacherLedStage()
              )
            ) : (
              <>
                <div className="bg-white p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs animate-pulse">
                        {lang === "EN"
                          ? "● Self-Paced Live Session"
                          : "● Sesi Berlangsung Mandiri"}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 font-black text-xs">
                        {finishedCount}/{players.length}{" "}
                        {lang === "EN" ? "Completed" : "Siswa Selesai"}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-800">
                      {t("liveMonitorTitle")}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#F2F7FC] p-1.5 rounded-2xl border-2 border-slate-200 self-start">
                    <button
                      type="button"
                      onClick={() => setActiveTab("LEADERBOARD")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                        activeTab === "LEADERBOARD"
                          ? "bg-[#2B90FF] text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Trophy className="w-4 h-4" />
                      <span>{t("tabLeaderboard")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("QUESTIONS")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                        activeTab === "QUESTIONS"
                          ? "bg-[#2B90FF] text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ListChecks className="w-4 h-4" />
                      <span>{t("tabQuestions")}</span>
                    </button>
                  </div>
                </div>

                {activeTab === "LEADERBOARD"
                  ? renderLeaderboardPanel()
                  : renderQuestionsAnalyticsPanel()}
              </>
            )}
          </div>
        )}

        {/* ==================== STATE 3: PODIUM, HASIL TIAP SISWA & ANALISIS SOAL ==================== */}
        {room.status === "finished" && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="bg-white p-8 rounded-[32px] border-2 border-slate-200 border-b-8 text-center shadow-lg">
              <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] flex items-center justify-center border-b-4 border-[#CC8E00] shadow-md">
                <Trophy className="w-10 h-10 text-amber-950" />
              </div>
              <h2 className="text-3xl font-black text-slate-800">
                {t("podiumTitle")} 🎉
              </h2>
              <p className="text-sm font-bold text-slate-400 mt-1 mb-8">
                {quizTitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-end">
                {sortedPlayers.slice(0, 3).map((p, idx) => {
                  const meta = PIECE_META[p.piece_skin] || PIECE_META.KNIGHT;
                  const ansList = parsePlayerAnswers(p.answers);
                  const cCount =
                    p.correct_count ??
                    ansList.filter((a) => a.is_correct).length;
                  const wCount =
                    p.wrong_count ??
                    ansList.filter((a) => !a.is_correct).length;

                  const badge =
                    idx === 0
                      ? lang === "EN"
                        ? "🥇 1st Place"
                        : "🥇 Juara 1"
                      : idx === 1
                        ? lang === "EN"
                          ? "🥈 2nd Place"
                          : "🥈 Juara 2"
                        : lang === "EN"
                          ? "🥉 3rd Place"
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
                      <p className="font-black text-lg text-slate-800">
                        {p.nickname}
                      </p>
                      <p className="font-black text-xl text-[#1E82F5] mt-1 flex items-center gap-1">
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        {p.score}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-black">
                        <span className="text-emerald-600">
                          ✓ {cCount} {t("filterCorrect")}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-600">
                          ✗ {wCount} {t("filterWrong")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-base border-b-4 border-[#1359B8] transition"
              >
                <Home className="w-5 h-5" /> {t("backToLibraryBtn")}
              </Link>
            </div>

            <div className="flex items-center justify-center gap-2 bg-white p-2 rounded-2xl border-2 border-slate-200 self-center">
              <button
                type="button"
                onClick={() => setActiveTab("LEADERBOARD")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition cursor-pointer ${
                  activeTab === "LEADERBOARD"
                    ? "bg-[#2B90FF] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>
                  {lang === "EN" ? "Student Results" : "Hasil Tiap Siswa"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("QUESTIONS")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition cursor-pointer ${
                  activeTab === "QUESTIONS"
                    ? "bg-[#2B90FF] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {lang === "EN" ? "Question Analysis" : "Analisis Per Soal"}
                </span>
              </button>
            </div>

            {activeTab === "LEADERBOARD"
              ? renderLeaderboardPanel()
              : renderQuestionsAnalyticsPanel()}
          </div>
        )}
      </div>
    </main>
  );
}
