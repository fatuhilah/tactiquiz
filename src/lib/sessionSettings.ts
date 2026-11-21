export type HostingMode = "STUDENT_PACED" | "TEACHER_LED";
export type ShowAnswerEachMode = "ON" | "VALIDATE_ONLY" | "OFF";
export type ShowAnswersAfterMode = "ON" | "QUESTIONS_ONLY" | "OFF";

export interface RoomSessionSettings {
  enable_powerups: boolean; // Khusus STUDENT_PACED (maksimal 1x pakai per sesi)
  redemption_questions: boolean; // Khusus STUDENT_PACED
  show_answer_each: ShowAnswerEachMode;
  show_answers_after: ShowAnswersAfterMode;
  shuffle_questions: boolean; // Khusus STUDENT_PACED
  shuffle_answers: boolean; // Khusus STUDENT_PACED
  question_timer: boolean;
  anti_cheating: boolean;
  disable_right_click: boolean;
  disable_copy_paste: boolean;
}

export const DEFAULT_SESSION_SETTINGS: RoomSessionSettings = {
  enable_powerups: true,
  redemption_questions: false,
  show_answer_each: "ON",
  show_answers_after: "ON",
  shuffle_questions: false,
  shuffle_answers: false,
  question_timer: true,
  anti_cheating: false,
  disable_right_click: false,
  disable_copy_paste: false,
};

export function parseSessionSettings(raw: unknown): RoomSessionSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SESSION_SETTINGS };
  }
  const obj = raw as Partial<RoomSessionSettings>;
  return {
    enable_powerups:
      obj.enable_powerups ?? DEFAULT_SESSION_SETTINGS.enable_powerups,
    redemption_questions:
      obj.redemption_questions ?? DEFAULT_SESSION_SETTINGS.redemption_questions,
    show_answer_each:
      obj.show_answer_each ?? DEFAULT_SESSION_SETTINGS.show_answer_each,
    show_answers_after:
      obj.show_answers_after ?? DEFAULT_SESSION_SETTINGS.show_answers_after,
    shuffle_questions:
      obj.shuffle_questions ?? DEFAULT_SESSION_SETTINGS.shuffle_questions,
    shuffle_answers:
      obj.shuffle_answers ?? DEFAULT_SESSION_SETTINGS.shuffle_answers,
    question_timer:
      obj.question_timer ?? DEFAULT_SESSION_SETTINGS.question_timer,
    anti_cheating: obj.anti_cheating ?? DEFAULT_SESSION_SETTINGS.anti_cheating,
    disable_right_click:
      obj.disable_right_click ?? DEFAULT_SESSION_SETTINGS.disable_right_click,
    disable_copy_paste:
      obj.disable_copy_paste ?? DEFAULT_SESSION_SETTINGS.disable_copy_paste,
  };
}
