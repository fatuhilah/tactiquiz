import { PieceType } from "@/components/ChessQuizBoard";

export type Language = "ID" | "EN";

export const translations = {
  ID: {
    // Umum & Navigasi
    back: "Kembali",
    home: "Beranda",
    save: "Simpan",
    saving: "Menyimpan...",
    cancel: "Batal",
    delete: "Hapus",
    loading: "Memuat...",
    musicOn: "Musik",
    musicMuted: "Mute",

    // Beranda (Landing Page)
    heroBadge: "Belajar Sambil Bermain Taktik Catur",
    heroTitle: "Ubah Kuis Kelas Jadi Petualangan Catur Seru!",
    heroSubtitle:
      "Jawab pertanyaan dengan menggerakkan bidak catur di papan taktis. Cocok untuk kelas interaktif maupun latihan mandiri.",
    enterPinTitle: "Masuk Ruang Kuis",
    enterPinPlaceholder: "Masukkan 6 Digit PIN",
    joinGameBtn: "Gabung Arena",
    tryDemoBtn: "Coba Mode Demo",
    teacherStudioBtn: "Studio Guru",

    // Dashboard & Bank Kuis
    myQuizzes: "Bank Kuis Saya",
    createQuizBtn: "Buat Kuis Baru",
    reportsBtn: "Laporan Kuis",
    logoutBtn: "Keluar",
    startLiveBtn: "Mulai Live",
    soloPlayBtn: "Main Solo",
    questionsCount: "Soal",

    // Studio Buat Kuis
    studioTitle: "Studio Buat Kuis",
    saveQuizBtn: "Simpan Kuis",
    quizTitleLabel: "Judul Kuis *",
    quizDescLabel: "Deskripsi Singkat (Opsional)",
    timerSettingsTitle: "Pengaturan Waktu Menjawab",
    timerPerQuestion: "Waktu Per Soal",
    timerTotalQuiz: "Waktu Keseluruhan Kuis",
    addQuestionBtn: "Tambah Soal",
    downloadCsvBtn: "Template CSV",
    uploadCsvBtn: "Upload CSV",
    multipleAnswersLabel:
      "Multiple correct answers (Lebih dari 1 jawaban benar)",
    livePreviewLabel: "Live Preview Soal",

    // Papan Catur & Gameplay Siswa
    stepsLabel: "Langkah",
    hintShow: "Bantuan",
    hintHide: "Sembunyi",
    boardTip:
      "Klik titik hijau untuk melangkah, lalu tabrak kotak huruf jawaban yang benar!",
    optionsHeader: "Pilihan Jawaban (Tangkap hurufnya di papan catur!)",
    powerupsHeader: "Kartu Bantuan Spesial",
    fiftyFiftyTitle: "50:50 Hapus 2",
    queenBoostTitle: "Mode Ratu Super",
    alreadyUsed: "Sudah dipakai",
    correctFeedback: "Tepat Sekali!",
    wrongFeedback: "Kurang tepat!",
    timeoutFeedback: "Waktu habis!",
    correctAnswerIs: "Jawaban benar:",
    nextQuestionWait: "Melanjutkan ke soal berikutnya...",

    // Halaman Join PIN & Hasil Akhir
    prepareCharTitle: "Siapkan Karaktermu!",
    prepareCharSub: "Tulis nama panggilan dan pilih bidak favoritmu",
    nicknameLabel: "Nama Panggilan",
    chooseAvatarLabel: "Pilih Avatar Bidak",
    joinNowBtn: "Gabung Sekarang!",
    waitingTitle: "Berhasil Bergabung",
    waitingSub:
      "Lihat namamu di layar depan kelas. Permainan akan segera dimulai oleh gurumu!",
    changeCharBtn: "Ganti Nama / Karakter",
    gameFinishedTitle: "Permainan Selesai!",
    rankLabel: "Peringkat",
    totalStarsLabel: "Total Bintang",
    correctCountLabel: "Jawaban Benar",
    wrongCountLabel: "Jawaban Salah",
    reviewTitle: "Pembahasan Jawabanmu",
    filterAll: "Semua",
    filterWrong: "Salah",
    filterCorrect: "Benar",

    // Layar Host Guru
    waitingRoomTitle: "Peserta di Ruang Tunggu",
    startGameBtn: "Mulai Permainan",
    endSessionBtn: "Akhiri Sesi",
    openPodiumBtn: "Lihat Podium Juara",
    liveMonitorTitle: "Pantauan Langsung Pengerjaan Kelas",
    tabLeaderboard: "Leaderboard",
    tabQuestions: "Questions",
    podiumTitle: "Podium Pemenang!",
    backToLibraryBtn: "Kembali ke Bank Kuis",
  },
  EN: {
    // Common & Navigation
    back: "Back",
    home: "Home",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    delete: "Delete",
    loading: "Loading...",
    musicOn: "Music",
    musicMuted: "Muted",

    // Landing Page
    heroBadge: "Learn Through Tactical Chess Gameplay",
    heroTitle: "Turn Classroom Quizzes Into an Exciting Chess Adventure!",
    heroSubtitle:
      "Answer questions by moving chess pieces across a tactical board. Built for live classrooms and self-paced practice.",
    enterPinTitle: "Join a Quiz Room",
    enterPinPlaceholder: "Enter 6-Digit PIN",
    joinGameBtn: "Join Arena",
    tryDemoBtn: "Try Demo Mode",
    teacherStudioBtn: "Teacher Studio",

    // Dashboard & Quiz Library
    myQuizzes: "My Quiz Library",
    createQuizBtn: "Create New Quiz",
    reportsBtn: "Quiz Reports",
    logoutBtn: "Log Out",
    startLiveBtn: "Host Live",
    soloPlayBtn: "Solo Play",
    questionsCount: "Questions",

    // Quiz Creator Studio
    studioTitle: "Quiz Creator Studio",
    saveQuizBtn: "Save Quiz",
    quizTitleLabel: "Quiz Title *",
    quizDescLabel: "Short Description (Optional)",
    timerSettingsTitle: "Timer Settings",
    timerPerQuestion: "Time Per Question",
    timerTotalQuiz: "Total Quiz Time",
    addQuestionBtn: "Add Question",
    downloadCsvBtn: "CSV Template",
    uploadCsvBtn: "Upload CSV",
    multipleAnswersLabel:
      "Multiple correct answers (More than 1 correct option)",
    livePreviewLabel: "Live Question Preview",

    // Chess Board & Student Gameplay
    stepsLabel: "Moves",
    hintShow: "Hints",
    hintHide: "Hidden",
    boardTip:
      "Click green dots to move, then capture the tile with the correct answer letter!",
    optionsHeader: "Answer Choices (Capture the letter on the chessboard!)",
    powerupsHeader: "Special Power-Up Cards",
    fiftyFiftyTitle: "50:50 Remove 2",
    queenBoostTitle: "Super Queen Mode",
    alreadyUsed: "Already used",
    correctFeedback: "Spot On!",
    wrongFeedback: "Not quite right!",
    timeoutFeedback: "Time is up!",
    correctAnswerIs: "Correct answer:",
    nextQuestionWait: "Moving to the next question...",

    // Join PIN & Finish Screen
    prepareCharTitle: "Prepare Your Character!",
    prepareCharSub: "Enter your nickname and pick your favorite chess piece",
    nicknameLabel: "Nickname",
    chooseAvatarLabel: "Choose Piece Avatar",
    joinNowBtn: "Join Now!",
    waitingTitle: "Successfully Joined",
    waitingSub:
      "Look for your name on the classroom screen. Your teacher will start the game soon!",
    changeCharBtn: "Change Name / Character",
    gameFinishedTitle: "Quiz Completed!",
    rankLabel: "Rank",
    totalStarsLabel: "Total Stars",
    correctCountLabel: "Correct",
    wrongCountLabel: "Incorrect",
    reviewTitle: "Your Answer Review",
    filterAll: "All",
    filterWrong: "Incorrect",
    filterCorrect: "Correct",

    // Host Screen
    waitingRoomTitle: "Players in Waiting Room",
    startGameBtn: "Start Game",
    endSessionBtn: "End Session",
    openPodiumBtn: "View Winners Podium",
    liveMonitorTitle: "Live Classroom Progress Monitor",
    tabLeaderboard: "Leaderboard",
    tabQuestions: "Questions",
    podiumTitle: "Winners Podium!",
    backToLibraryBtn: "Back to Quiz Library",
  },
} as const;

export type TranslationKey = keyof typeof translations.ID;

export const PIECE_META_I18N: Record<
  Language,
  Record<PieceType, { name: string; hint: string }>
> = {
  ID: {
    PAWN: {
      name: "Pion Cilik",
      hint: "Jalan 1 kotak lurus, tangkap jawaban 1 kotak serong!",
    },
    KNIGHT: {
      name: "Kuda Lompat",
      hint: "Melompat bentuk huruf L (bisa melompati balok)!",
    },
    BISHOP: {
      name: "Gajah Peluncur",
      hint: "Meluncur miring diagonal ke arah jawaban!",
    },
    ROOK: {
      name: "Benteng Kokoh",
      hint: "Meluncur lurus ke atas, bawah, kiri, atau kanan!",
    },
    QUEEN: {
      name: "Ratu Super",
      hint: "Bebas meluncur lurus maupun miring ke mana saja!",
    },
    KING: {
      name: "Raja Bijak",
      hint: "Melangkah santai 1 kotak ke segala arah!",
    },
  },
  EN: {
    PAWN: {
      name: "Little Pawn",
      hint: "Move 1 square straight, capture answers 1 square diagonally!",
    },
    KNIGHT: {
      name: "Jumping Knight",
      hint: "Jumps in an L-shape (can leap over obstacle blocks)!",
    },
    BISHOP: {
      name: "Sliding Bishop",
      hint: "Slides diagonally toward the answer tiles!",
    },
    ROOK: {
      name: "Mighty Rook",
      hint: "Slides straight up, down, left, or right!",
    },
    QUEEN: {
      name: "Super Queen",
      hint: "Slides freely in straight or diagonal lines anywhere!",
    },
    KING: {
      name: "Wise King",
      hint: "Steps steadily 1 square in any direction!",
    },
  },
};
