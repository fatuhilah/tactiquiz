"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, Eye, EyeOff, Sparkles } from "lucide-react";
import { sound } from "@/lib/sound";

export type PieceType =
  | "PAWN"
  | "KNIGHT"
  | "BISHOP"
  | "ROOK"
  | "QUEEN"
  | "KING";
export type OptionKey = "A" | "B" | "C" | "D";

export interface QuestionData {
  id: string;
  question_text: string;
  options: Record<OptionKey, string>;
  correct_option: OptionKey;
  piece_type: PieceType;
  obstacles?: number;
}

interface Position {
  row: number;
  col: number;
}

interface ChessQuizBoardProps {
  question: QuestionData;
  activePiece?: PieceType;
  eliminatedOptions?: OptionKey[];
  disabled?: boolean;
  onAnswer: (
    selectedOption: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => void;
}

export const PIECE_META: Record<
  PieceType,
  { symbol: string; name: string; hint: string; badgeColor: string }
> = {
  PAWN: {
    symbol: "♟",
    name: "Pion Cilik",
    hint: "Jalan 1 kotak lurus, tangkap jawaban 1 kotak serong!",
    badgeColor: "bg-emerald-500",
  },
  KNIGHT: {
    symbol: "♞",
    name: "Kuda Lompat",
    hint: "Melompat bentuk huruf L (bisa melompati balok)!",
    badgeColor: "bg-amber-500",
  },
  BISHOP: {
    symbol: "♝",
    name: "Gajah Peluncur",
    hint: "Meluncur miring diagonal ke arah jawaban!",
    badgeColor: "bg-sky-500",
  },
  ROOK: {
    symbol: "♜",
    name: "Benteng Kokoh",
    hint: "Meluncur lurus ke atas, bawah, kiri, atau kanan!",
    badgeColor: "bg-indigo-500",
  },
  QUEEN: {
    symbol: "♛",
    name: "Ratu Super",
    hint: "Bebas meluncur lurus maupun miring ke mana saja!",
    badgeColor: "bg-purple-500",
  },
  KING: {
    symbol: "♚",
    name: "Raja Bijak",
    hint: "Melangkah santai 1 kotak ke segala arah!",
    badgeColor: "bg-rose-500",
  },
};

export const OPTION_STYLES: Record<
  OptionKey,
  {
    badgeBg: string;
    cardBg: string;
    cardBorder: string;
    tokenBg: string;
    tokenBorder: string;
  }
> = {
  A: {
    badgeBg: "bg-[#FF5A79]",
    cardBg: "bg-white hover:bg-rose-50/70",
    cardBorder: "border-rose-200 border-b-rose-300",
    tokenBg: "from-[#FF6B88] to-[#FF4769]",
    tokenBorder: "border-b-[#D62E4E]",
  },
  B: {
    badgeBg: "bg-[#2B95FF]",
    cardBg: "bg-white hover:bg-sky-50/70",
    cardBorder: "border-sky-200 border-b-sky-300",
    tokenBg: "from-[#47A6FF] to-[#1E82F5]",
    tokenBorder: "border-b-[#1262C4]",
  },
  C: {
    badgeBg: "bg-[#FFAE19]",
    cardBg: "bg-white hover:bg-amber-50/70",
    cardBorder: "border-amber-200 border-b-amber-300",
    tokenBg: "from-[#FFC13B] to-[#F59E0B]",
    tokenBorder: "border-b-[#C77700]",
  },
  D: {
    badgeBg: "bg-[#22C55E]",
    cardBg: "bg-white hover:bg-emerald-50/70",
    cardBorder: "border-emerald-200 border-b-emerald-300",
    tokenBg: "from-[#34D374] to-[#16A34A]",
    tokenBorder: "border-b-[#117A37]",
  },
};

const BOARD_SIZE = 6;
const COL_LABELS = ["A", "B", "C", "D", "E", "F"];

function isSamePos(a: Position, b: Position) {
  return a.row === b.row && a.col === b.col;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function getSingleStepMoves(
  pos: Position,
  piece: PieceType,
  obstacles: Position[],
  targetPositions: Position[],
): Position[] {
  const valid: Position[] = [];
  const hasObstacle = (r: number, c: number) =>
    obstacles.some((o) => o.row === r && o.col === c);
  const hasTarget = (r: number, c: number) =>
    targetPositions.some((t) => t.row === r && t.col === c);

  if (piece === "PAWN") {
    const stepDirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    stepDirs.forEach(([dr, dc]) => {
      const r = pos.row + dr;
      const c = pos.col + dc;
      if (inBounds(r, c) && !hasObstacle(r, c) && !hasTarget(r, c)) {
        valid.push({ row: r, col: c });
      }
    });
    const captureDirs = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    captureDirs.forEach(([dr, dc]) => {
      const r = pos.row + dr;
      const c = pos.col + dc;
      if (inBounds(r, c) && !hasObstacle(r, c) && hasTarget(r, c)) {
        valid.push({ row: r, col: c });
      }
    });
    return valid;
  }

  if (piece === "KING") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = pos.row + dr;
        const c = pos.col + dc;
        if (inBounds(r, c) && !hasObstacle(r, c)) {
          valid.push({ row: r, col: c });
        }
      }
    }
    return valid;
  }

  if (piece === "KNIGHT") {
    const jumps = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    jumps.forEach(([dr, dc]) => {
      const r = pos.row + dr;
      const c = pos.col + dc;
      if (inBounds(r, c) && !hasObstacle(r, c)) {
        valid.push({ row: r, col: c });
      }
    });
    return valid;
  }

  const directions: [number, number][] = [];
  if (piece === "ROOK" || piece === "QUEEN") {
    directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }
  if (piece === "BISHOP" || piece === "QUEEN") {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }

  directions.forEach(([dr, dc]) => {
    let r = pos.row + dr;
    let c = pos.col + dc;
    while (inBounds(r, c)) {
      if (hasObstacle(r, c)) break;
      valid.push({ row: r, col: c });
      if (hasTarget(r, c)) break;
      r += dr;
      c += dc;
    }
  });

  return valid;
}

function generateTacticalBoard(piece: PieceType, desiredObstacles: number) {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

  for (let attempt = 0; attempt < 30; attempt++) {
    const obsCount = attempt < 20 ? desiredObstacles : 0;
    const startPos: Position = {
      row: Math.floor(Math.random() * (BOARD_SIZE - 2)) + 1,
      col: Math.floor(Math.random() * (BOARD_SIZE - 2)) + 1,
    };

    const obstacles: Position[] = [];
    while (obstacles.length < obsCount) {
      const candidate = {
        row: Math.floor(Math.random() * BOARD_SIZE),
        col: Math.floor(Math.random() * BOARD_SIZE),
      };
      if (
        !isSamePos(candidate, startPos) &&
        !obstacles.some((o) => isSamePos(o, candidate))
      ) {
        obstacles.push(candidate);
      }
    }

    const placedTargets: Partial<Record<OptionKey, Position>> = {};
    let allPlaced = true;

    for (const key of optionKeys) {
      const currentTargetsList = Object.values(placedTargets) as Position[];
      const visited = new Set<string>([`${startPos.row},${startPos.col}`]);
      const queue: { pos: Position; dist: number }[] = [
        { pos: startPos, dist: 0 },
      ];
      const candidates: { pos: Position; dist: number }[] = [];

      while (queue.length > 0) {
        const { pos, dist } = queue.shift()!;
        if (dist >= 3) continue;

        const moves = getSingleStepMoves(
          pos,
          piece,
          obstacles,
          currentTargetsList,
        );
        for (const m of moves) {
          const id = `${m.row},${m.col}`;
          const hitsExistingTarget = currentTargetsList.some((t) =>
            isSamePos(t, m),
          );
          if (hitsExistingTarget) continue;

          if (!visited.has(id)) {
            visited.add(id);
            const isDiagonalStep = m.row !== pos.row && m.col !== pos.col;
            if (piece !== "PAWN" || isDiagonalStep) {
              candidates.push({ pos: m, dist: dist + 1 });
            }
            if (piece !== "PAWN" || !isDiagonalStep) {
              queue.push({ pos: m, dist: dist + 1 });
            }
          }
        }
      }

      if (candidates.length === 0) {
        allPlaced = false;
        break;
      }

      const weighted = candidates.flatMap((c) => (c.dist <= 2 ? [c, c] : [c]));
      const chosen = weighted[Math.floor(Math.random() * weighted.length)];
      placedTargets[key] = chosen.pos;
    }

    if (allPlaced) {
      return {
        startPos,
        obstacles,
        targets: placedTargets as Record<OptionKey, Position>,
      };
    }
  }

  return {
    startPos: { row: 2, col: 2 },
    obstacles: [],
    targets: {
      A: { row: 1, col: 1 },
      B: { row: 1, col: 3 },
      C: { row: 3, col: 1 },
      D: { row: 3, col: 3 },
    },
  };
}

export default function ChessQuizBoard({
  question,
  activePiece,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: ChessQuizBoardProps) {
  const basePiece: PieceType =
    question?.piece_type && PIECE_META[question.piece_type]
      ? question.piece_type
      : "KNIGHT";

  const resolvedPiece: PieceType =
    activePiece && PIECE_META[activePiece] ? activePiece : basePiece;

  const pieceInfo = PIECE_META[resolvedPiece];

  const [playerPos, setPlayerPos] = useState<Position>({ row: 2, col: 2 });
  const [obstacles, setObstacles] = useState<Position[]>([]);
  const [targets, setTargets] = useState<Record<OptionKey, Position>>({
    A: { row: 0, col: 0 },
    B: { row: 0, col: 5 },
    C: { row: 5, col: 0 },
    D: { row: 5, col: 5 },
  });
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const [showHints, setShowHints] = useState<boolean>(true);
  const [answeredOption, setAnsweredOption] = useState<OptionKey | null>(null);

  useEffect(() => {
    const generated = generateTacticalBoard(
      basePiece,
      question?.obstacles ?? 3,
    );
    setPlayerPos(generated.startPos);
    setObstacles(generated.obstacles);
    setTargets(generated.targets);
    setMovesUsed(0);
    setShowHints(true);
    setAnsweredOption(null);
  }, [question, basePiece]);

  const activeTargetPositions = useMemo(() => {
    return (Object.keys(targets) as OptionKey[])
      .filter((key) => !eliminatedOptions.includes(key))
      .map((key) => targets[key]);
  }, [targets, eliminatedOptions]);

  const legalMoves = useMemo(() => {
    if (answeredOption || disabled) return [];
    return getSingleStepMoves(
      playerPos,
      resolvedPiece,
      obstacles,
      activeTargetPositions,
    );
  }, [
    playerPos,
    resolvedPiece,
    obstacles,
    activeTargetPositions,
    answeredOption,
    disabled,
  ]);

  const handleSquareClick = (row: number, col: number) => {
    if (answeredOption || disabled) return;

    if (playerPos.row === row && playerPos.col === col) {
      setShowHints((prev) => !prev);
      return;
    }

    const isLegal = legalMoves.some((m) => m.row === row && m.col === col);
    if (!isLegal) return;

    const hitOption = (Object.keys(targets) as OptionKey[]).find(
      (key) =>
        !eliminatedOptions.includes(key) &&
        targets[key]?.row === row &&
        targets[key]?.col === col,
    );

    const nextMoves = movesUsed + 1;
    setMovesUsed(nextMoves);
    setPlayerPos({ row, col });

    if (hitOption) {
      setAnsweredOption(hitOption);
      const isCorrect = hitOption === question.correct_option;
      if (isCorrect) sound.playCorrect();
      else sound.playWrong();
      onAnswer(hitOption, isCorrect, nextMoves);
    } else {
      sound.playMove();
    }
  };

  return (
    <div className="flex flex-col w-full select-none">
      {/* Header Karakter Bidak */}
      <div className="flex items-center justify-between gap-2 bg-[#EEF6FF] border-2 border-[#D4E7FF] p-3 rounded-2xl mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl ${pieceInfo.badgeColor} text-white flex items-center justify-center text-3xl shadow-md border-b-4 border-black/20 shrink-0`}
          >
            {pieceInfo.symbol}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                {pieceInfo.name}
              </h3>
              {resolvedPiece !== basePiece && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500 text-white">
                  <Sparkles className="w-2.5 h-2.5" /> SUPER
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 leading-snug">
              {pieceInfo.hint}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 rounded-xl bg-white text-sky-600 border border-sky-200 shadow-xs">
            <Footprints className="w-3.5 h-3.5" />
            {movesUsed}
          </span>
          <button
            type="button"
            onClick={() => setShowHints((prev) => !prev)}
            title="Tampilkan/Sembunyikan Petunjuk Langkah"
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-600 border border-slate-200 transition cursor-pointer"
          >
            {showHints ? (
              <Eye className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {showHints ? "Bantuan" : "Sembunyi"}
            </span>
          </button>
        </div>
      </div>

      {/* Papan Catur Cerah Ramah Anak */}
      <div className="p-2.5 sm:p-3 rounded-3xl bg-[#DCEBFA] border-2 border-[#C2DDF8] border-b-[6px] shadow-inner w-full">
        <div className="grid grid-cols-6 w-full aspect-square rounded-2xl overflow-hidden border-2 border-[#B3D4F5] bg-white shadow-sm">
          {Array.from({ length: BOARD_SIZE }).map((_, row) =>
            Array.from({ length: BOARD_SIZE }).map((__, col) => {
              const isDark = (row + col) % 2 === 1;
              const isPlayerHere =
                playerPos.row === row && playerPos.col === col;
              const isObstacle = obstacles.some(
                (o) => o.row === row && o.col === col,
              );

              const targetKey = (Object.keys(targets) as OptionKey[]).find(
                (key) =>
                  !eliminatedOptions.includes(key) &&
                  targets[key]?.row === row &&
                  targets[key]?.col === col,
              );

              const isLegalMove =
                showHints &&
                legalMoves.some((m) => m.row === row && m.col === col);

              let tileBg = isDark
                ? "bg-[#D6E9FD] hover:bg-[#C6E0FC]"
                : "bg-[#FFFFFF] hover:bg-[#F4F9FF]";

              if (answeredOption && isPlayerHere) {
                tileBg =
                  answeredOption === question.correct_option
                    ? "bg-emerald-200"
                    : "bg-rose-200";
              }

              return (
                <button
                  type="button"
                  key={`${row}-${col}`}
                  onClick={() => handleSquareClick(row, col)}
                  className={`relative flex items-center justify-center transition-colors duration-150 ${tileBg} ${
                    isLegalMove ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  {/* Koordinat Sudut Lembut */}
                  {col === 0 && (
                    <span className="absolute top-1 left-1.5 text-[10px] font-extrabold text-sky-900/30 pointer-events-none">
                      {BOARD_SIZE - row}
                    </span>
                  )}
                  {row === BOARD_SIZE - 1 && (
                    <span className="absolute bottom-0.5 right-1.5 text-[10px] font-extrabold text-sky-900/30 pointer-events-none">
                      {COL_LABELS[col]}
                    </span>
                  )}

                  {/* Balok Rintangan Kayu/Pagar Lucu */}
                  {isObstacle && (
                    <div className="w-[74%] h-[74%] rounded-2xl bg-gradient-to-b from-amber-200 to-amber-300 border-2 border-amber-400 border-b-4 shadow-xs flex items-center justify-center">
                      <span className="text-lg sm:text-xl select-none">🧱</span>
                    </div>
                  )}

                  {/* Titik Hijau Bouncy Petunjuk Langkah */}
                  {isLegalMove && !targetKey && !isObstacle && (
                    <motion.span
                      animate={{ scale: [0.85, 1.15, 0.85] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-400 border-2 border-white shadow-md"
                    />
                  )}

                  {/* Ring Sorotan jika Target Bisa Dimakan */}
                  {isLegalMove && targetKey && (
                    <span className="absolute inset-1 rounded-2xl border-[3px] border-dashed border-amber-400 animate-spin [animation-duration:7s] pointer-events-none" />
                  )}

                  {/* Token Jawaban A, B, C, D Gaya Tombol 3D */}
                  <AnimatePresence>
                    {targetKey && !isPlayerHere && (
                      <motion.div
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 20,
                        }}
                        className={`flex items-center justify-center w-[76%] h-[76%] rounded-2xl bg-gradient-to-b ${OPTION_STYLES[targetKey].tokenBg} text-white font-black text-lg sm:text-xl shadow-md border-2 border-white/60 border-b-4 ${OPTION_STYLES[targetKey].tokenBorder}`}
                      >
                        {targetKey}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bidak Pemain */}
                  {isPlayerHere && (
                    <motion.div
                      layoutId="active-chess-piece"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 26,
                      }}
                      className="z-10 flex items-center justify-center w-[80%] h-[80%] rounded-2xl bg-gradient-to-b from-[#FFE066] to-[#FFB800] text-slate-900 text-3xl sm:text-4xl shadow-lg border-2 border-white border-b-4 border-b-[#CC8E00]"
                    >
                      {pieceInfo.symbol}
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
