"use client";

import React from "react";
import ChessQuizBoard, {
  OptionKey,
  PieceType,
  QuestionData,
} from "@/components/ChessQuizBoard";
import TactiMirrorBoard from "@/components/boards/TactiMirrorBoard";
import TactiStealthBoard from "@/components/boards/TactiStealthBoard";
import TactiCircuitBoard from "@/components/boards/TactiCircuitBoard";
import TactiSlideBoard from "@/components/boards/TactiSlideBoard";
import TactiCollapseBoard from "@/components/boards/TactiCollapseBoard";
import TactiFluxBoard from "@/components/boards/TactiFluxBoard";
import TactiSwitchBoard from "@/components/boards/TactiSwitchBoard";
import TactiPortalBoard from "@/components/boards/TactiPortalBoard";
import TactiShiftBoard from "@/components/boards/TactiShiftBoard";
import { ConcreteGameMode } from "@/lib/gameModes";

interface TactiBoardDispatcherProps {
  mode: ConcreteGameMode;
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

export default function TactiBoardDispatcher({
  mode,
  question,
  activePiece,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiBoardDispatcherProps) {
  switch (mode) {
    case "MIRROR":
      return (
        <TactiMirrorBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "STEALTH":
      return (
        <TactiStealthBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "CIRCUIT":
      return (
        <TactiCircuitBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "SLIDE":
      return (
        <TactiSlideBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "COLLAPSE":
      return (
        <TactiCollapseBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "FLUX":
      return (
        <TactiFluxBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "SWITCH":
      return (
        <TactiSwitchBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "PORTAL":
      return (
        <TactiPortalBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "SHIFT":
      return (
        <TactiShiftBoard
          question={question}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
    case "CHESS":
    default:
      return (
        <ChessQuizBoard
          question={question}
          activePiece={activePiece}
          eliminatedOptions={eliminatedOptions}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      );
  }
}
