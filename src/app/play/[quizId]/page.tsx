"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Crown,
  Scissors,
  RotateCcw,
  Trophy,
  Star,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Home,
  BookOpen,
  Footprints,
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
import TactiMirrorBoard from "@/components/boards/TactiMirrorBoard";
import TactiCircuitBoard from "@/components/boards/TactiCircuitBoard";
import TactiStealthBoard from "@/components/boards/TactiStealthBoard";
import TactiSlideBoard from "@/components/boards/TactiSlideBoard";
import TactiCollapseBoard from "@/components/boards/TactiCollapseBoard";
import TactiFluxBoard from "@/components/boards/TactiFluxBoard";
import TactiSwitchBoard from "@/components/boards/TactiSwitchBoard";
import TactiPortalBoard from "@/components/boards/TactiPortalBoard";
import TactiShiftBoard from "@/components/boards/TactiShiftBoard";
import FormattedText from "@/components/FormattedText";
import { useLanguage } from "@/components/LanguageProvider";
import { PIECE_META_I18N } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { sound } from "@/lib/sound";

export type GameMode =
  | "CHESS"
  | "MIRROR"
  | "CIRCUIT"
  | "STEALTH"
  | "SLIDE"
  | "COLLAPSE"
  | "FLUX"
  | "SWITCH"
  | "PORTAL"
  | "SHIFT";

export interface ExtendedQuestionData extends QuestionData {
  game_mode?: GameMode;
}

interface AnswerRecord {
  question: ExtendedQuestionData;
  gameMode: GameMode;
  selectedOption: OptionKey | null;
  isCorrect: boolean;
  movesUsed: number;
}

const ALL_GAME_MODES: {
  id: GameMode;
  label: string;
  icon: string;
  tipId: string;
  tipEn: string;
}[] = [
  {
    id: "CHESS",
    label: "Chess",
    icon: "♞",
    tipId:
      "Klik petak hijau untuk melangkah & tangkap huruf jawaban yang benar!",
    tipEn: "Click green squares to move and capture the right option letter!",
  },
  {
    id: "MIRROR",
    label: "Mirror",
    icon: "🔦",
    tipId:
      "Klik cermin (putar 45°) untuk memantulkan laser ke target, lalu tekan Tembak (Spasi).",
    tipEn:
      "Click mirrors (45° steps) to aim the laser at a target, then press Fire (Space).",
  },
  {
    id: "CIRCUIT",
    label: "Circuit",
    icon: "⚡",
    tipId:
      "Putar ubin kabel untuk menyambungkan listrik dari ⚡ ke terminal jawaban, lalu tekan Alirkan.",
    tipEn:
      "Rotate circuit tiles to route power from ⚡ to an option terminal, then deliver power.",
  },
  {
    id: "STEALTH",
    label: "Stealth",
    icon: "🥷",
    tipId:
      "Gunakan klik, D-Pad, atau WASD/Panah untuk menyelinap menghindari sorotan radar merah.",
    tipEn:
      "Use clicks, D-Pad, or WASD/Arrows to sneak past red guard radar beams.",
  },
  {
    id: "SLIDE",
    label: "Slide",
    icon: "🥌",
    tipId:
      "Meluncur di arena es dan pantulkan ke batu bumper hingga berhenti tepat di huruf jawaban.",
    tipEn:
      "Glide across the ice and bank off rocks to stop right on the target option.",
  },
  {
    id: "COLLAPSE",
    label: "Collapse",
    icon: "🌉",
    tipId:
      "Perhatikan angka ketahanan pijakan (1–2); lantai akan runtuh setelah kamu tinggalkan!",
    tipEn:
      "Watch tile durability (1–2); tiles crack and collapse after you step off them!",
  },
  {
    id: "FLUX",
    label: "Flux",
    icon: "🧲",
    tipId:
      "Tekan F/Spasi untuk membalik polaritas (N+ / S−); kutub sama menolak, kutub beda menarik.",
    tipEn:
      "Press F/Space to flip polarity (N+ / S−); like poles repel, opposite poles attract.",
  },
  {
    id: "SWITCH",
    label: "Switch",
    icon: "🎛️",
    tipId:
      "Injak saklar lantai 🔴 atau 🔵 untuk membuka gerbang laser dengan warna yang sama.",
    tipEn: "Step on 🔴 or 🔵 floor pads to unlock gates of the matching color.",
  },
  {
    id: "PORTAL",
    label: "Portal",
    icon: "🌀",
    tipId:
      "Masuki portal α atau β untuk berteleportasi menembus tembok penghalang!",
    tipEn: "Step onto α or β portals to warp instantly across barrier walls!",
  },
  {
    id: "SHIFT",
    label: "Shift",
    icon: "🔀",
    tipId:
      "Langkahkan bidak atau tekan panah di tepi papan untuk menggeser baris & kolom.",
    tipEn:
      "Step your navigator or press edge arrows to wrap rows & columns around.",
  },
];

const GAME_MODE_MAP: Record<GameMode, (typeof ALL_GAME_MODES)[number]> =
  ALL_GAME_MODES.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<GameMode, (typeof ALL_GAME_MODES)[number]>,
  );

function normalizeGameMode(raw: unknown): GameMode {
  const upper = String(raw || "CHESS")
    .trim()
    .toUpperCase() as GameMode;
  return upper in GAME_MODE_MAP ? upper : "CHESS";
}

function parseOptionKeysSafe(
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
        // abaikan
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

const DEMO_QUESTIONS: ExtendedQuestionData[] = [
  {
    id: "1",
    game_mode: "CHESS",
    question_text:
      "Planet manakah yang dijuluki sebagai Planet Merah di tata surya kita?",
    options: { A: "Venus", B: "Mars", C: "Jupiter", D: "Saturnus" },
    correct_option: "B",
    correct_options: ["B"],
    piece_type: "KNIGHT",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "2",
    game_mode: "MIRROR",
    question_text: "Berapakah hasil perkalian dari 12 × 8?",
    options: { A: "84", B: "92", C: "96", D: "108" },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "BISHOP",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "3",
    game_mode: "CIRCUIT",
    question_text:
      "Bahasa pemrograman apa yang berjalan langsung di dalam browser web?",
    options: { A: "JavaScript", B: "Python", C: "C++", D: "Go" },
    correct_option: "A",
    correct_options: ["A"],
    piece_type: "ROOK",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "4",
    game_mode: "STEALTH",
    question_text: 'Unsur kimia dengan simbol "Au" adalah...',
    options: { A: "Perak", B: "Aluminium", C: "Emas", D: "Tembaga" },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "KING",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "5",
    game_mode: "SLIDE",
    question_text: "Di negara manakah Candi Borobudur berada?",
    options: { A: "Thailand", B: "Kamboja", C: "Vietnam", D: "Indonesia" },
    correct_option: "D",
    correct_options: ["D"],
    piece_type: "PAWN",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "6",
    game_mode: "COLLAPSE",
    question_text:
      "Hewan darat tercepat di dunia yang mampu berlari hingga 110 km/jam adalah...",
    options: { A: "Singa", B: "Cheetah", C: "Kuda", D: "Kangguru" },
    correct_option: "B",
    correct_options: ["B"],
    piece_type: "QUEEN",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "7",
    game_mode: "FLUX",
    question_text:
      "Gas utama yang paling banyak menyusun atmosfer Bumi (sekitar 78%) adalah...",
    options: {
      A: "Oksigen",
      B: "Karbon Dioksida",
      C: "Nitrogen",
      D: "Hidrogen",
    },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "KNIGHT",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "8",
    game_mode: "SWITCH",
    question_text:
      "Benua manakah yang memiliki luas wilayah terbesar di dunia?",
    options: { A: "Asia", B: "Afrika", C: "Amerika Utara", D: "Eropa" },
    correct_option: "A",
    correct_options: ["A"],
    piece_type: "ROOK",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "9",
    game_mode: "PORTAL",
    question_text:
      "Siapakah ilmuwan yang merumuskan hukum gravitasi universal?",
    options: {
      A: "Albert Einstein",
      B: "Galileo Galilei",
      C: "Nikola Tesla",
      D: "Isaac Newton",
    },
    correct_option: "D",
    correct_options: ["D"],
    piece_type: "BISHOP",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "10",
    game_mode: "SHIFT",
    question_text:
      "Pilih DUA bilangan prima di bawah ini! (Latihan Jawaban Ganda)",
    options: { A: "7", B: "9", C: "11", D: "15" },
    correct_option: "A",
    correct_options: ["A", "C"],
    allow_multiple: true,
    piece_type: "QUEEN",
    obstacles: 3,
    time_limit: 75,
  },
];

const DEMO_QUESTIONS_EN: ExtendedQuestionData[] = [
  {
    id: "1",
    game_mode: "CHESS",
    question_text:
      "Which planet is known as the Red Planet in our solar system?",
    options: { A: "Venus", B: "Mars", C: "Jupiter", D: "Saturn" },
    correct_option: "B",
    correct_options: ["B"],
    piece_type: "KNIGHT",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "2",
    game_mode: "MIRROR",
    question_text: "What is the result of 12 × 8?",
    options: { A: "84", B: "92", C: "96", D: "108" },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "BISHOP",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "3",
    game_mode: "CIRCUIT",
    question_text:
      "Which programming language runs natively inside a web browser?",
    options: { A: "JavaScript", B: "Python", C: "C++", D: "Go" },
    correct_option: "A",
    correct_options: ["A"],
    piece_type: "ROOK",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "4",
    game_mode: "STEALTH",
    question_text: 'Which chemical element has the symbol "Au"?',
    options: { A: "Silver", B: "Aluminum", C: "Gold", D: "Copper" },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "KING",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "5",
    game_mode: "SLIDE",
    question_text: "In which country is Borobudur Temple located?",
    options: { A: "Thailand", B: "Cambodia", C: "Vietnam", D: "Indonesia" },
    correct_option: "D",
    correct_options: ["D"],
    piece_type: "PAWN",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "6",
    game_mode: "COLLAPSE",
    question_text:
      "What is the fastest land animal capable of running up to 110 km/h?",
    options: { A: "Lion", B: "Cheetah", C: "Horse", D: "Kangaroo" },
    correct_option: "B",
    correct_options: ["B"],
    piece_type: "QUEEN",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "7",
    game_mode: "FLUX",
    question_text:
      "Which gas makes up the largest portion (~78%) of Earth's atmosphere?",
    options: {
      A: "Oxygen",
      B: "Carbon Dioxide",
      C: "Nitrogen",
      D: "Hydrogen",
    },
    correct_option: "C",
    correct_options: ["C"],
    piece_type: "KNIGHT",
    obstacles: 2,
    time_limit: 60,
  },
  {
    id: "8",
    game_mode: "SWITCH",
    question_text: "Which continent has the largest land area on Earth?",
    options: { A: "Asia", B: "Africa", C: "North America", D: "Europe" },
    correct_option: "A",
    correct_options: ["A"],
    piece_type: "ROOK",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "9",
    game_mode: "PORTAL",
    question_text:
      "Which scientist formulated the law of universal gravitation?",
    options: {
      A: "Albert Einstein",
      B: "Galileo Galilei",
      C: "Nikola Tesla",
      D: "Isaac Newton",
    },
    correct_option: "D",
    correct_options: ["D"],
    piece_type: "BISHOP",
    obstacles: 3,
    time_limit: 60,
  },
  {
    id: "10",
    game_mode: "SHIFT",
    question_text:
      "Select TWO prime numbers below! (Multiple Answers Practice)",
    options: { A: "7", B: "9", C: "11", D: "15" },
    correct_option: "A",
    correct_options: ["A", "C"],
    allow_multiple: true,
    piece_type: "QUEEN",
    obstacles: 3,
    time_limit: 75,
  },
];

const DEFAULT_QUESTION_TIME = 60;

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export default function PlayQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.quizId as string;
  const { lang, t } = useLanguage();

  const isDemo = quizId === "demo";

  const [questions, setQuestions] = useState<ExtendedQuestionData[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [timerMode, setTimerMode] = useState<"PER_QUESTION" | "TOTAL_QUIZ">(
    "PER_QUESTION",
  );
  const [totalQuizSeconds, setTotalQuizSeconds] = useState<number>(300);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [demoModeOverride, setDemoModeOverride] = useState<GameMode | null>(
    null,
  );
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUESTION_TIME);
  const [maxCurrentTime, setMaxCurrentTime] = useState(DEFAULT_QUESTION_TIME);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<
    "CORRECT" | "WRONG" | "TIMEOUT" | null
  >(null);
  const [isFinished, setIsFinished] = useState(false);

  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "WRONG" | "CORRECT">(
    "ALL",
  );

  const [eliminatedOptions, setEliminatedOptions] = useState<OptionKey[]>([]);
  const [queenOverride, setQueenOverride] = useState(false);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedQueenBoost, setUsedQueenBoost] = useState(false);

  // Sinkronisasi & kontrol musik latar
  useEffect(() => {
    setIsMuted(sound.getMuted());

    if (!loading && !isFinished) {
      sound.startMusic();
    } else {
      sound.stopMusic();
    }

    const unlockAudio = () => {
      if (!sound.getMuted() && !isFinished) {
        sound.startMusic();
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      sound.stopMusic();
    };
  }, [loading, isFinished]);

  const handleToggleMusic = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  // Sinkronisasi bahasa untuk soal Demo jika user mengganti bahasa saat bermain
  useEffect(() => {
    if (!isDemo) return;
    setQuestions(lang === "EN" ? DEMO_QUESTIONS_EN : DEMO_QUESTIONS);
    setQuizTitle(
      lang === "EN"
        ? "All-Modes Interactive Demo"
        : "Demo Interaktif Semua Mode",
    );
  }, [isDemo, lang]);

  useEffect(() => {
    async function loadQuiz() {
      if (isDemo) {
        setQuestions(lang === "EN" ? DEMO_QUESTIONS_EN : DEMO_QUESTIONS);
        setQuizTitle(
          lang === "EN"
            ? "All-Modes Interactive Demo"
            : "Demo Interaktif Semua Mode",
        );
        setTimerMode("PER_QUESTION");
        setTimeLeft(DEFAULT_QUESTION_TIME);
        setMaxCurrentTime(DEFAULT_QUESTION_TIME);
        setLoading(false);
        return;
      }

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("title, timer_mode, total_time_seconds")
        .eq("id", quizId)
        .single();

      const mode =
        (quiz?.timer_mode as "PER_QUESTION" | "TOTAL_QUIZ") || "PER_QUESTION";
      const totalSec = quiz?.total_time_seconds || 300;
      setTimerMode(mode);
      setTotalQuizSeconds(totalSec);
      if (quiz) setQuizTitle(quiz.title);

      const { data: qRows } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (qRows && qRows.length > 0) {
        const mapped: ExtendedQuestionData[] = qRows.map((row) => {
          const parsedKeys = parseOptionKeysSafe(
            row.correct_options,
            row.correct_option,
          );
          return {
            id: row.id,
            question_text: row.question_text,
            image_url: row.image_url || null,
            options: {
              A: row.option_a,
              B: row.option_b,
              C: row.option_c,
              D: row.option_d,
            },
            correct_option: parsedKeys[0],
            correct_options: parsedKeys,
            allow_multiple:
              Boolean(row.allow_multiple) || parsedKeys.length > 1,
            time_limit: row.time_limit || DEFAULT_QUESTION_TIME,
            piece_type: (row.piece_type || "KNIGHT") as PieceType,
            obstacles: row.obstacles ?? 3,
            game_mode: normalizeGameMode(row.game_mode ?? row.board_mode),
          };
        });
        setQuestions(mapped);

        const initialDuration =
          mode === "TOTAL_QUIZ"
            ? totalSec
            : mapped[0].time_limit || DEFAULT_QUESTION_TIME;
        setTimeLeft(initialDuration);
        setMaxCurrentTime(initialDuration);
      }
      setLoading(false);
    }

    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, isDemo]);

  const currentQuestion = questions[currentIndex];
  const activeGameMode: GameMode =
    isDemo && demoModeOverride
      ? demoModeOverride
      : normalizeGameMode(currentQuestion?.game_mode);

  const activePiece: PieceType = queenOverride
    ? "QUEEN"
    : currentQuestion?.piece_type || "KNIGHT";

  const goToNextQuestion = useCallback(() => {
    setFeedback(null);
    setLastPoints(null);
    setEliminatedOptions([]);
    setQueenOverride(false);
    setDemoModeOverride(null);

    if (currentIndex + 1 >= questions.length) {
      setIsFinished(true);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (timerMode === "PER_QUESTION") {
        const nextLimit =
          questions[nextIdx]?.time_limit || DEFAULT_QUESTION_TIME;
        setTimeLeft(nextLimit);
        setMaxCurrentTime(nextLimit);
      }
    }
  }, [currentIndex, questions, timerMode]);

  // 1. Timer mundur
  useEffect(() => {
    if (loading || !currentQuestion || isFinished || timeLeft <= 0) return;
    if (timerMode === "PER_QUESTION" && feedback) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, Number((prev - 0.1).toFixed(1))));
    }, 100);

    return () => clearInterval(timer);
  }, [loading, currentQuestion, feedback, isFinished, timeLeft, timerMode]);

  // 2. Tangani saat waktu habis (0 detik)
  useEffect(() => {
    if (loading || !currentQuestion || isFinished) return;
    if (timerMode === "PER_QUESTION" && feedback) return;

    if (timeLeft <= 0) {
      sound.playWrong();
      setStreak(0);

      if (timerMode === "TOTAL_QUIZ") {
        setIsFinished(true);
        return;
      }

      setFeedback("TIMEOUT");
      setAnswerHistory((prev) => [
        ...prev,
        {
          question: currentQuestion,
          gameMode: activeGameMode,
          selectedOption: null,
          isCorrect: false,
          movesUsed: 0,
        },
      ]);
    }
  }, [
    timeLeft,
    loading,
    currentQuestion,
    feedback,
    isFinished,
    timerMode,
    activeGameMode,
  ]);

  // 3. Otomatis lanjut ke soal berikutnya 1.8 detik setelah feedback muncul
  useEffect(() => {
    if (!feedback || isFinished) return;

    const tNext = setTimeout(goToNextQuestion, 1800);
    return () => clearTimeout(tNext);
  }, [feedback, isFinished, goToNextQuestion]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex items-center justify-center font-black text-slate-500">
        {lang === "EN" ? "Preparing Arena..." : "Menyiapkan Arena..."}
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="min-h-screen bg-[#F2F7FC] flex flex-col items-center justify-center p-4 text-center">
        <p className="font-black text-xl text-slate-800 mb-3">
          {lang === "EN" ? "Quiz not found" : "Kuis tidak ditemukan"}
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-3 rounded-2xl bg-[#2B90FF] text-white font-black text-sm cursor-pointer"
        >
          {lang === "EN" ? "Back to Home" : "Kembali ke Beranda"}
        </button>
      </main>
    );
  }

  const validCorrectKeys: OptionKey[] = parseOptionKeysSafe(
    currentQuestion.correct_options,
    currentQuestion.correct_option,
  );

  const isCurrentMultiple =
    Boolean(currentQuestion.allow_multiple) || validCorrectKeys.length > 1;

  const handleAnswer = (
    selected: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => {
    if (feedback) return;

    setAnswerHistory((prev) => [
      ...prev,
      {
        question: currentQuestion,
        gameMode: activeGameMode,
        selectedOption: selected,
        isCorrect,
        movesUsed,
      },
    ]);

    if (isCorrect) {
      const nextStreak = streak + 1;
      const multiplier = nextStreak >= 3 ? 1.5 : nextStreak === 2 ? 1.2 : 1;
      const speedBonus = Math.round(
        (timeLeft / Math.max(1, maxCurrentTime)) * 50,
      );
      const efficiencyBonus = movesUsed === 1 ? 25 : 0;
      const earned = Math.round(
        (100 + speedBonus + efficiencyBonus) * multiplier,
      );

      setScore((prev) => prev + earned);
      setStreak(nextStreak);
      setMaxStreak((prev) => Math.max(prev, nextStreak));
      setCorrectCount((prev) => prev + 1);
      setLastPoints(earned);
      setFeedback("CORRECT");
    } else {
      setStreak(0);
      setFeedback("WRONG");
    }
  };

  const handleSelectDemoMode = (mode: GameMode) => {
    if (!isDemo || feedback) return;
    sound.playMove();
    setQueenOverride(false);
    setDemoModeOverride(mode);
  };

  const activateFiftyFifty = () => {
    if (usedFiftyFifty || feedback) return;
    sound.playPowerUp();
    const wrongKeys = (["A", "B", "C", "D"] as OptionKey[]).filter(
      (k) => !validCorrectKeys.includes(k),
    );
    const shuffledWrong = [...wrongKeys].sort(() => Math.random() - 0.5);
    setEliminatedOptions(shuffledWrong.slice(0, 2));
    setUsedFiftyFifty(true);
  };

  const activateQueenBoost = () => {
    if (
      usedQueenBoost ||
      feedback ||
      activeGameMode !== "CHESS" ||
      activePiece === "QUEEN"
    ) {
      return;
    }
    sound.playPowerUp();
    setQueenOverride(true);
    setUsedQueenBoost(true);
  };

  const resetGame = () => {
    setCurrentIndex(0);
    setDemoModeOverride(null);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    const initialDuration =
      timerMode === "TOTAL_QUIZ"
        ? totalQuizSeconds
        : questions[0]?.time_limit || DEFAULT_QUESTION_TIME;
    setTimeLeft(initialDuration);
    setMaxCurrentTime(initialDuration);
    setFeedback(null);
    setLastPoints(null);
    setAnswerHistory([]);
    setReviewFilter("ALL");
    setEliminatedOptions([]);
    setQueenOverride(false);
    setUsedFiftyFifty(false);
    setUsedQueenBoost(false);
    setIsFinished(false);
  };

  const displayTitle = isDemo
    ? lang === "EN"
      ? "All-Modes Interactive Demo"
      : "Demo Interaktif Semua Mode"
    : quizTitle;

  if (isFinished) {
    const accuracy = Math.round((correctCount / questions.length) * 100);
    const wrongCount = answerHistory.filter((item) => !item.isCorrect).length;
    const displayedHistory = answerHistory.filter((item) => {
      if (reviewFilter === "WRONG") return !item.isCorrect;
      if (reviewFilter === "CORRECT") return item.isCorrect;
      return true;
    });

    return (
      <main className="min-h-screen bg-[#F2F7FC] text-slate-800 py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border-2 border-sky-100 border-b-8 rounded-[32px] p-6 sm:p-8 text-center shadow-lg"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] text-slate-900 flex items-center justify-center shadow-lg border-b-4 border-[#CC8E00]">
              <Trophy className="w-10 h-10 text-amber-900" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              {lang === "EN" ? "Awesome Job! 🎉" : "Hebat Sekali! 🎉"}
            </h1>
            <p className="text-base font-medium text-slate-500 mt-1">
              {displayTitle}
            </p>

            <div className="my-6 p-5 rounded-3xl bg-[#EEF6FF] border-2 border-[#D4E7FF]">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sky-600">
                {t("totalStarsLabel")}
              </p>
              <p className="text-5xl font-black text-[#1E82F5] mt-1 flex items-center justify-center gap-2">
                <Star className="w-9 h-9 fill-amber-400 text-amber-400" />
                {score}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-7">
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
                <p className="text-xs font-bold text-emerald-700">
                  {t("correctCountLabel")}
                </p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">
                  {correctCount}/{questions.length} ({accuracy}%)
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-orange-50 border-2 border-orange-200">
                <p className="text-xs font-bold text-orange-700">
                  {lang === "EN" ? "Best Streak" : "Beruntun Terbaik"}
                </p>
                <p className="text-2xl font-black text-orange-500 mt-0.5 flex items-center justify-center gap-1">
                  <Flame className="w-6 h-6 fill-orange-500" /> {maxStreak}x
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/"
                className="py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-base flex items-center justify-center gap-2 border-b-4 border-slate-300 transition"
              >
                <Home className="w-5 h-5" /> {t("home")}
              </Link>
              <button
                onClick={resetGame}
                className="py-4 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] text-white font-black text-base flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-md transition cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />{" "}
                {lang === "EN" ? "Play Again" : "Main Lagi"}
              </button>
            </div>
          </motion.div>

          {/* Pembahasan Soal */}
          <div className="bg-white border-2 border-slate-200/90 border-b-[6px] rounded-[32px] p-6 sm:p-7 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-[#2589FF] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {t("reviewTitle")}
                  </h2>
                  <p className="text-xs font-bold text-slate-400">
                    {lang === "EN"
                      ? "Review your answers and the correct keys"
                      : "Periksa kembali jawabanmu dan kunci jawaban yang benar"}
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
                  {t("filterWrong")} ({wrongCount})
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
                  {t("filterCorrect")} ({correctCount})
                </button>
              </div>
            </div>

            {displayedHistory.length === 0 ? (
              <div className="text-center py-10 bg-emerald-50/70 rounded-2xl border-2 border-emerald-200">
                <p className="text-lg font-black text-emerald-700">
                  {lang === "EN"
                    ? "No questions in this filter 🌟"
                    : "Tidak ada soal pada kategori ini 🌟"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {displayedHistory.map((record) => {
                  const qIndex = answerHistory.findIndex(
                    (item) => item.question.id === record.question.id,
                  );
                  const pieceMeta =
                    PIECE_META[record.question.piece_type] || PIECE_META.KNIGHT;
                  const localizedPiece =
                    PIECE_META_I18N?.[lang]?.[record.question.piece_type] ||
                    pieceMeta;
                  const modeInfo =
                    GAME_MODE_MAP[record.gameMode] || GAME_MODE_MAP.CHESS;

                  const recordCorrectKeys = parseOptionKeysSafe(
                    record.question.correct_options,
                    record.question.correct_option,
                  );

                  return (
                    <div
                      key={record.question.id}
                      className={`p-5 rounded-3xl border-2 border-b-4 ${
                        record.isCorrect
                          ? "bg-[#F8FCFA] border-emerald-200"
                          : "bg-[#FFF9FA] border-rose-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-black">
                            {lang === "EN"
                              ? `Question #${qIndex + 1}`
                              : `Soal #${qIndex + 1}`}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
                            {record.gameMode === "CHESS"
                              ? `${pieceMeta.symbol} ${localizedPiece.name}`
                              : `${modeInfo.icon} Tacti${modeInfo.label}`}
                          </span>
                          {record.movesUsed > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-700 text-xs font-extrabold">
                              <Footprints className="w-3 h-3" />{" "}
                              {record.movesUsed}{" "}
                              {lang === "EN" ? "actions" : "aksi"}
                            </span>
                          )}
                        </div>

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
                        <img
                          src={record.question.image_url}
                          alt="Question"
                          className="max-h-44 rounded-2xl mb-3 object-contain border border-slate-200 bg-white"
                        />
                      )}

                      <p className="font-extrabold text-base sm:text-lg text-slate-800 mb-4 leading-snug">
                        <FormattedText text={record.question.question_text} />
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                          const isKeyCorrect = recordCorrectKeys.includes(key);
                          const isUserChoice = key === record.selectedOption;
                          const style = OPTION_STYLES[key];

                          let boxStyle =
                            "bg-white border-slate-200 text-slate-700";
                          if (isKeyCorrect) {
                            boxStyle =
                              "bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/30";
                          } else if (isUserChoice && !record.isCorrect) {
                            boxStyle =
                              "bg-rose-50 border-rose-400 text-rose-950 ring-2 ring-rose-400/30";
                          }

                          return (
                            <div
                              key={key}
                              className={`flex items-start justify-between gap-2.5 p-3 rounded-2xl border-2 ${boxStyle}`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span
                                  className={`w-7 h-7 rounded-lg ${style.badgeBg} text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5`}
                                >
                                  {key}
                                </span>
                                <span className="text-sm font-extrabold whitespace-normal break-words leading-snug">
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
                                      isKeyCorrect
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
            )}
          </div>
        </div>
      </main>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;
  const timerPercent = (timeLeft / Math.max(1, maxCurrentTime)) * 100;
  const currentModeInfo = GAME_MODE_MAP[activeGameMode] || GAME_MODE_MAP.CHESS;
  const boardKey = `${currentQuestion.id}-${activeGameMode}`;
  const isQueenBoostDisabled =
    usedQueenBoost ||
    Boolean(feedback) ||
    activeGameMode !== "CHESS" ||
    activePiece === "QUEEN";

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-8">
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#3B9EFF] to-[#1D7AFC] text-white flex items-center justify-center text-2xl shadow-sm border-b-4 border-[#135BC4]">
              {currentModeInfo.icon}
            </div>
            <div>
              <span className="font-black text-lg sm:text-xl tracking-tight text-slate-800 block leading-none">
                Tacti<span className="text-[#2589FF]">Quiz</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400 truncate max-w-[130px] sm:max-w-[180px] block">
                {displayTitle}
              </span>
            </div>
          </Link>

          <div className="hidden md:flex flex-col flex-1 max-w-md mx-4">
            <div className="flex justify-between text-xs font-extrabold text-slate-500 mb-1.5">
              <span>
                {lang === "EN"
                  ? `Question ${currentIndex + 1} of ${questions.length}`
                  : `Pertanyaan ${currentIndex + 1} dari ${questions.length}`}
              </span>
              <span className="text-[#2589FF]">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <motion.div
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-[#3B9EFF] to-[#22C55E] rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleMusic}
              title={
                isMuted
                  ? lang === "EN"
                    ? "Turn On Study Music"
                    : "Nyalakan Musik Belajar"
                  : lang === "EN"
                    ? "Mute Music"
                    : "Matikan Musik (Mute)"
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 font-black text-xs sm:text-sm transition cursor-pointer ${
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

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-orange-50 border-2 border-orange-200 text-orange-600 font-black text-sm">
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
              <span>{streak}</span>
            </div>

            <div className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-50 border-2 border-sky-200 text-[#1E82F5] font-black text-sm">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{score}</span>

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
          {/* Kolom Kiri: Soal, Pilihan Jawaban, & Power-Ups */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4AA8FF] via-[#2B90FF] to-[#1A73E8] p-6 sm:p-7 text-white shadow-lg border-b-[6px] border-[#1359B8]">
              <div className="absolute -right-8 -bottom-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {lang === "EN"
                      ? `Question #${currentIndex + 1}`
                      : `Soal #${currentIndex + 1}`}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/25 text-xs font-extrabold">
                    {currentModeInfo.icon} Tacti{currentModeInfo.label}
                  </span>
                  {isCurrentMultiple && (
                    <span className="text-[11px] font-black bg-amber-300 text-slate-900 px-2.5 py-0.5 rounded-full">
                      {lang === "EN"
                        ? "✨ Multiple correct answers"
                        : "✨ Lebih dari 1 jawaban benar"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <div className="w-20 sm:w-28 h-2 bg-white/25 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ${
                        timerPercent > 35 ? "bg-amber-300" : "bg-rose-400"
                      }`}
                      style={{ width: `${timerPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-black min-w-[2.2rem] text-right">
                    {formatSeconds(timeLeft)}
                  </span>
                </div>
              </div>

              {currentQuestion.image_url && (
                <div className="mb-4 bg-white/95 p-2 rounded-2xl shadow-inner">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-h-56 mx-auto rounded-xl object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 items-center justify-center text-4xl shrink-0">
                  🦉
                </div>
                <h1 className="text-xl sm:text-2xl font-black leading-snug tracking-tight">
                  <FormattedText text={currentQuestion.question_text} />
                </h1>
              </div>
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`p-4 rounded-2xl border-2 border-b-4 flex items-center justify-center gap-3 font-black text-base sm:text-lg shadow-sm ${
                    feedback === "CORRECT"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-rose-50 border-rose-300 text-rose-700"
                  }`}
                >
                  {feedback === "CORRECT" ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                      <span>
                        {t("correctFeedback")} (+{lastPoints}{" "}
                        {lang === "EN" ? "Stars" : "Bintang"})
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
                      <span>
                        {feedback === "TIMEOUT"
                          ? `${t("timeoutFeedback")} `
                          : `${t("wrongFeedback")} `}
                        {t("correctAnswerIs")}{" "}
                        {validCorrectKeys.join(lang === "EN" ? " & " : " & ")}
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 px-1">
                {t("optionsHeader")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(["A", "B", "C", "D"] as OptionKey[]).map((key) => {
                  const isEliminated = eliminatedOptions.includes(key);
                  const isCorrectOption =
                    feedback && validCorrectKeys.includes(key);
                  const style = OPTION_STYLES[key];

                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 border-b-4 transition-all duration-200 ${
                        isEliminated
                          ? "opacity-35 line-through bg-slate-100 border-slate-200"
                          : isCorrectOption
                            ? "bg-emerald-50 border-emerald-400 border-b-emerald-500 scale-[1.02] shadow-md"
                            : `${style.cardBg} ${style.cardBorder} shadow-xs`
                      }`}
                    >
                      <span
                        className={`w-10 h-10 shrink-0 rounded-xl ${style.badgeBg} text-white font-black text-base flex items-center justify-center shadow-xs`}
                      >
                        {key}
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-slate-700 whitespace-normal break-words leading-snug pt-1">
                        <FormattedText text={currentQuestion.options[key]} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 px-1">
                {t("powerupsHeader")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={activateFiftyFifty}
                  disabled={usedFiftyFifty || Boolean(feedback)}
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 border-b-4 text-left transition ${
                    usedFiftyFifty
                      ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                      : "bg-[#F3EFFF] hover:bg-[#EAE3FF] border-[#D8CEFF] border-b-[#C2B2FF] cursor-pointer active:translate-y-0.5"
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-[#7C5CFC] text-white flex items-center justify-center shrink-0">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      {lang === "EN"
                        ? "50:50 Remove 2 Wrong"
                        : "50:50 Hapus 2 Salah"}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {usedFiftyFifty
                        ? t("alreadyUsed")
                        : lang === "EN"
                          ? "Eliminate 2 decoy targets"
                          : "Hilangkan 2 target pengecoh"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={activateQueenBoost}
                  disabled={isQueenBoostDisabled}
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 border-b-4 text-left transition ${
                    isQueenBoostDisabled
                      ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                      : "bg-[#FFF5E6] hover:bg-[#FFEDD1] border-[#FFE0B2] border-b-[#FFCC80] cursor-pointer active:translate-y-0.5"
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FF9800] text-white flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      {t("queenBoostTitle")}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {activeGameMode !== "CHESS"
                        ? lang === "EN"
                          ? "Available in Chess mode only"
                          : "Khusus untuk mode Catur"
                        : usedQueenBoost
                          ? t("alreadyUsed")
                          : lang === "EN"
                            ? "Slide freely in any direction"
                            : "Bebas meluncur ke segala arah"}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Arena Papan Interaktif (Semua 10 Mode Terhubung) */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-md">
            {/* Switcher Cepat 10 Mode Khusus Demo */}
            {isDemo && (
              <div className="mb-3.5 pb-3 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  {lang === "EN"
                    ? "Switch Arena Mode (Live Demo)"
                    : "Pilih Mode Arena (Demo Langsung)"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_GAME_MODES.map((m) => {
                    const isSelected = activeGameMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={Boolean(feedback)}
                        onClick={() => handleSelectDemoMode(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black border transition cursor-pointer disabled:opacity-50 ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeGameMode === "CHESS" && (
              <ChessQuizBoard
                key={boardKey}
                question={currentQuestion}
                activePiece={activePiece}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "MIRROR" && (
              <TactiMirrorBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "CIRCUIT" && (
              <TactiCircuitBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "STEALTH" && (
              <TactiStealthBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "SLIDE" && (
              <TactiSlideBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "COLLAPSE" && (
              <TactiCollapseBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "FLUX" && (
              <TactiFluxBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "SWITCH" && (
              <TactiSwitchBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "PORTAL" && (
              <TactiPortalBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            {activeGameMode === "SHIFT" && (
              <TactiShiftBoard
                key={boardKey}
                question={currentQuestion}
                eliminatedOptions={eliminatedOptions}
                disabled={Boolean(feedback)}
                onAnswer={handleAnswer}
              />
            )}

            <div className="mt-3.5 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-xs font-bold text-amber-800 leading-snug">
                💡{" "}
                {lang === "EN" ? currentModeInfo.tipEn : currentModeInfo.tipId}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
