"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Sparkles, Send, Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { PIECE_META_I18N } from "@/lib/i18n";
import { sound } from "@/lib/sound";

export type OptionKey = "A" | "B" | "C" | "D";
export type PieceType =
  | "KNIGHT"
  | "BISHOP"
  | "ROOK"
  | "QUEEN"
  | "KING"
  | "PAWN";

export interface QuestionData {
  id: string;
  question_text: string;
  image_url?: string | null;
  options: Record<OptionKey, string>;
  correct_option: OptionKey;
  correct_options?: OptionKey[];
  allow_multiple?: boolean;
  time_limit: number;
  piece_type: PieceType;
  obstacles: number;
}

export const PIECE_META: Record<
  PieceType,
  {
    name: string;
    symbol: string;
    badgeColor: string;
    moveDesc: string;
    moveDescEn: string;
  }
> = {
  KNIGHT: {
    name: "Knight (Kuda)",
    symbol: "♞",
    badgeColor: "bg-indigo-500",
    moveDesc: "Melangkah bentuk huruf L & bisa melompati rintangan",
    moveDescEn: "Moves in an L-shape and can jump over obstacles",
  },
  BISHOP: {
    name: "Bishop (Gajah)",
    symbol: "♝",
    badgeColor: "bg-emerald-500",
    moveDesc: "Meluncur diagonal bebas ke segala arah",
    moveDescEn: "Slides diagonally in any direction",
  },
  ROOK: {
    name: "Rook (Benteng)",
    symbol: "♜",
    badgeColor: "bg-amber-500",
    moveDesc: "Meluncur lurus vertikal & horizontal",
    moveDescEn: "Slides straight vertically & horizontally",
  },
  QUEEN: {
    name: "Queen (Ratu)",
    symbol: "♛",
    badgeColor: "bg-purple-500",
    moveDesc: "Kombinasi Benteng & Gajah (8 arah bebas)",
    moveDescEn: "Combines Rook & Bishop (all 8 directions)",
  },
  KING: {
    name: "King (Raja)",
    symbol: "♚",
    badgeColor: "bg-rose-500",
    moveDesc: "Melangkah 1 petak ke segala arah",
    moveDescEn: "Moves 1 square in any direction",
  },
  PAWN: {
    name: "Pawn (Pion)",
    symbol: "♟",
    badgeColor: "bg-sky-500",
    moveDesc: "Jalan 1 petak lurus (kotak kosong), makan opsi 1 petak diagonal",
    moveDescEn:
      "Walks 1 square straight (empty), captures options 1 square diagonally",
  },
};

export const OPTION_STYLES: Record<
  OptionKey,
  {
    badgeBg: string;
    cardBg: string;
    cardBorder: string;
  }
> = {
  A: {
    badgeBg: "bg-[#2B90FF]",
    cardBg: "bg-[#F0F7FF]",
    cardBorder: "border-[#BAE0FF] border-b-[#91CAFF]",
  },
  B: {
    badgeBg: "bg-[#22C55E]",
    cardBg: "bg-[#F0FDF4]",
    cardBorder: "border-[#BBF7D0] border-b-[#86EFAC]",
  },
  C: {
    badgeBg: "bg-[#FF9800]",
    cardBg: "bg-[#FFF8EB]",
    cardBorder: "border-[#FDE68A] border-b-[#FCD34D]",
  },
  D: {
    badgeBg: "bg-[#8B5CF6]",
    cardBg: "bg-[#F5F3FF]",
    cardBorder: "border-[#DDD6FE] border-b-[#C4B5FD]",
  },
};

interface ChessQuizBoardProps {
  question: QuestionData;
  activePiece: PieceType;
  eliminatedOptions?: OptionKey[];
  disabled?: boolean;
  onAnswer: (
    selected: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => void;
}

interface Coord {
  r: number;
  c: number;
}

const BOARD_SIZE = 6;
const START_POS: Coord = { r: 5, c: 0 };

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function parseBoardOptionKeys(
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

function getValidMoves(
  pos: Coord,
  piece: PieceType,
  obstacles: Set<string>,
  activeTokens: Set<string>,
): Set<string> {
  const valid = new Set<string>();
  const inBounds = (r: number, c: number) =>
    r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

  const addSlideRays = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let nr = pos.r + dr;
      let nc = pos.c + dc;
      while (inBounds(nr, nc)) {
        const k = coordKey(nr, nc);
        if (obstacles.has(k)) break;
        valid.add(k);
        // Berhenti di opsi pertama agar bidak tidak menembus ke belakangnya
        if (activeTokens.has(k)) break;
        nr += dr;
        nc += dc;
      }
    }
  };

  switch (piece) {
    case "KNIGHT": {
      const jumps: [number, number][] = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const nr = pos.r + dr;
        const nc = pos.c + dc;
        const k = coordKey(nr, nc);
        if (inBounds(nr, nc) && !obstacles.has(k)) {
          valid.add(k);
        }
      }
      break;
    }
    case "BISHOP":
      addSlideRays([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    case "ROOK":
      addSlideRays([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    case "QUEEN":
      addSlideRays([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    case "KING": {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = pos.r + dr;
          const nc = pos.c + dc;
          const k = coordKey(nr, nc);
          if (inBounds(nr, nc) && !obstacles.has(k)) {
            valid.add(k);
          }
        }
      }
      break;
    }
    case "PAWN": {
      // 1. Jalan lurus 1 petak (HANYA ke petak kosong, tidak boleh menabrak opsi)
      const walkSteps: [number, number][] = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of walkSteps) {
        const nr = pos.r + dr;
        const nc = pos.c + dc;
        const k = coordKey(nr, nc);
        if (inBounds(nr, nc) && !obstacles.has(k) && !activeTokens.has(k)) {
          valid.add(k);
        }
      }

      // 2. Makan / tangkap opsi jawaban secara diagonal (HANYA jika ada opsi aktif di diagonal)
      const captureSteps: [number, number][] = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [dr, dc] of captureSteps) {
        const nr = pos.r + dr;
        const nc = pos.c + dc;
        const k = coordKey(nr, nc);
        if (inBounds(nr, nc) && !obstacles.has(k) && activeTokens.has(k)) {
          valid.add(k);
        }
      }
      break;
    }
  }

  return valid;
}

// Mengecek apakah satu target opsi tertentu benar-benar bisa dicapai tanpa terpaksa menginjak 3 opsi lainnya
function canReachSingleTarget(
  pieceType: PieceType,
  targetCoord: Coord,
  otherTokenCoords: Set<string>,
  obstacles: Set<string>,
): boolean {
  const targetKey = coordKey(targetCoord.r, targetCoord.c);
  const startKey = coordKey(START_POS.r, START_POS.c);

  // Gabungkan tembok bata + 3 opsi lain sebagai penghalang mutlak
  const combinedBlockers = new Set<string>(obstacles);
  otherTokenCoords.forEach((k) => combinedBlockers.add(k));

  if (combinedBlockers.has(startKey) || combinedBlockers.has(targetKey)) {
    return false;
  }

  // Khusus Pion: pastikan setelah menangkap target, pion punya minimal 1 petak kosong lurus untuk keluar (penting untuk Multiple Answers)
  if (pieceType === "PAWN") {
    const hasExit = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(([dr, dc]) => {
      const nr = targetCoord.r + dr;
      const nc = targetCoord.c + dc;
      return (
        nr >= 0 &&
        nr < BOARD_SIZE &&
        nc >= 0 &&
        nc < BOARD_SIZE &&
        !combinedBlockers.has(coordKey(nr, nc))
      );
    });
    if (!hasExit) return false;
  }

  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [START_POS];
  const onlyTargetSet = new Set<string>([targetKey]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = coordKey(curr.r, curr.c);
    if (currKey === targetKey) return true;

    const moves = getValidMoves(
      curr,
      pieceType,
      combinedBlockers,
      onlyTargetSet,
    );
    for (const nextKey of moves) {
      if (nextKey === targetKey) return true;
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        const [rStr, cStr] = nextKey.split(",");
        queue.push({ r: Number(rStr), c: Number(cStr) });
      }
    }
  }

  return false;
}

function isLayoutPlayable(
  pieceType: PieceType,
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
): boolean {
  const keys: OptionKey[] = ["A", "B", "C", "D"];
  return keys.every((targetOpt) => {
    const others = new Set<string>();
    keys.forEach((k) => {
      if (k !== targetOpt) {
        others.add(coordKey(tokens[k].r, tokens[k].c));
      }
    });
    const reachableByBase = canReachSingleTarget(
      pieceType,
      tokens[targetOpt],
      others,
      obstacles,
    );
    const reachableByQueen =
      pieceType === "QUEEN"
        ? reachableByBase
        : canReachSingleTarget("QUEEN", tokens[targetOpt], others, obstacles);

    return reachableByBase && reachableByQueen;
  });
}

function generateBoardLayout(
  pieceType: PieceType,
  obstacleCount: number,
): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
} {
  const startParity = (START_POS.r + START_POS.c) % 2;
  const candidateCells: Coord[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (r === START_POS.r && c === START_POS.c) continue;
      if (pieceType === "BISHOP") {
        if ((r + c) % 2 !== startParity) continue;
        // Jangan taruh opsi tepat di (4, 1) karena itu satu-satunya pintu keluar Gajah dari (5, 0)
        if (r === 4 && c === 1) continue;
      }
      candidateCells.push({ r, c });
    }
  }

  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(0, Math.min(5, obstacleCount || 0));

  // Coba hingga 150 kombinasi acak yang lolos uji BFS 4 arah independen
  for (let attempt = 0; attempt < 150; attempt++) {
    const shuffled = [...candidateCells].sort(() => Math.random() - 0.5);
    const tokens = {} as Record<OptionKey, Coord>;
    const occupied = new Set<string>([coordKey(START_POS.r, START_POS.c)]);

    optionKeys.forEach((key, idx) => {
      const cell = shuffled[idx] || { r: 0, c: idx + 1 };
      tokens[key] = cell;
      occupied.add(coordKey(cell.r, cell.c));
    });

    // Pastikan tanpa rintangan pun keempat opsi sudah bebas dicapai tanpa saling mengunci
    if (!isLayoutPlayable(pieceType, tokens, new Set())) {
      continue;
    }

    const freeForObstacles: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const k = coordKey(r, c);
        if (!occupied.has(k)) {
          if (Math.abs(r - START_POS.r) <= 1 && Math.abs(c - START_POS.c) <= 1)
            continue;
          freeForObstacles.push({ r, c });
        }
      }
    }

    const shuffledFree = [...freeForObstacles].sort(() => Math.random() - 0.5);
    const obstacles = new Set<string>();

    for (const candidate of shuffledFree) {
      if (obstacles.size >= clampedObstacles) break;
      const key = coordKey(candidate.r, candidate.c);
      obstacles.add(key);

      if (!isLayoutPlayable(pieceType, tokens, obstacles)) {
        obstacles.delete(key);
      }
    }

    if (isLayoutPlayable(pieceType, tokens, obstacles)) {
      return { tokens, obstacles };
    }
  }

  // Fallback aman 100% terjamin jika seluruh percobaan acak gagal
  const fallbackTokens: Record<OptionKey, Coord> =
    pieceType === "BISHOP"
      ? {
          A: { r: 1, c: 0 },
          B: { r: 0, c: 3 },
          C: { r: 2, c: 5 },
          D: { r: 5, c: 4 },
        }
      : {
          A: { r: 1, c: 1 },
          B: { r: 1, c: 4 },
          C: { r: 4, c: 1 },
          D: { r: 4, c: 4 },
        };

  return { tokens: fallbackTokens, obstacles: new Set() };
}

export default function ChessQuizBoard({
  question,
  activePiece,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: ChessQuizBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles } = useMemo(
    () => generateBoardLayout(question.piece_type, question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [piecePos, setPiecePos] = useState<Coord>(START_POS);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const [capturedOptions, setCapturedOptions] = useState<OptionKey[]>([]);
  const [wrongCaptured, setWrongCaptured] = useState<OptionKey | null>(null);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);

  useEffect(() => {
    setPiecePos(START_POS);
    setMovesUsed(0);
    setCapturedOptions([]);
    setWrongCaptured(null);
    setBoardLocked(false);
  }, [question.id]);

  const isInteractionDisabled = disabled || boardLocked;

  const activeTokenCoords = useMemo(() => {
    const coords = new Set<string>();
    (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
      if (eliminatedOptions.includes(opt) || capturedOptions.includes(opt))
        return;
      const tPos = tokens[opt];
      if (tPos) coords.add(coordKey(tPos.r, tPos.c));
    });
    return coords;
  }, [tokens, eliminatedOptions, capturedOptions]);

  const validMoves = useMemo(() => {
    if (isInteractionDisabled) return new Set<string>();
    return getValidMoves(piecePos, activePiece, obstacles, activeTokenCoords);
  }, [
    piecePos,
    activePiece,
    obstacles,
    activeTokenCoords,
    isInteractionDisabled,
  ]);

  const handleCellClick = (r: number, c: number) => {
    if (isInteractionDisabled) return;

    const targetKey = coordKey(r, c);
    if (!validMoves.has(targetKey)) return;

    const nextMoves = movesUsed + 1;
    setPiecePos({ r, c });
    setMovesUsed(nextMoves);

    const hitOption = (["A", "B", "C", "D"] as OptionKey[]).find((opt) => {
      if (eliminatedOptions.includes(opt)) return false;
      if (capturedOptions.includes(opt)) return false;
      const tPos = tokens[opt];
      return tPos && tPos.r === r && tPos.c === c;
    });

    if (!hitOption) {
      sound.playMove();
      return;
    }

    if (!isMultiple) {
      const isCorrect = validCorrectKeys.includes(hitOption);
      if (isCorrect) {
        sound.playCorrect();
        setCapturedOptions([hitOption]);
      } else {
        sound.playWrong();
        setWrongCaptured(hitOption);
      }
      setBoardLocked(true);
      onAnswer(hitOption, isCorrect, nextMoves);
      return;
    }

    // Mode Multiple Answers: biarkan lanjut meski pilihan pertama salah
    const nextCaptured = capturedOptions.includes(hitOption)
      ? capturedOptions
      : [...capturedOptions, hitOption];
    setCapturedOptions(nextCaptured);

    if (nextCaptured.length >= validCorrectKeys.length) {
      const allCollected =
        nextCaptured.length === validCorrectKeys.length &&
        validCorrectKeys.every((key) => nextCaptured.includes(key));

      if (allCollected) {
        sound.playCorrect();
        setBoardLocked(true);
        onAnswer(nextCaptured[0], true, nextMoves);
      } else {
        sound.playWrong();
        const firstWrong =
          nextCaptured.find((key) => !validCorrectKeys.includes(key)) ||
          nextCaptured[0];
        setWrongCaptured(firstWrong);
        setBoardLocked(true);
        onAnswer(firstWrong, false, nextMoves);
      }
    } else {
      sound.playPowerUp();
    }
  };

  const handleManualSubmitMultiple = () => {
    if (isInteractionDisabled || !isMultiple || capturedOptions.length === 0)
      return;

    const allCollected =
      capturedOptions.length === validCorrectKeys.length &&
      validCorrectKeys.every((key) => capturedOptions.includes(key));

    if (allCollected) {
      sound.playCorrect();
      setBoardLocked(true);
      onAnswer(capturedOptions[0], true, Math.max(1, movesUsed));
    } else {
      sound.playWrong();
      const firstWrong =
        capturedOptions.find((key) => !validCorrectKeys.includes(key)) ||
        capturedOptions[0];
      setWrongCaptured(firstWrong);
      setBoardLocked(true);
      onAnswer(firstWrong, false, Math.max(1, movesUsed));
    }
  };

  const pieceMeta = PIECE_META[activePiece] || PIECE_META.KNIGHT;
  const localizedPiece = PIECE_META_I18N?.[lang]?.[activePiece] as
    | { name?: string; hint?: string }
    | undefined;
  const pieceName = localizedPiece?.name || pieceMeta.name;
  const pieceDesc =
    activePiece === "PAWN"
      ? lang === "EN"
        ? pieceMeta.moveDescEn
        : pieceMeta.moveDesc
      : localizedPiece?.hint ||
        (lang === "EN" ? pieceMeta.moveDescEn : pieceMeta.moveDesc);

  return (
    <div className="flex flex-col gap-3">
      {/* Header Info Bidak Aktif */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-[#F8FBFF] border border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl ${pieceMeta.badgeColor} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
          >
            {pieceMeta.symbol}
          </div>
          <div className="min-w-0">
            <p className="font-black text-xs sm:text-sm text-slate-800 truncate">
              {pieceName}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              {pieceDesc}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 shrink-0">
          {lang === "EN" ? `Moves: ${movesUsed}` : `Langkah: ${movesUsed}`}
        </span>
      </div>

      {/* Indikator Progres Khusus Multiple Answers */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {lang === "EN"
                ? `Multiple Answers: Collected ${capturedOptions.length} of ${validCorrectKeys.length}`
                : `Jawaban Ganda: Terkumpul ${capturedOptions.length} dari ${validCorrectKeys.length}`}
            </span>
            <div className="flex items-center gap-1.5">
              {capturedOptions.length === 0 ? (
                <span className="text-[11px] font-bold text-amber-700">
                  {lang === "EN"
                    ? "Capture all correct option letters on the board!"
                    : "Gerakkan bidak untuk menangkap semua huruf jawaban benar!"}
                </span>
              ) : (
                capturedOptions.map((opt) => {
                  if (!boardLocked) {
                    return (
                      <span
                        key={opt}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black"
                      >
                        <Check className="w-3 h-3" /> {opt}
                      </span>
                    );
                  }
                  const isRight = validCorrectKeys.includes(opt);
                  return (
                    <span
                      key={opt}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-white text-[11px] font-black ${
                        isRight ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    >
                      {isRight ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}{" "}
                      {opt}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {capturedOptions.length > 0 && !isInteractionDisabled && (
            <button
              type="button"
              onClick={handleManualSubmitMultiple}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black transition cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>{lang === "EN" ? "Lock Answer" : "Kunci"}</span>
            </button>
          )}
        </div>
      )}

      {/* Papan Catur 6x6 (Soft-Blue Frame & Koordinat Catur) */}
      <div className="w-full max-w-[410px] mx-auto p-3 sm:p-3.5 rounded-[28px] bg-[#E8F3FE] border-2 border-[#CBE3FC] shadow-sm select-none">
        <div className="aspect-square w-full grid grid-cols-6 grid-rows-6 rounded-2xl overflow-hidden border border-[#C5DDF8] bg-white">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isPlayerHere = piecePos.r === r && piecePos.c === c;
              const isObstacle = obstacles.has(key);
              const isValidMove = validMoves.has(key);

              const rankLabel = c === 0 ? String(BOARD_SIZE - r) : null;
              const fileLabel =
                r === BOARD_SIZE - 1 ? String.fromCharCode(65 + c) : null;

              const tokenHere = (["A", "B", "C", "D"] as OptionKey[]).find(
                (opt) => {
                  const tPos = tokens[opt];
                  return tPos && tPos.r === r && tPos.c === c;
                },
              );

              const isEliminated = tokenHere
                ? eliminatedOptions.includes(tokenHere)
                : false;
              const isAlreadyCaptured = tokenHere
                ? capturedOptions.includes(tokenHere)
                : false;
              const isWrongHit = tokenHere
                ? wrongCaptured === tokenHere
                : false;

              const showActiveToken =
                tokenHere && !isEliminated && !isAlreadyCaptured;

              let cellBg = isDark ? "bg-[#D7E9FD]" : "bg-white";
              if (isPlayerHere) {
                cellBg = "bg-white ring-1 ring-inset ring-slate-900 z-10";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isValidMove || isInteractionDisabled}
                  onClick={() => handleCellClick(r, c)}
                  className={`relative flex items-center justify-center transition-colors ${cellBg} ${
                    isValidMove && !isInteractionDisabled
                      ? "cursor-pointer hover:brightness-95"
                      : "cursor-default"
                  }`}
                >
                  {/* Koordinat Baris (6..1) */}
                  {rankLabel && (
                    <span className="absolute top-1 left-1.5 text-[10px] font-extrabold text-[#7AA3CC] leading-none pointer-events-none">
                      {rankLabel}
                    </span>
                  )}

                  {/* Koordinat Kolom (A..F) */}
                  {fileLabel && (
                    <span className="absolute bottom-1 right-1.5 text-[10px] font-extrabold text-[#7AA3CC] leading-none pointer-events-none">
                      {fileLabel}
                    </span>
                  )}

                  {/* Titik Hijau Langkah Valid */}
                  {isValidMove && !showActiveToken && !isPlayerHere && (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#10B981] shadow-[0_2px_5px_rgba(16,185,129,0.4)] pointer-events-none" />
                  )}

                  {/* Ubin Rintangan Bata 3D Kuning Emas */}
                  {isObstacle && (
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-b from-[#FDE047] to-[#FACC15] border-b-[4px] border-[#EAB308] shadow-xs flex items-center justify-center pointer-events-none">
                      <span className="text-lg sm:text-xl leading-none">
                        🧱
                      </span>
                    </div>
                  )}

                  {/* Badge Opsi Sudah Tertangkap */}
                  {tokenHere && isAlreadyCaptured && !isPlayerHere && (
                    <span
                      className={`w-7 h-7 rounded-lg border font-black text-xs flex items-center justify-center pointer-events-none ${
                        !boardLocked
                          ? "bg-indigo-500/20 border-indigo-500 text-indigo-800"
                          : validCorrectKeys.includes(tokenHere)
                            ? "bg-emerald-500/25 border-emerald-500 text-emerald-800"
                            : "bg-rose-500/25 border-rose-500 text-rose-800"
                      }`}
                    >
                      {!boardLocked
                        ? `●${tokenHere}`
                        : validCorrectKeys.includes(tokenHere)
                          ? `✓${tokenHere}`
                          : `✗${tokenHere}`}
                    </span>
                  )}

                  {/* Token Pilihan Jawaban Aktif dengan Efek Lompat (animate-bounce) */}
                  {showActiveToken && tokenHere && (
                    <span
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl ${
                        isWrongHit
                          ? "bg-rose-600"
                          : OPTION_STYLES[tokenHere].badgeBg
                      } text-white font-black text-sm sm:text-base flex items-center justify-center shadow-sm border-b-[4px] border-black/25 pointer-events-none ${
                        isValidMove ? "animate-bounce" : ""
                      }`}
                    >
                      {tokenHere}
                    </span>
                  )}

                  {/* Bidak Aktif 3D Kuning Emas */}
                  {isPlayerHere && (
                    <motion.div
                      layoutId={`chess-piece-${question.id}`}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 28,
                      }}
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-b from-[#FDE047] to-[#FACC15] border-b-[4px] border-[#CA8A04] text-slate-900 flex items-center justify-center text-2xl sm:text-[28px] shadow-sm z-20 pointer-events-none"
                    >
                      {pieceMeta.symbol}
                    </motion.div>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
