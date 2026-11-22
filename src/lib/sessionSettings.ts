import { TactiGameMode, normalizeGameMode } from "@/lib/gameModes";

export type HostingMode = "STUDENT_PACED" | "TEACHER_LED";
export type ShowAnswerEachMode = "OFF" | "FEEDBACK_ONLY" | "ON";
export type ShowAnswersAfterMode = "OFF" | "QUESTIONS_ONLY" | "ON";

export interface RoomSessionSettings {
  game_mode: TactiGameMode;
  question_timer: boolean;
  enable_powerups: boolean;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  redemption_questions: boolean;
  show_leaderboard: boolean;
  show_answer_each: ShowAnswerEachMode;
  show_answers_after: ShowAnswersAfterMode;
  anti_cheating: boolean;
  disable_right_click: boolean;
  disable_copy_paste: boolean;
}

export const DEFAULT_SESSION_SETTINGS: RoomSessionSettings = {
  game_mode: "CHESS",
  question_timer: true,
  enable_powerups: true,
  shuffle_questions: false,
  shuffle_answers: false,
  redemption_questions: false,
  show_leaderboard: true,
  show_answer_each: "ON",
  show_answers_after: "ON",
  anti_cheating: true,
  disable_right_click: true,
  disable_copy_paste: true,
};

function parseBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true" || val === 1 || val === "1") return true;
  if (val === "false" || val === 0 || val === "0") return false;
  return fallback;
}

function parseShowAnswerEach(val: unknown): ShowAnswerEachMode {
  if (typeof val === "string") {
    const upper = val.trim().toUpperCase();
    if (upper === "OFF" || upper === "FEEDBACK_ONLY" || upper === "ON") {
      return upper;
    }
  }
  return DEFAULT_SESSION_SETTINGS.show_answer_each;
}

function parseShowAnswersAfter(val: unknown): ShowAnswersAfterMode {
  if (typeof val === "string") {
    const upper = val.trim().toUpperCase();
    if (upper === "OFF" || upper === "QUESTIONS_ONLY" || upper === "ON") {
      return upper;
    }
    if (upper === "FULL" || upper === "ALL") {
      return "ON";
    }
  }
  return DEFAULT_SESSION_SETTINGS.show_answers_after;
}

export function parseSessionSettings(raw: unknown): RoomSessionSettings {
  let obj: Record<string, unknown> = {};

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      // Gunakan default jika string JSON tidak valid
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }

  return {
    game_mode: normalizeGameMode(obj.game_mode),
    question_timer: parseBoolean(
      obj.question_timer,
      DEFAULT_SESSION_SETTINGS.question_timer,
    ),
    enable_powerups: parseBoolean(
      obj.enable_powerups,
      DEFAULT_SESSION_SETTINGS.enable_powerups,
    ),
    shuffle_questions: parseBoolean(
      obj.shuffle_questions,
      DEFAULT_SESSION_SETTINGS.shuffle_questions,
    ),
    shuffle_answers: parseBoolean(
      obj.shuffle_answers,
      DEFAULT_SESSION_SETTINGS.shuffle_answers,
    ),
    redemption_questions: parseBoolean(
      obj.redemption_questions,
      DEFAULT_SESSION_SETTINGS.redemption_questions,
    ),
    show_leaderboard: parseBoolean(
      obj.show_leaderboard,
      DEFAULT_SESSION_SETTINGS.show_leaderboard,
    ),
    show_answer_each: parseShowAnswerEach(obj.show_answer_each),
    show_answers_after: parseShowAnswersAfter(obj.show_answers_after),
    anti_cheating: parseBoolean(
      obj.anti_cheating,
      DEFAULT_SESSION_SETTINGS.anti_cheating,
    ),
    disable_right_click: parseBoolean(
      obj.disable_right_click,
      DEFAULT_SESSION_SETTINGS.disable_right_click,
    ),
    disable_copy_paste: parseBoolean(
      obj.disable_copy_paste,
      DEFAULT_SESSION_SETTINGS.disable_copy_paste,
    ),
  };
}
