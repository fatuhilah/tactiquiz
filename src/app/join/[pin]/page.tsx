"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  LogOut,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Presentation,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import {
  QuestionData,
  OptionKey,
  PieceType,
  PIECE_META,
  OPTION_STYLES,
} from "@/components/ChessQuizBoard";
import TactiBoardDispatcher from "@/components/boards/TactiBoardDispatcher";
import FormattedText from "@/components/FormattedText";
import { useLanguage } from "@/components/LanguageProvider";
import { GAME_MODES_META, resolveConcreteGameMode } from "@/lib/gameModes";
import { PIECE_META_I18N } from "@/lib/i18n";
import {
  HostingMode,
  RoomSessionSettings,
  DEFAULT_SESSION_SETTINGS,
  parseSessionSettings,
} from "@/lib/sessionSettings";
import { supabase } from "@/lib/supabase";
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

export interface StoredAnswer {
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
  answers?: StoredAnswer[];
  current_question_index?: number;
  is_finished?: boolean;
}

interface ExtendedQuestionData extends QuestionData {
  originalIndex: number;
  optionKeyMap: Record<OptionKey, OptionKey>; // displayedKey -> originalKey
}

interface AnswerRecord {
  question: ExtendedQuestionData;
  questionIndex: number;
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

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

function parseOptionKeys(
  rawList: unknown,
  fallbackSingle?: unknown,
): OptionKey[] {
  const validSet = new Set<OptionKey>(["A", "B", "C", "D"]);
  let candidates: unknown[] = [];

  if (Array.isArray(rawList)) {
    candidates = rawList;
  } else if (typeof rawList === "string" && rawList.trim()) {
    const trimmed = rawList.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) candidates = parsed;
      } catch {
        // abaikan error parse
      }
    } else {
      candidates = trimmed.replace(/[{}"]/g, "").split(",");
    }
  }

  if (candidates.length === 0 && typeof fallbackSingle === "string") {
    candidates = fallbackSingle.replace(/[{}"]/g, "").split(",");
  }

  const normalized = candidates
    .map((item) => String(item).trim().toUpperCase() as OptionKey)
    .filter((k) => validSet.has(k));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["A"];
}

export default function PlayerJoinAndPlayPage() {
  const params = useParams();
  const router = useRouter();
  const pin = params.pin as string;
  const { lang, t } = useLanguage();

  const playerStorageKey = `tactiquiz_player_${pin}`;
  const timerStorageKey = `tactiquiz_timer_${pin}`;
  const powerupStorageKey = `tactiquiz_powerups_${pin}`;
  const cheatStorageKey = `tactiquiz_cheats_${pin}`;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [sessionSettings, setSessionSettings] = useState<RoomSessionSettings>({
    ...DEFAULT_SESSION_SETTINGS,
  });
  const [questions, setQuestions] = useState<ExtendedQuestionData[]>([]);
  const [timerMode, setTimerMode] = useState<"PER_QUESTION" | "TOTAL_QUIZ">(
    "PER_QUESTION",
  );
  const [totalQuizSeconds, setTotalQuizSeconds] = useState<number>(300);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<PieceType>("KNIGHT");
  const [joining, setJoining] = useState(false);

  const [localQIndex, setLocalQIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [maxCurrentTime, setMaxCurrentTime] = useState<number>(60);
  const [feedback, setFeedback] = useState<
    "CORRECT" | "WRONG" | "TIMEOUT" | null
  >(null);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);

  // Redemption queue (khusus Student-Paced jika redemption_questions aktif)
  const [redemptionQueue, setRedemptionQueue] = useState<number[]>([]);
  const [isRedemptionRound, setIsRedemptionRound] = useState(false);
  const [hasCompletedRedemption, setHasCompletedRedemption] = useState(false);

  const [isSelfFinished, setIsSelfFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PlayerRow[]>([]);
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "WRONG" | "CORRECT">(
    "ALL",
  );

  // Power-Up State (Hanya Student-Paced & Maksimal 1x per Sesi)
  const [eliminatedOptions, setEliminatedOptions] = useState<OptionKey[]>([]);
  const [queenOverride, setQueenOverride] = useState(false);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedQueenBoost, setUsedQueenBoost] = useState(false);

  // Anti-cheating warning count (persisten terhadap refresh browser)
  const [tabWarningCount, setTabWarningCount] = useState<number>(0);
  const tabWarningRef = useRef<number>(0);

  // State Zoom Gambar
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const isTeacherLed = room?.hosting_mode === "TEACHER_LED";
  const canUsePowerUps = !isTeacherLed && sessionSettings.enable_powerups;

  const openImageZoom = (url: string) => {
    setZoomScale(1);
    setZoomedImageUrl(url);
  };

  useEffect(() => {
    if (!zoomedImageUrl) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedImageUrl(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [zoomedImageUrl]);

  // Anti-cheating listeners (tab switch, right-click, copy-paste) dengan penyimpanan persisten
  useEffect(() => {
    if (!player?.id || room?.status !== "playing" || isSelfFinished) return;

    const handleVisibilityChange = () => {
      if (document.hidden && sessionSettings.anti_cheating) {
        const nextCount = tabWarningRef.current + 1;
        tabWarningRef.current = nextCount;
        setTabWarningCount(nextCount);

        // Simpan instan ke localStorage agar kebal terhadap F5 / refresh cepat
        try {
          localStorage.setItem(cheatStorageKey, String(nextCount));
        } catch {
          // abaikan jika storage diblokir
        }

        // Kirim real-time ke panel Host
        supabase
          .from("players")
          .update({ tab_switches: nextCount })
          .eq("id", player.id)
          .then(({ error }) => {
            if (error) {
              console.error(
                "Gagal sinkronisasi pelanggaran tab:",
                error.message,
              );
            }
          });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (
        sessionSettings.anti_cheating &&
        sessionSettings.disable_right_click
      ) {
        e.preventDefault();
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      if (sessionSettings.anti_cheating && sessionSettings.disable_copy_paste) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, [
    player?.id,
    room?.status,
    isSelfFinished,
    sessionSettings,
    cheatStorageKey,
  ]);

  const renderImageZoomModal = () => {
    if (!zoomedImageUrl) return null;

    return (
      <div
        onClick={() => setZoomedImageUrl(null)}
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-3 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 shadow-lg border border-slate-200"
        >
          <button
            type="button"
            onClick={() =>
              setZoomScale((s) => Math.max(0.75, Number((s - 0.25).toFixed(2))))
            }
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-slate-700 min-w-[3.2rem] text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setZoomScale((s) => Math.min(3, Number((s + 0.25).toFixed(2))))
            }
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomScale(1)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={() => setZoomedImageUrl(null)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{lang === "EN" ? "Close" : "Tutup"}</span>
          </button>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-[94vw] max-h-[80vh] overflow-auto rounded-2xl bg-white p-3 shadow-2xl flex items-center justify-center"
        >
          <img
            src={zoomedImageUrl}
            alt="Zoomed Question"
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: "center center",
            }}
            className="max-h-[74vh] w-auto object-contain transition-transform duration-150"
          />
        </div>
      </div>
    );
  };

  // Musik latar
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
      .select(
        "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
      )
      .eq("id", roomId)
      .single();

    if (data) {
      const typed = data as RoomData;
      setSessionSettings(parseSessionSettings(typed.settings));
      setRoom((prev) => {
        if (
          prev &&
          prev.status === typed.status &&
          prev.current_question_index === typed.current_question_index &&
          prev.reveal_answer === typed.reveal_answer &&
          prev.hosting_mode === typed.hosting_mode
        ) {
          return prev;
        }
        return typed;
      });
    }
  }, []);

  // Init Room & Questions
  useEffect(() => {
    async function initPlayerRoom() {
      const { data: roomData, error } = await supabase
        .from("rooms")
        .select(
          "id, pin_code, quiz_id, status, hosting_mode, current_question_index, reveal_answer, settings",
        )
        .eq("pin_code", pin)
        .single();

      if (error || !roomData) {
        alert(
          lang === "EN"
            ? "PIN code not found or the session has ended!"
            : "Kode PIN tidak ditemukan atau sesi sudah berakhir!",
        );
        router.push("/");
        return;
      }

      const typedRoom = roomData as RoomData;
      const parsedSettings = parseSessionSettings(typedRoom.settings);
      setRoom(typedRoom);
      setSessionSettings(parsedSettings);

      // Pulihkan status pemakaian Power-Up (maksimal 1x per sesi, tahan refresh)
      try {
        const rawPowerups = localStorage.getItem(powerupStorageKey);
        if (rawPowerups) {
          const pState = JSON.parse(rawPowerups) as {
            usedFiftyFifty?: boolean;
            usedQueenBoost?: boolean;
          };
          if (pState.usedFiftyFifty) setUsedFiftyFifty(true);
          if (pState.usedQueenBoost) setUsedQueenBoost(true);
        }
      } catch {
        // abaikan error parse
      }

      const [{ data: quizInfo }, { data: qRows }] = await Promise.all([
        supabase
          .from("quizzes")
          .select("timer_mode, total_time_seconds")
          .eq("id", typedRoom.quiz_id)
          .single(),
        supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", typedRoom.quiz_id)
          .order("order_index", { ascending: true }),
      ]);

      const mode =
        (quizInfo?.timer_mode as "PER_QUESTION" | "TOTAL_QUIZ") ||
        "PER_QUESTION";
      const totalSec = quizInfo?.total_time_seconds || 300;
      setTimerMode(mode);
      setTotalQuizSeconds(totalSec);

      const isStudentPaced = typedRoom.hosting_mode !== "TEACHER_LED";

      let mapped: ExtendedQuestionData[] = [];
      if (qRows && qRows.length > 0) {
        mapped = qRows.map((row, idx) => {
          const origOptions: Record<OptionKey, string> = {
            A: row.option_a,
            B: row.option_b,
            C: row.option_c,
            D: row.option_d,
          };

          const origCorrect: OptionKey[] = parseOptionKeys(
            row.correct_options,
            row.correct_option,
          );
          const isAllowMultiple =
            row.allow_multiple === true ||
            String(row.allow_multiple) === "true" ||
            Number(row.allow_multiple) === 1 ||
            origCorrect.length > 1;

          const keys: OptionKey[] = ["A", "B", "C", "D"];
          const arrangedKeys: OptionKey[] =
            isStudentPaced && parsedSettings.shuffle_answers
              ? [...keys].sort(() => Math.random() - 0.5)
              : keys;

          const finalOptions = {} as Record<OptionKey, string>;
          const optionKeyMap = {} as Record<OptionKey, OptionKey>;
          const remappedCorrect: OptionKey[] = [];

          keys.forEach((displayKey, pos) => {
            const sourceKey = arrangedKeys[pos];
            finalOptions[displayKey] = origOptions[sourceKey];
            optionKeyMap[displayKey] = sourceKey;
            if (origCorrect.includes(sourceKey)) {
              remappedCorrect.push(displayKey);
            }
          });

          return {
            id: row.id,
            originalIndex: idx,
            question_text: row.question_text,
            image_url: row.image_url || null,
            options: finalOptions,
            optionKeyMap,
            correct_option: remappedCorrect[0] || "A",
            correct_options: remappedCorrect,
            allow_multiple: isAllowMultiple,
            time_limit: row.time_limit || 60,
            piece_type: (row.piece_type || "KNIGHT") as PieceType,
            obstacles: row.obstacles ?? 3,
          };
        });

        if (isStudentPaced && parsedSettings.shuffle_questions) {
          mapped = [...mapped].sort(() => Math.random() - 0.5);
        }

        setQuestions(mapped);
      }

      const savedPlayerId =
        typeof window !== "undefined"
          ? localStorage.getItem(playerStorageKey)
          : null;

      if (savedPlayerId) {
        const { data: existingPlayer } = await supabase
          .from("players")
          .select("*")
          .eq("id", savedPlayerId)
          .eq("room_id", typedRoom.id)
          .single();

        if (existingPlayer) {
          const typedPlayer = existingPlayer as PlayerRow;
          setPlayer(typedPlayer);

          // Pulihkan & rekonsiliasi jumlah pelanggaran tab (tahan F5 / refresh)
          const dbViolations = Number(typedPlayer.tab_switches ?? 0);
          let localViolations = 0;
          try {
            localViolations = Number(
              localStorage.getItem(cheatStorageKey) || "0",
            );
          } catch {
            // abaikan error storage
          }

          const reconciledViolations = Math.max(dbViolations, localViolations);
          tabWarningRef.current = reconciledViolations;
          setTabWarningCount(reconciledViolations);

          try {
            localStorage.setItem(cheatStorageKey, String(reconciledViolations));
          } catch {
            // abaikan
          }

          if (reconciledViolations > dbViolations) {
            await supabase
              .from("players")
              .update({ tab_switches: reconciledViolations })
              .eq("id", typedPlayer.id);
          }

          const savedQIdx = isStudentPaced
            ? Math.min(
                typedPlayer.current_question_index ?? 0,
                Math.max(0, mapped.length - 1),
              )
            : Math.min(
                typedRoom.current_question_index ?? 0,
                Math.max(0, mapped.length - 1),
              );

          setLocalQIndex(savedQIdx);
          setIsSelfFinished(Boolean(typedPlayer.is_finished));

          const rawAnswers: StoredAnswer[] = Array.isArray(typedPlayer.answers)
            ? typedPlayer.answers
            : typeof typedPlayer.answers === "string"
              ? (() => {
                  try {
                    return JSON.parse(typedPlayer.answers);
                  } catch {
                    return [];
                  }
                })()
              : [];

          const restoredHistory: AnswerRecord[] = rawAnswers
            .map((ans) => {
              const qObj =
                mapped.find((q) => q.id === ans.question_id) ||
                mapped[ans.question_index];
              if (!qObj) return null;
              return {
                question: qObj,
                questionIndex: ans.question_index,
                selectedOption: ans.selected_option,
                isCorrect: ans.is_correct,
              };
            })
            .filter((item): item is AnswerRecord => item !== null);
          setAnswerHistory(restoredHistory);

          if (!isStudentPaced) {
            const alreadyAnsweredActive = restoredHistory.some(
              (rec) => rec.question.originalIndex === savedQIdx,
            );
            setHasAnsweredCurrent(alreadyAnsweredActive);
          }

          const defaultDuration =
            mode === "TOTAL_QUIZ"
              ? totalSec
              : mapped[savedQIdx]?.time_limit || 60;
          let restoredTime = defaultDuration;

          try {
            const rawTimer = localStorage.getItem(timerStorageKey);
            if (rawTimer) {
              const parsed = JSON.parse(rawTimer) as {
                qIndex: number;
                timeLeft: number;
              };
              if (
                parsed.timeLeft > 0 &&
                (mode === "TOTAL_QUIZ" || parsed.qIndex === savedQIdx)
              ) {
                restoredTime = Math.min(defaultDuration, parsed.timeLeft);
              }
            }
          } catch {
            // abaikan
          }

          setTimeLeft(restoredTime);
          setMaxCurrentTime(defaultDuration);
          setLoading(false);
          return;
        } else {
          localStorage.removeItem(playerStorageKey);
          localStorage.removeItem(timerStorageKey);
          localStorage.removeItem(cheatStorageKey);
        }
      }

      if (mapped.length > 0) {
        const initialDuration =
          mode === "TOTAL_QUIZ" ? totalSec : mapped[0].time_limit || 60;
        setTimeLeft(initialDuration);
        setMaxCurrentTime(initialDuration);
      }

      setLoading(false);
    }

    initPlayerRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pin,
    router,
    playerStorageKey,
    timerStorageKey,
    powerupStorageKey,
    cheatStorageKey,
  ]);

  // Sinkronisasi Realtime perubahan Room (termasuk pindah soal & ganti mode pada Host)
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
          const updated = payload.new as RoomData;
          setRoom(updated);
          setSessionSettings(parseSessionSettings(updated.settings));
        },
      )
      .subscribe();

    const interval = setInterval(() => {
      syncRoomState(room.id);
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room?.id, syncRoomState]);

  const recordAndSyncAnswer = useCallback(
    async (
      currentQ: ExtendedQuestionData,
      selected: OptionKey | null,
      isCorrect: boolean,
      earnedPoints: number,
    ) => {
      if (!player) return;

      const newRecord: AnswerRecord = {
        question: currentQ,
        questionIndex: currentQ.originalIndex,
        selectedOption: selected,
        isCorrect,
      };

      // Jika redemption round, timpa record lama pada soal yang sama
      const existingIdx = answerHistory.findIndex(
        (item) => item.question.id === currentQ.id,
      );
      const nextHistory =
        existingIdx >= 0
          ? answerHistory.map((item, idx) =>
              idx === existingIdx ? newRecord : item,
            )
          : [...answerHistory, newRecord];

      setAnswerHistory(nextHistory);

      const nextScore = isCorrect ? player.score + earnedPoints : player.score;
      const nextStreak = isCorrect ? player.streak + 1 : 0;
      const nextCorrect = nextHistory.filter((a) => a.isCorrect).length;
      const nextWrong = nextHistory.filter((a) => !a.isCorrect).length;

      // Petakan kembali pilihan yang diacak ke huruf opsi asli agar sinkron dengan laporan guru
      const storedAnswers: StoredAnswer[] = nextHistory.map((item) => ({
        question_id: item.question.id,
        question_index: item.question.originalIndex,
        selected_option: item.selectedOption
          ? item.question.optionKeyMap[item.selectedOption] ||
            item.selectedOption
          : null,
        is_correct: item.isCorrect,
      }));

      setPlayer({
        ...player,
        score: nextScore,
        streak: nextStreak,
        correct_count: nextCorrect,
        wrong_count: nextWrong,
        tab_switches: tabWarningRef.current,
        answers: storedAnswers,
      });

      await supabase
        .from("players")
        .update({
          score: nextScore,
          streak: nextStreak,
          correct_count: nextCorrect,
          wrong_count: nextWrong,
          tab_switches: tabWarningRef.current,
          answers: storedAnswers,
        })
        .eq("id", player.id);
    },
    [player, answerHistory],
  );

  // Ikuti nomor soal aktif guru saat mode TEACHER_LED
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || questions.length === 0)
      return;

    const hostQIdx = Math.min(
      room.current_question_index ?? 0,
      Math.max(0, questions.length - 1),
    );

    if (hostQIdx !== localQIndex) {
      setLocalQIndex(hostQIdx);
      setFeedback(null);
      setLastPoints(null);
      setEliminatedOptions([]);
      setQueenOverride(false);
      setZoomedImageUrl(null);

      const alreadyAnswered = answerHistory.some(
        (rec) => rec.question.originalIndex === hostQIdx,
      );
      setHasAnsweredCurrent(alreadyAnswered);

      const nextLimit = questions[hostQIdx]?.time_limit || 60;
      setTimeLeft(nextLimit);
      setMaxCurrentTime(nextLimit);
    }
  }, [
    isTeacherLed,
    room?.status,
    room?.current_question_index,
    questions,
    localQIndex,
    answerHistory,
  ]);

  // Sinkronkan saat babak soal Teacher-Led berakhir (waktu habis / semua selesai)
  useEffect(() => {
    if (!isTeacherLed || room?.status !== "playing" || !room?.reveal_answer)
      return;
    if (hasAnsweredCurrent || !player) return;

    const currentQ = questions[localQIndex];
    if (!currentQ) return;

    setHasAnsweredCurrent(true);
    setFeedback("TIMEOUT");
    sound.playWrong();
    recordAndSyncAnswer(currentQ, null, false, 0);
  }, [
    isTeacherLed,
    room?.status,
    room?.reveal_answer,
    hasAnsweredCurrent,
    player,
    questions,
    localQIndex,
    recordAndSyncAnswer,
  ]);

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

  const finishStudentQuiz = useCallback(async () => {
    setIsSelfFinished(true);
    localStorage.removeItem(timerStorageKey);
    if (player?.id) {
      await supabase
        .from("players")
        .update({ is_finished: true })
        .eq("id", player.id);
    }
  }, [player?.id, timerStorageKey]);

  const goToNextQuestion = useCallback(async () => {
    // Pada mode Teacher-Led, perpindahan soal dikendalikan oleh guru
    if (isTeacherLed) return;

    setFeedback(null);
    setLastPoints(null);
    setEliminatedOptions([]);
    setQueenOverride(false);
    setHasAnsweredCurrent(false);
    setZoomedImageUrl(null);

    // Jika sedang dalam babak Redemption Questions
    if (isRedemptionRound) {
      const remainingQueue = redemptionQueue.slice(1);
      if (remainingQueue.length > 0) {
        const nextRedeemIdx = remainingQueue[0];
        setRedemptionQueue(remainingQueue);
        setLocalQIndex(nextRedeemIdx);
        const nextLimit = questions[nextRedeemIdx]?.time_limit || 60;
        setTimeLeft(nextLimit);
        setMaxCurrentTime(nextLimit);
      } else {
        setIsRedemptionRound(false);
        setHasCompletedRedemption(true);
        await finishStudentQuiz();
      }
      return;
    }

    if (localQIndex + 1 >= questions.length) {
      // Cek apakah Redemption Questions aktif & ada soal salah yang bisa diulang
      if (sessionSettings.redemption_questions && !hasCompletedRedemption) {
        const wrongIndices = answerHistory
          .map((rec, idx) => (!rec.isCorrect ? idx : -1))
          .filter((idx) => idx !== -1)
          .slice(0, 2);

        if (wrongIndices.length > 0) {
          setIsRedemptionRound(true);
          setRedemptionQueue(wrongIndices);
          setLocalQIndex(wrongIndices[0]);
          const redeemLimit = questions[wrongIndices[0]]?.time_limit || 60;
          setTimeLeft(redeemLimit);
          setMaxCurrentTime(redeemLimit);
          return;
        }
      }

      await finishStudentQuiz();
    } else {
      const nextIdx = localQIndex + 1;
      setLocalQIndex(nextIdx);
      if (timerMode === "PER_QUESTION") {
        const nextLimit = questions[nextIdx]?.time_limit || 60;
        setTimeLeft(nextLimit);
        setMaxCurrentTime(nextLimit);
        localStorage.setItem(
          timerStorageKey,
          JSON.stringify({ qIndex: nextIdx, timeLeft: nextLimit }),
        );
      }
      if (player?.id) {
        await supabase
          .from("players")
          .update({ current_question_index: nextIdx })
          .eq("id", player.id);
      }
    }
  }, [
    isTeacherLed,
    isRedemptionRound,
    redemptionQueue,
    localQIndex,
    questions,
    sessionSettings.redemption_questions,
    hasCompletedRedemption,
    answerHistory,
    finishStudentQuiz,
    timerMode,
    timerStorageKey,
    player?.id,
  ]);

  // Timer mundur (hanya jika Question Timer diaktifkan di pengaturan sesi)
  useEffect(() => {
    if (!sessionSettings.question_timer) return;
    if (!player || room?.status !== "playing" || isSelfFinished) return;
    if (timerMode === "PER_QUESTION" && hasAnsweredCurrent) return;

    const currentQ = questions[localQIndex];

    if (timeLeft <= 0) {
      sound.playWrong();
      localStorage.removeItem(timerStorageKey);

      if (timerMode === "TOTAL_QUIZ" && !isTeacherLed) {
        finishStudentQuiz();
        return;
      }

      setHasAnsweredCurrent(true);
      setFeedback("TIMEOUT");
      if (currentQ) {
        recordAndSyncAnswer(currentQ, null, false, 0).then(() => {
          if (!isTeacherLed) {
            setTimeout(goToNextQuestion, 1800);
          }
        });
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const nextVal = Math.max(0, Number((prev - 0.1).toFixed(1)));
        if (Math.abs(nextVal - Math.round(nextVal)) < 0.05) {
          localStorage.setItem(
            timerStorageKey,
            JSON.stringify({ qIndex: localQIndex, timeLeft: nextVal }),
          );
        }
        return nextVal;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [
    sessionSettings.question_timer,
    player,
    room?.status,
    localQIndex,
    hasAnsweredCurrent,
    timeLeft,
    questions,
    isSelfFinished,
    timerMode,
    timerStorageKey,
    isTeacherLed,
    finishStudentQuiz,
    goToNextQuestion,
    recordAndSyncAnswer,
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
          correct_count: 0,
          wrong_count: 0,
          tab_switches: 0,
          answers: [],
          current_question_index: 0,
          is_finished: false,
        },
      ])
      .select()
      .single();

    setJoining(false);

    if (error || !data) {
      alert(
        lang === "EN"
          ? `Failed to join: ${error?.message}`
          : `Gagal bergabung: ${error?.message}`,
      );
      return;
    }

    localStorage.setItem(playerStorageKey, data.id);
    localStorage.setItem(cheatStorageKey, "0");
    tabWarningRef.current = 0;
    setTabWarningCount(0);
    sound.playPowerUp();
    setPlayer(data as PlayerRow);
  };

  const handleLeaveRoom = async () => {
    if (!player) return;
    const msg =
      lang === "EN"
        ? "Leave the waiting room and change your name or character?"
        : "Keluar dari ruang tunggu dan ganti nama/karakter?";

    if (!(await window.modernConfirm(msg))) return;

    await supabase.from("players").delete().eq("id", player.id);
    localStorage.removeItem(playerStorageKey);
    localStorage.removeItem(timerStorageKey);
    localStorage.removeItem(powerupStorageKey);
    localStorage.removeItem(cheatStorageKey);
    tabWarningRef.current = 0;
    setTabWarningCount(0);
    setPlayer(null);
  };

  const handleAnswer = async (
    selected: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => {
    if (!player || hasAnsweredCurrent || !room || isSelfFinished) return;
    setHasAnsweredCurrent(true);

    const currentQ = questions[localQIndex];
    if (!currentQ) return;

    let earned = 0;
    if (isCorrect) {
      const nextStreak = player.streak + 1;
      const multiplier = nextStreak >= 3 ? 1.5 : nextStreak === 2 ? 1.2 : 1;
      const speedBonus = sessionSettings.question_timer
        ? Math.round((timeLeft / Math.max(1, maxCurrentTime)) * 50)
        : 25;
      const efficiencyBonus = movesUsed === 1 ? 25 : 0;
      earned = Math.round((100 + speedBonus + efficiencyBonus) * multiplier);

      setLastPoints(earned);
      setFeedback("CORRECT");
    } else {
      setFeedback("WRONG");
    }

    await recordAndSyncAnswer(currentQ, selected, isCorrect, earned);
    if (!isTeacherLed) {
      setTimeout(goToNextQuestion, 1800);
    }
  };

  // Power-up strictly 1x use per session (Student-Paced only)
  const activateFiftyFifty = () => {
    if (!canUsePowerUps || usedFiftyFifty || hasAnsweredCurrent) return;
    const currentQ = questions[localQIndex];
    if (!currentQ) return;

    setUsedFiftyFifty(true);
    try {
      localStorage.setItem(
        powerupStorageKey,
        JSON.stringify({ usedFiftyFifty: true, usedQueenBoost }),
      );
    } catch {
      // abaikan
    }

    sound.playPowerUp();
    const validKeys =
      currentQ.correct_options && currentQ.correct_options.length > 0
        ? currentQ.correct_options
        : [currentQ.correct_option];
    const wrongKeys = (["A", "B", "C", "D"] as OptionKey[]).filter(
      (k) => !validKeys.includes(k),
    );
    setEliminatedOptions(
      [...wrongKeys].sort(() => Math.random() - 0.5).slice(0, 2),
    );
  };

  const activateQueenBoost = () => {
    if (!canUsePowerUps || usedQueenBoost || hasAnsweredCurrent) return;
    const currentQ = questions[localQIndex];
    if (!currentQ || currentQ.piece_type === "QUEEN") return;

    setUsedQueenBoost(true);
    try {
      localStorage.setItem(
        powerupStorageKey,
        JSON.stringify({ usedFiftyFifty, usedQueenBoost: true }),
      );
    } catch {
      // abaikan
    }

    sound.playPowerUp();
    setQueenOverride(true);
  };

  const displayedHistory = useMemo(() => {
    return answerHistory.filter((item) => {
      if (reviewFilter === "WRONG") return !item.isCorrect;
      if (reviewFilter === "CORRECT") return item.isCorrect;
      return true;
    });
  }, [answerHistory, reviewFilter]);

  if (loading || !room) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        {lang === "EN" ? "Connecting to Arena..." : "Menghubungkan ke Arena..."}
      </main>
    );
  }

  // ==================== STATE 1: FORM INPUT NAMA & PILIH BIDAK ====================
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
              {t("prepareCharTitle")}
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {t("prepareCharSub")}
            </p>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              {t("nicknameLabel")}
            </label>
            <input
              type="text"
              maxLength={16}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={lang === "EN" ? "e.g. Alex" : "Contoh: Bintang"}
              className="w-full px-4 py-3.5 rounded-2xl bg-[#F2F7FC] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-black text-lg text-slate-800 text-center"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              {t("chooseAvatarLabel")}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {AVATAR_PIECES.map((piece) => {
                const meta = PIECE_META[piece];
                const localizedName =
                  PIECE_META_I18N?.[lang]?.[piece]?.name || meta.name;
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
                      {localizedName.split(" ")[0]}
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
            <span>
              {joining
                ? lang === "EN"
                  ? "Joining..."
                  : "Masuk..."
                : t("joinNowBtn")}
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </main>
    );
  }

  // ==================== STATE 2: RUANG TUNGGU (LOBBY) ====================
  if (room.status === "waiting") {
    const avatarMeta = PIECE_META[player.piece_skin] || PIECE_META.KNIGHT;
    const lobbyModeMeta = GAME_MODES_META[sessionSettings.game_mode];

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
            ✓ {t("waitingTitle")}
          </span>
          <h1 className="text-2xl font-black text-slate-800 mt-3">
            {lang === "EN"
              ? `Hi, ${player.nickname}! 👋`
              : `Halo, ${player.nickname}! 👋`}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1 mb-4">
            {t("waitingSub")}
          </p>

          <div className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-black">
            <span>{lobbyModeMeta.emoji}</span>
            <span>Arena: {lobbyModeMeta.name}</span>
          </div>

          {isTeacherLed && (
            <div className="mb-5 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-extrabold">
              📺{" "}
              {lang === "EN"
                ? "Teacher-Led Mode: Questions will be displayed on your teacher’s shared screen."
                : "Mode Dipandu Guru: Soal akan ditampilkan di layar share screen guru."}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold text-xs transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> {t("changeCharBtn")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==================== STATE 3: HASIL AKHIR & REVIEW SISWA ====================
  if (room.status === "finished" || isSelfFinished) {
    const myRank = leaderboard.findIndex((p) => p.id === player.id) + 1;
    const totalCorrect = answerHistory.filter((a) => a.isCorrect).length;
    const totalWrong = answerHistory.filter((a) => !a.isCorrect).length;
    const showReviewSection =
      sessionSettings.show_answers_after !== "OFF" && answerHistory.length > 0;
    const hideAnswerKeysInReview =
      sessionSettings.show_answers_after === "QUESTIONS_ONLY";

    return (
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="bg-white p-6 sm:p-8 rounded-[32px] border-2 border-slate-200 border-b-8 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] flex items-center justify-center border-b-4 border-[#CC8E00]">
              <Trophy className="w-10 h-10 text-amber-950" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
              {t("gameFinishedTitle")} 🎉
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-1">
              {player.nickname}
            </p>

            <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200">
                <p className="text-[11px] font-extrabold text-amber-700">
                  {room.status === "finished"
                    ? t("rankLabel")
                    : lang === "EN"
                      ? "Current Rank"
                      : "Peringkat Sementara"}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
                  {myRank > 0 ? `#${myRank}` : "-"}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <p className="text-[11px] font-extrabold text-sky-700">
                  {t("totalStarsLabel")}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-[#1E82F5] mt-1 flex items-center justify-center gap-1">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  {player.score}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
                <p className="text-[11px] font-extrabold text-emerald-700">
                  {t("correctCountLabel")}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-5 h-5" />
                  {totalCorrect}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-200">
                <p className="text-[11px] font-extrabold text-rose-700">
                  {t("wrongCountLabel")}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-1 flex items-center justify-center gap-1">
                  <XCircle className="w-5 h-5" />
                  {totalWrong}
                </p>
              </div>
            </div>

            {room.status !== "finished" && (
              <p className="text-xs sm:text-sm font-bold text-slate-500 mb-5 animate-pulse">
                {lang === "EN"
                  ? "Waiting for your teacher to end the session to reveal the final class podium..."
                  : "Menunggu guru mengakhiri sesi untuk melihat podium akhir kelas..."}
              </p>
            )}

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] text-white font-black text-sm sm:text-base border-b-4 border-[#1359B8] transition"
            >
              <Home className="w-5 h-5" /> {t("home")}
            </Link>
          </div>

          {showReviewSection && (
            <div className="bg-white border-2 border-slate-200/90 border-b-[6px] rounded-[32px] p-5 sm:p-7 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#2589FF] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-800">
                      {t("reviewTitle")}
                    </h2>
                    <p className="text-xs font-bold text-slate-400">
                      {hideAnswerKeysInReview
                        ? lang === "EN"
                          ? "Answer keys are hidden by your teacher"
                          : "Kunci jawaban disembunyikan oleh pengajar"
                        : lang === "EN"
                          ? "Check which questions you got right or wrong"
                          : "Periksa soal mana yang benar dan salah"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-[#F2F7FC] p-1.5 rounded-2xl border border-slate-200 self-start">
                  <button
                    type="button"
                    onClick={() => setReviewFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      reviewFilter === "ALL"
                        ? "bg-[#2B90FF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t("filterAll")} ({answerHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("WRONG")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      reviewFilter === "WRONG"
                        ? "bg-rose-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t("filterWrong")} ({totalWrong})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("CORRECT")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      reviewFilter === "CORRECT"
                        ? "bg-emerald-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t("filterCorrect")} ({totalCorrect})
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {displayedHistory.map((record) => {
                  const correctKeys =
                    record.question.correct_options &&
                    record.question.correct_options.length > 0
                      ? record.question.correct_options
                      : [record.question.correct_option];

                  return (
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
                          {lang === "EN"
                            ? `Question #${record.questionIndex + 1}`
                            : `Soal #${record.questionIndex + 1}`}
                        </span>
                        {record.isCorrect ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
                            <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                            {t("filterCorrect")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-black">
                            <XCircle className="w-3.5 h-3.5" />{" "}
                            {record.selectedOption === null
                              ? t("timeoutFeedback")
                              : t("wrongFeedback")}
                          </span>
                        )}
                      </div>

                      {record.question.image_url && (
                        <div
                          onClick={() =>
                            openImageZoom(record.question.image_url!)
                          }
                          className="relative inline-block mb-3 group cursor-zoom-in"
                        >
                          <img
                            src={record.question.image_url}
                            alt="Question"
                            className="max-h-44 rounded-2xl object-contain border border-slate-200 bg-white group-hover:brightness-95 transition"
                          />
                          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/75 text-white text-[10px] font-black">
                            <ZoomIn className="w-3 h-3" />{" "}
                            {lang === "EN" ? "Zoom" : "Perbesar"}
                          </span>
                        </div>
                      )}

                      <p className="font-extrabold text-base text-slate-800 mb-3.5 leading-snug">
                        <FormattedText text={record.question.question_text} />
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                          const isKeyCorrect =
                            !hideAnswerKeysInReview &&
                            correctKeys.includes(key);
                          const isUserChoice = key === record.selectedOption;
                          const style = OPTION_STYLES[key];

                          let boxStyle =
                            "bg-white border-slate-200 text-slate-700";
                          if (isKeyCorrect) {
                            boxStyle =
                              "bg-emerald-50 border-emerald-400 text-emerald-950";
                          } else if (isUserChoice && !record.isCorrect) {
                            boxStyle =
                              "bg-rose-50 border-rose-400 text-rose-950";
                          }

                          return (
                            <div
                              key={key}
                              className={`flex items-start justify-between gap-2.5 p-3 rounded-2xl border-2 ${boxStyle}`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span
                                  className={`w-6 h-6 rounded-lg ${style.badgeBg} text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5`}
                                >
                                  {key}
                                </span>
                                <span className="text-xs sm:text-sm font-extrabold whitespace-normal break-words leading-snug">
                                  <FormattedText
                                    text={record.question.options[key]}
                                  />
                                </span>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {isKeyCorrect && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white whitespace-nowrap">
                                    {lang === "EN" ? "✓ Key" : "✓ Kunci"}
                                  </span>
                                )}
                                {isUserChoice && (
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white whitespace-nowrap ${
                                      record.isCorrect
                                        ? "bg-sky-500"
                                        : "bg-rose-500"
                                    }`}
                                  >
                                    {lang === "EN" ? "Your Pick" : "Pilihanmu"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {renderImageZoomModal()}
      </main>
    );
  }

  // ==================== STATE 4: ARENA BERMAIN LIVE ====================
  const currentQuestion = questions[localQIndex] || questions[0];
  const activeBoardMode = resolveConcreteGameMode(
    sessionSettings.game_mode,
    currentQuestion.id,
  );
  const isChessMode = activeBoardMode === "CHESS";
  const activePiece: PieceType =
    isChessMode && canUsePowerUps && queenOverride
      ? "QUEEN"
      : currentQuestion?.piece_type || "KNIGHT";
  const timerPercent = (timeLeft / Math.max(1, maxCurrentTime)) * 100;

  const validCorrectKeys =
    currentQuestion.correct_options &&
    currentQuestion.correct_options.length > 0
      ? currentQuestion.correct_options
      : [currentQuestion.correct_option];

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-8">
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-base sm:text-lg text-slate-800">
              {player.nickname}
            </span>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-sky-100 text-sky-700">
              {lang === "EN"
                ? `Q ${localQIndex + 1}/${questions.length}`
                : `Soal ${localQIndex + 1}/${questions.length}`}
            </span>
            {isRedemptionRound && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800">
                <RefreshCw className="w-3 h-3" /> Redemption
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleMusic}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 font-black text-xs transition cursor-pointer ${
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

      {/* Peringatan Anti-Cheating persisten jika siswa berpindah tab */}
      {sessionSettings.anti_cheating && tabWarningCount > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
          <div className="p-3 rounded-2xl bg-rose-100 border-2 border-rose-300 text-rose-800 text-xs font-black flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              {lang === "EN"
                ? `Warning: Leaving the quiz tab was detected (${tabWarningCount}x). Please stay on this screen.`
                : `Peringatan: Terdeteksi meninggalkan layar kuis (${tabWarningCount}x). Harap tetap berada di halaman ini.`}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* ==================== KARTU SOAL: TEACHER-LED VS STUDENT-PACED ==================== */}
            {isTeacherLed ? (
              <div className="rounded-[28px] bg-gradient-to-br from-indigo-600 via-[#2B90FF] to-[#1A73E8] p-6 text-white shadow-lg border-b-[6px] border-[#1359B8]">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-white/20 px-3 py-1 rounded-full">
                    <Presentation className="w-3.5 h-3.5 text-amber-300" />
                    {lang === "EN"
                      ? `Question #${localQIndex + 1} (Teacher Screen)`
                      : `Soal #${localQIndex + 1} (Layar Guru)`}
                  </span>

                  {sessionSettings.question_timer && (
                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-xs font-black">
                        {formatSeconds(timeLeft)}
                      </span>
                    </div>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-black leading-snug mb-1.5">
                  {lang === "EN"
                    ? "Look at the question on your teacher’s shared screen!"
                    : "Lihat pertanyaan pada layar share screen guru!"}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-sky-100">
                  {lang === "EN"
                    ? "Use the tactical board on the right to capture the matching option letter (A, B, C, or D)."
                    : "Gunakan papan taktis di samping untuk menangkap huruf pilihan jawaban (A, B, C, atau D) yang sesuai."}
                </p>
              </div>
            ) : (
              <div className="rounded-[28px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-6 text-white shadow-lg border-b-[6px] border-[#1359B8]">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold bg-white/20 px-3 py-1 rounded-full">
                      {lang === "EN"
                        ? `Question #${localQIndex + 1}`
                        : `Soal #${localQIndex + 1}`}
                    </span>
                    {currentQuestion.allow_multiple && (
                      <span className="text-[11px] font-black bg-amber-300 text-slate-900 px-2.5 py-0.5 rounded-full">
                        {lang === "EN"
                          ? "✨ Multiple correct answers"
                          : "✨ Lebih dari 1 jawaban benar"}
                      </span>
                    )}
                  </div>

                  {sessionSettings.question_timer && (
                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      <div className="w-24 h-2 bg-white/25 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-300 rounded-full transition-all duration-100"
                          style={{ width: `${timerPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-black min-w-[2.2rem] text-right">
                        {formatSeconds(timeLeft)}
                      </span>
                    </div>
                  )}
                </div>

                {currentQuestion.image_url && (
                  <div
                    onClick={() => openImageZoom(currentQuestion.image_url!)}
                    className="relative mb-4 bg-white/95 p-2 rounded-2xl shadow-inner group cursor-zoom-in"
                  >
                    <img
                      src={currentQuestion.image_url}
                      alt="Question"
                      className="max-h-56 mx-auto rounded-xl object-contain group-hover:scale-[1.01] transition-transform"
                    />
                    <span className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/75 text-white text-[11px] font-black shadow-sm">
                      <ZoomIn className="w-3.5 h-3.5" />{" "}
                      {lang === "EN" ? "Tap to Zoom" : "Klik Perbesar"}
                    </span>
                  </div>
                )}

                <h1 className="text-xl sm:text-2xl font-black leading-snug">
                  <FormattedText text={currentQuestion.question_text} />
                </h1>
              </div>
            )}

            {/* Banner Feedback Setelah Siswa Menjawab */}
            {hasAnsweredCurrent && (
              <div
                className={`p-4 rounded-2xl border-2 border-b-4 text-center font-black text-sm sm:text-base ${
                  sessionSettings.show_answer_each === "OFF"
                    ? "bg-sky-50 border-sky-200 text-sky-800"
                    : feedback === "CORRECT"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-rose-50 border-rose-300 text-rose-700"
                }`}
              >
                {sessionSettings.show_answer_each === "OFF" ? (
                  <p>
                    ✓{" "}
                    {lang === "EN" ? "Answer submitted!" : "Jawaban terkirim!"}
                  </p>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {feedback === "CORRECT" ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>
                          {t("correctFeedback")} (+{lastPoints}{" "}
                          {lang === "EN" ? "Stars" : "Bintang"})
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-500" />
                        <span>
                          {feedback === "TIMEOUT"
                            ? `${t("timeoutFeedback")} `
                            : `${t("wrongFeedback")} `}
                          {sessionSettings.show_answer_each === "ON" &&
                            `${t("correctAnswerIs")} ${validCorrectKeys.join(
                              lang === "EN" ? " or " : " atau ",
                            )}`}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <p className="text-xs font-bold opacity-75 mt-1">
                  {isTeacherLed
                    ? lang === "EN"
                      ? "⏳ Waiting for your teacher to move to the next question..."
                      : "⏳ Menunggu guru melanjutkan ke soal berikutnya..."
                    : `⏳ ${t("nextQuestionWait")}`}
                </p>
              </div>
            )}

            {/* Badge Peringatan Visual di Atas 4 Kartu Pilihan saat Multiple Answers Aktif */}
            {currentQuestion.allow_multiple && (
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-purple-50 border-2 border-purple-200 text-purple-900">
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  {lang === "EN"
                    ? "Select more than 1 answer: Capture all correct letters on the board!"
                    : "Pilih lebih dari 1 jawaban: Tangkap semua huruf benar di papan!"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                  Multi
                </span>
              </div>
            )}

            {/* Pilihan Jawaban: Teacher-Led vs Student-Paced */}
            {isTeacherLed ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                  const style = OPTION_STYLES[key];
                  return (
                    <div
                      key={key}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-b-4 ${style.cardBg} ${style.cardBorder}`}
                    >
                      {currentQuestion.allow_multiple && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-md border-2 border-purple-400 bg-white/80" />
                      )}
                      <span
                        className={`w-11 h-11 rounded-xl ${style.badgeBg} text-white font-black text-lg flex items-center justify-center shadow-xs mb-1.5`}
                      >
                        {key}
                      </span>
                      <span className="text-xs font-extrabold text-slate-500">
                        {lang === "EN" ? `Option ${key}` : `Pilihan ${key}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                  const isEliminated = eliminatedOptions.includes(key);
                  const style = OPTION_STYLES[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-start justify-between gap-2.5 p-3.5 rounded-2xl border-2 border-b-4 ${
                        isEliminated
                          ? "opacity-35 line-through bg-slate-100 border-slate-200"
                          : `${style.cardBg} ${style.cardBorder}`
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span
                          className={`w-9 h-9 rounded-xl ${style.badgeBg} text-white font-black text-sm flex items-center justify-center shrink-0`}
                        >
                          {key}
                        </span>
                        <span className="text-sm sm:text-base font-extrabold text-slate-700 whitespace-normal break-words leading-snug pt-1">
                          <FormattedText text={currentQuestion.options[key]} />
                        </span>
                      </div>

                      {currentQuestion.allow_multiple && !isEliminated && (
                        <span
                          title={
                            lang === "EN"
                              ? "Multiple choice option"
                              : "Opsi pilihan ganda"
                          }
                          className="w-5 h-5 mt-2 rounded-md border-2 border-purple-400 bg-white/90 shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Power-Up Cards: HANYA tampil pada mode Student-Paced & maksimal 1x pakai per sesi */}
            {canUsePowerUps && (
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 px-1">
                  {lang === "EN"
                    ? "Special Power-Ups (1x use per session)"
                    : "Kartu Bantuan Spesial (1x pakai per sesi)"}
                </p>
                <div
                  className={`grid ${isChessMode ? "grid-cols-2" : "grid-cols-1"} gap-3`}
                >
                  <button
                    type="button"
                    onClick={activateFiftyFifty}
                    disabled={usedFiftyFifty || hasAnsweredCurrent}
                    className={`flex items-center justify-between gap-2 p-3 rounded-2xl border-2 border-b-4 text-left transition ${
                      usedFiftyFifty
                        ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                        : "bg-[#F3EFFF] border-[#D8CEFF] border-b-[#C2B2FF] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#7C5CFC] text-white flex items-center justify-center shrink-0">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-xs text-slate-800 truncate">
                        {t("fiftyFiftyTitle")}
                      </span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                      {usedFiftyFifty ? "0x" : "1x"}
                    </span>
                  </button>

                  {isChessMode && (
                    <button
                      type="button"
                      onClick={activateQueenBoost}
                      disabled={
                        usedQueenBoost ||
                        hasAnsweredCurrent ||
                        activePiece === "QUEEN"
                      }
                      className={`flex items-center justify-between gap-2 p-3 rounded-2xl border-2 border-b-4 text-left transition ${
                        usedQueenBoost || activePiece === "QUEEN"
                          ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                          : "bg-[#FFF5E6] border-[#FFE0B2] border-b-[#FFCC80] cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FF9800] text-white flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-xs text-slate-800 truncate">
                          {t("queenBoostTitle")}
                        </span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                        {usedQueenBoost ? "0x" : "1x"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-md">
            <TactiBoardDispatcher
              key={`live-q-${localQIndex}-${activeBoardMode}-${isRedemptionRound ? "redeem" : "main"}`}
              mode={activeBoardMode}
              question={currentQuestion}
              activePiece={activePiece}
              eliminatedOptions={eliminatedOptions}
              disabled={hasAnsweredCurrent}
              onAnswer={handleAnswer}
            />

            <div className="mt-3.5 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-xs font-bold text-amber-800">
                💡 {t("boardTip")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {renderImageZoomModal()}
    </main>
  );
}
