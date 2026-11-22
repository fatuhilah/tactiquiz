export type ConcreteGameMode =
  | "CHESS"
  | "MIRROR"
  | "STEALTH"
  | "CIRCUIT"
  | "SLIDE"
  | "COLLAPSE"
  | "FLUX"
  | "SWITCH"
  | "PORTAL"
  | "SHIFT";

export type TactiGameMode = ConcreteGameMode | "RANDOM";

export interface GameModeMeta {
  id: TactiGameMode;
  name: string;
  emoji: string;
  badgeColor: string;
  descId: string;
  descEn: string;
}

export const CONCRETE_GAME_MODES: ConcreteGameMode[] = [
  "CHESS",
  "MIRROR",
  "STEALTH",
  "CIRCUIT",
  "SLIDE",
  "COLLAPSE",
  "FLUX",
  "SWITCH",
  "PORTAL",
  "SHIFT",
];

export const GAME_MODES_META: Record<TactiGameMode, GameModeMeta> = {
  CHESS: {
    id: "CHESS",
    name: "TactiChess",
    emoji: "♞",
    badgeColor: "bg-indigo-600",
    descId:
      "Pola langkah bidak catur klasik (Kuda, Gajah, Benteng, Ratu, Raja, Pion)",
    descEn: "Classic chess piece movement patterns on a 6x6 tactical board",
  },
  MIRROR: {
    id: "MIRROR",
    name: "TactiMirror",
    emoji: "🔦",
    badgeColor: "bg-rose-600",
    descId: "Putar cermin (/ dan \\) untuk memantulkan sinar laser ke jawaban",
    descEn:
      "Rotate mirrors (/ and \\) to bounce the laser beam onto the answer",
  },
  STEALTH: {
    id: "STEALTH",
    name: "TactiStealth",
    emoji: "🥷",
    badgeColor: "bg-slate-800",
    descId: "Menyelinap melewati patroli & sorotan radar merah penjaga",
    descEn: "Sneak past patrolling guards and red radar cones",
  },
  CIRCUIT: {
    id: "CIRCUIT",
    name: "TactiCircuit",
    emoji: "⚡",
    badgeColor: "bg-sky-600",
    descId:
      "Putar jalur kabel listrik untuk mengalirkan energi ke terminal benar",
    descEn:
      "Rotate circuit tiles to route electrical power to the right terminal",
  },
  SLIDE: {
    id: "SLIDE",
    name: "TactiSlide",
    emoji: "🥌",
    badgeColor: "bg-cyan-600",
    descId: "Meluncur lurus di arena es & memantul pada batu penghalang",
    descEn: "Glide across ice tiles and ricochet off rock bumpers",
  },
  COLLAPSE: {
    id: "COLLAPSE",
    name: "TactiCollapse",
    emoji: "🌉",
    badgeColor: "bg-amber-600",
    descId:
      "Jembatan dengan ketahanan 1x–2x injak yang runtuh setelah dilewati",
    descEn: "Fragile bridge tiles collapse after you step off them",
  },
  FLUX: {
    id: "FLUX",
    name: "TactiFlux",
    emoji: "🧲",
    badgeColor: "bg-violet-600",
    descId:
      "Balik polaritas (+ / −) untuk menarik atau membelokkan bola magnet",
    descEn: "Flip polarity (+ / −) to attract or deflect your magnetic orb",
  },
  SWITCH: {
    id: "SWITCH",
    name: "TactiSwitch",
    emoji: "🎛️",
    badgeColor: "bg-pink-600",
    descId: "Injak saklar merah & biru untuk membuka gerbang warna senama",
    descEn: "Step on red & blue floor switches to toggle matching energy gates",
  },
  PORTAL: {
    id: "PORTAL",
    name: "TactiPortal",
    emoji: "🌀",
    badgeColor: "bg-purple-600",
    descId:
      "Gunakan pasangan portal dimensi P1 & P2 untuk menembus ruang terkunci",
    descEn: "Warp through paired P1 & P2 portals to enter locked rooms",
  },
  SHIFT: {
    id: "SHIFT",
    name: "TactiShift",
    emoji: "🔀",
    badgeColor: "bg-teal-600",
    descId: "Geser baris & kolom papan secara memutar untuk membuka jalur",
    descEn: "Slide entire rows and columns wrap-around to align your path",
  },
  RANDOM: {
    id: "RANDOM",
    name: "Mix Mode (Acak)",
    emoji: "🎲",
    badgeColor: "bg-gradient-to-r from-indigo-600 to-rose-500",
    descId: "Mode permainan berganti otomatis di setiap nomor soal!",
    descEn: "Switches tactical board mode automatically on every question!",
  },
};

export function normalizeGameMode(raw: unknown): TactiGameMode {
  if (typeof raw === "string") {
    const upper = raw.trim().toUpperCase() as TactiGameMode;
    if (upper in GAME_MODES_META) return upper;
  }
  return "CHESS";
}

// Menentukan mode konkret secara deterministik berdasarkan question.id (stabil terhadap timer tick)
export function resolveConcreteGameMode(
  mode: TactiGameMode | undefined,
  questionId: string,
): ConcreteGameMode {
  const normalized = normalizeGameMode(mode);
  if (normalized !== "RANDOM") return normalized;

  let hash = 2166136261;
  for (let i = 0; i < questionId.length; i++) {
    hash ^= questionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % CONCRETE_GAME_MODES.length;
  return CONCRETE_GAME_MODES[index];
}
