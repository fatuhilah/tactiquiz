import { OptionKey } from "@/components/ChessQuizBoard";

export type ExcelReportLang = "ID" | "EN";

export interface ExcelQuestionItem {
  id: string;
  text: string;
  order_index: number;
  correct_options: OptionKey[];
  options: Record<OptionKey, string>;
  allow_multiple?: boolean;
  time_limit?: number;
}

export interface ExcelPlayerAnswer {
  question_id: string;
  question_index?: number;
  selected_option: OptionKey | null;
  is_correct: boolean;
  moves_used?: number;
  time_spent?: number;
}

export interface ExcelPlayerItem {
  id: string;
  nickname: string;
  score: number;
  score100: number;
  correct_count: number;
  wrong_count: number;
  tab_switches?: number;
  joined_at?: string;
  answers: ExcelPlayerAnswer[];
}

export interface ExportClassExcelParams {
  quizTitle: string;
  roomPin: string;
  teacherName: string;
  createdAt: string;
  questions: ExcelQuestionItem[];
  players: ExcelPlayerItem[];
  lang?: ExcelReportLang;
}

const EXCEL_I18N: Record<
  ExcelReportLang,
  {
    sheets: {
      overview: string;
      participants: string;
      time: string;
      details: string;
    };
    banners: {
      overviewTitle: string;
      participantsTitle: string;
      timeTitle: string;
      detailsTitle: string;
      detailsSub: (pin: string) => string;
      subtitle: (
        quiz: string,
        pin: string,
        teacher: string,
        date: string,
        avg: number,
      ) => string;
    };
    headers: {
      no: string;
      question: string;
      questionType: string;
      correctKey: string;
      questionAccuracy: string;
      avgTimeShort: string;
      avgTimeFull: string;
      correct: string;
      incorrect: string;
      unattempted: string;
      rank: string;
      studentName: string;
      finalScore: string;
      gamePoints: string;
      accuracy: string;
      attempted: string;
      emptyShort: string;
      totalTime: string;
      joinedAt: string;
      sessionStatus: string;
      infoCol: string;
      valueCol: string;
    };
    values: {
      multipleSelect: string;
      multipleChoice: string;
      classSummaryRow: string;
      totalTimeRow: string;
      completed: string;
      leftScreen: (count: number) => string;
      quizTitleLabel: string;
      roomPinLabel: string;
      teacherLabel: string;
      sessionDateLabel: string;
      totalParticipantsLabel: string;
      totalQuestionsLabel: string;
      classAccuracyLabel: string;
      avgClassScoreLabel: string;
      defaultFileSlug: string;
    };
  }
> = {
  ID: {
    sheets: {
      overview: "Ringkasan Soal",
      participants: "Data Peserta",
      time: "Analisis Waktu",
      details: "Detail Kuis",
    },
    banners: {
      overviewTitle: "LAPORAN EVALUASI HASIL BELAJAR KELAS — RINGKASAN SOAL",
      participantsTitle: "REKAP NILAI & PERINGKAT PESERTA",
      timeTitle: "ANALISIS WAKTU PENGERJAAN PER SOAL",
      detailsTitle: "RINGKASAN SESI KUIS",
      detailsSub: (pin) => `TactiQuiz • Kode PIN ${pin}`,
      subtitle: (quiz, pin, teacher, date, avg) =>
        `Kuis: ${quiz}   |   Kode PIN: ${pin}   |   Pengajar: ${teacher}   |   Tanggal: ${date}   |   Rata-rata Kelas: ${avg}/100`,
    },
    headers: {
      no: "No",
      question: "Pertanyaan",
      questionType: "Tipe Soal",
      correctKey: "Kunci Jawaban",
      questionAccuracy: "Akurasi Soal",
      avgTimeShort: "Rata-rata Waktu",
      avgTimeFull: "Rata-rata Waktu (jj:mm:dd)",
      correct: "Benar",
      incorrect: "Salah",
      unattempted: "Tidak Dijawab",
      rank: "Peringkat",
      studentName: "Nama Peserta",
      finalScore: "Nilai Akhir (0-100)",
      gamePoints: "Poin Arena",
      accuracy: "Akurasi",
      attempted: "Dijawab",
      emptyShort: "Kosong",
      totalTime: "Total Waktu",
      joinedAt: "Waktu Bergabung",
      sessionStatus: "Status Sesi",
      infoCol: "Keterangan",
      valueCol: "Nilai / Data",
    },
    values: {
      multipleSelect: "Jawaban Ganda",
      multipleChoice: "Pilihan Ganda",
      classSummaryRow: "AKUMULASI / RATA-RATA KELAS",
      totalTimeRow: "TOTAL WAKTU",
      completed: "Selesai",
      leftScreen: (count) => `Keluar layar ${count}x`,
      quizTitleLabel: "Judul Kuis",
      roomPinLabel: "Kode Ruang (PIN)",
      teacherLabel: "Pengajar",
      sessionDateLabel: "Tanggal Pelaksanaan",
      totalParticipantsLabel: "Total Peserta",
      totalQuestionsLabel: "Jumlah Soal",
      classAccuracyLabel: "Akurasi Kelas",
      avgClassScoreLabel: "Rata-rata Nilai Kelas (0-100)",
      defaultFileSlug: "Laporan-Kelas",
    },
  },
  EN: {
    sheets: {
      overview: "Overview",
      participants: "Participant Data",
      time: "Time Data",
      details: "Quiz Details",
    },
    banners: {
      overviewTitle: "TACTIQUIZ CLASS EVALUATION REPORT — OVERVIEW",
      participantsTitle: "PARTICIPANT PERFORMANCE & LEADERBOARD",
      timeTitle: "TIME ANALYTICS PER QUESTION",
      detailsTitle: "QUIZ SESSION SUMMARY",
      detailsSub: (pin) => `TactiQuiz • Room PIN ${pin}`,
      subtitle: (quiz, pin, teacher, date, avg) =>
        `Quiz: ${quiz}   |   Room PIN: ${pin}   |   Teacher: ${teacher}   |   Date: ${date}   |   Class Average: ${avg}/100`,
    },
    headers: {
      no: "#",
      question: "Question",
      questionType: "Question Type",
      correctKey: "Correct Key",
      questionAccuracy: "Question Accuracy",
      avgTimeShort: "Avg. Time / Question",
      avgTimeFull: "Average Time (hh:mm:ss)",
      correct: "Correct",
      incorrect: "Incorrect",
      unattempted: "Unattempted",
      rank: "Rank",
      studentName: "Student Name",
      finalScore: "Final Score (0-100)",
      gamePoints: "Game Points",
      accuracy: "Accuracy",
      attempted: "Attempted",
      emptyShort: "Unattempted",
      totalTime: "Total Time",
      joinedAt: "Joined At",
      sessionStatus: "Session Status",
      infoCol: "Information",
      valueCol: "Value",
    },
    values: {
      multipleSelect: "Multiple Select",
      multipleChoice: "Multiple Choice",
      classSummaryRow: "CLASS TOTAL / AVERAGE",
      totalTimeRow: "TOTAL TIME",
      completed: "Completed",
      leftScreen: (count) => `Left screen ${count}x`,
      quizTitleLabel: "Quiz Title",
      roomPinLabel: "Room PIN",
      teacherLabel: "Teacher",
      sessionDateLabel: "Session Date",
      totalParticipantsLabel: "Total Participants",
      totalQuestionsLabel: "Total Questions",
      classAccuracyLabel: "Class Accuracy",
      avgClassScoreLabel: "Average Class Score (0-100)",
      defaultFileSlug: "Class-Quiz-Report",
    },
  },
};

function sanitizeXmlText(raw: string): string {
  const decoded = String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  let clean = "";
  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    ) {
      clean += decoded[i];
    }
  }
  return clean.trim();
}

function escapeXml(val: string): string {
  return sanitizeXmlText(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colLetter(colIdx1Based: number): string {
  let n = colIdx1Based;
  let str = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

function formatDurationHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatStartedAt(iso: string, lang: ExcelReportLang): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "EN" ? "en-US" : "id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StyledCell {
  v: string | number | null;
  s: number;
}

interface SheetSpec {
  name: string;
  colWidths: number[];
  freezeRow: number;
  merges: string[];
  rows: { height: number; cells: StyledCell[] }[];
}

class SharedStringPool {
  private map = new Map<string, number>();
  private list: string[] = [];

  add(raw: string): number {
    const clean = sanitizeXmlText(raw);
    const existing = this.map.get(clean);
    if (existing !== undefined) return existing;
    const idx = this.list.length;
    this.list.push(clean);
    this.map.set(clean, idx);
    return idx;
  }

  toXml(): string {
    const items = this.list
      .map((str) => `<si><t xml:space="preserve">${escapeXml(str)}</t></si>`)
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.list.length}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

function buildWorksheetXml(
  sheet: SheetSpec,
  sst: SharedStringPool,
  sheetIndex: number,
): string {
  const rowCount = Math.max(1, sheet.rows.length);
  const colCount = Math.max(1, sheet.colWidths.length);
  const dimRef = `A1:${colLetter(colCount)}${rowCount}`;

  const colsXml = sheet.colWidths
    .map(
      (w, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`,
    )
    .join("");

  const rowsXml = sheet.rows
    .map((rowObj, rIdx) => {
      const rNum = rIdx + 1;
      const cellsXml = rowObj.cells
        .map((cell, cIdx) => {
          const ref = `${colLetter(cIdx + 1)}${rNum}`;
          if (cell.v === null || cell.v === undefined) {
            return `<c r="${ref}" s="${cell.s}"/>`;
          }
          if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
            return `<c r="${ref}" s="${cell.s}"><v>${cell.v}</v></c>`;
          }
          const strIdx = sst.add(String(cell.v));
          return `<c r="${ref}" s="${cell.s}" t="s"><v>${strIdx}</v></c>`;
        })
        .join("");
      return `<row r="${rNum}" ht="${rowObj.height}" customHeight="1">${cellsXml}</row>`;
    })
    .join("");

  const mergeXml =
    sheet.merges.length > 0
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
          .map((m) => `<mergeCell ref="${m}"/>`)
          .join("")}</mergeCells>`
      : "";

  const freezeTopCell = `A${sheet.freezeRow + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimRef}"/>
  <sheetViews>
    <sheetView tabSelected="${sheetIndex === 0 ? "1" : "0"}" workbookViewId="0">
      <pane ySplit="${sheet.freezeRow}" topLeftCell="${freezeTopCell}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  ${mergeXml}
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="10">
    <font><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E40AF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF9F1239"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF334155"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="14">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFE4E6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF312E81"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="medium"><color rgb="FF475569"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="20">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="8" fillId="11" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="9" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="12" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="13" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ==================== ZERO-DEPENDENCY ZIP ARCHIVER (STORE MODE) ====================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(): { dosTime: number; dosDate: number } {
  const now = new Date();
  const year = Math.max(1980, now.getFullYear());
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = Math.floor(now.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosTime, dosDate };
}

function createZipBlob(files: { path: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { dosTime, dosDate } = getDosDateTime();
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, endRecord];
  const totalBytes = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const buffer = new ArrayBuffer(totalBytes);
  const merged = new Uint8Array(buffer);

  let writePos = 0;
  for (const part of parts) {
    merged.set(part, writePos);
    writePos += part.byteLength;
  }

  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function makeBannerRows(
  colCount: number,
  title: string,
  subtitle: string,
): {
  merges: string[];
  bannerRows: { height: number; cells: StyledCell[] }[];
} {
  const lastCol = colLetter(colCount);
  const row1Cells: StyledCell[] = Array.from({ length: colCount }, (_, i) => ({
    v: i === 0 ? title : null,
    s: 1,
  }));
  const row2Cells: StyledCell[] = Array.from({ length: colCount }, (_, i) => ({
    v: i === 0 ? subtitle : null,
    s: 2,
  }));

  return {
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`],
    bannerRows: [
      { height: 34, cells: row1Cells },
      { height: 24, cells: row2Cells },
    ],
  };
}

// ==================== MAIN EXPORT FUNCTION ====================

export function downloadClassQuizReportExcel(params: ExportClassExcelParams) {
  const {
    quizTitle,
    roomPin,
    teacherName,
    createdAt,
    questions,
    players,
    lang = "ID",
  } = params;

  const t = EXCEL_I18N[lang];

  const sortedPlayers = [...players].sort(
    (a, b) => b.correct_count - a.correct_count || b.score - a.score,
  );
  const totalParticipants = sortedPlayers.length;
  const totalQuestions = questions.length;

  const avgScore100 =
    totalParticipants > 0
      ? Math.round(
          sortedPlayers.reduce((acc, p) => acc + p.score100, 0) /
            totalParticipants,
        )
      : 0;

  const formattedDate = formatStartedAt(createdAt, lang);
  const subtitleText = t.banners.subtitle(
    sanitizeXmlText(quizTitle),
    roomPin,
    sanitizeXmlText(teacherName),
    formattedDate,
    avgScore100,
  );

  const getAns = (p: ExcelPlayerItem, q: ExcelQuestionItem, idx: number) =>
    p.answers.find(
      (a) => String(a.question_id) === String(q.id) || a.question_index === idx,
    );

  // ==================== SHEET 1: OVERVIEW / RINGKASAN SOAL ====================
  const overviewColCount = 9 + sortedPlayers.length;
  const overviewBanner = makeBannerRows(
    overviewColCount,
    t.banners.overviewTitle,
    subtitleText,
  );

  const overviewHeaderCells: StyledCell[] = [
    { v: t.headers.no, s: 3 },
    { v: t.headers.question, s: 3 },
    { v: t.headers.questionType, s: 3 },
    { v: t.headers.correctKey, s: 4 },
    { v: t.headers.questionAccuracy, s: 3 },
    { v: t.headers.avgTimeShort, s: 3 },
    { v: t.headers.correct, s: 4 },
    { v: t.headers.incorrect, s: 5 },
    { v: t.headers.unattempted, s: 7 },
    ...sortedPlayers.map((p) => ({ v: p.nickname, s: 6 })),
  ];

  let sumCorrectAll = 0;
  let sumIncorrectAll = 0;
  let sumUnattemptedAll = 0;
  let sumAvgSecondsAll = 0;

  const overviewRows: { height: number; cells: StyledCell[] }[] = [
    ...overviewBanner.bannerRows,
    { height: 36, cells: overviewHeaderCells },
  ];

  questions.forEach((q, idx) => {
    const isZebra = idx % 2 === 1;
    const centerStyle = isZebra ? 10 : 8;
    const leftStyle = isZebra ? 11 : 9;

    let qCorrect = 0;
    let qIncorrect = 0;
    let qUnattempted = 0;
    let qTimeTotal = 0;
    let qTimedCount = 0;

    const studentCells: StyledCell[] = sortedPlayers.map((p) => {
      const ans = getAns(p, q, idx);
      const estSec =
        typeof ans?.time_spent === "number" && ans.time_spent > 0
          ? ans.time_spent
          : Math.min(
              q.time_limit || 60,
              Math.max(3, (ans?.moves_used || 1) * 4),
            );

      if (!ans || !ans.selected_option) {
        qUnattempted++;
        return { v: "—", s: 14 };
      }

      qTimeTotal += estSec;
      qTimedCount++;

      const optText = sanitizeXmlText(q.options[ans.selected_option] || "");
      const displayVal = optText
        ? `${ans.selected_option}. ${optText}`
        : ans.selected_option;

      if (ans.is_correct) {
        qCorrect++;
        return { v: `✓ ${displayVal}`, s: 12 };
      } else {
        qIncorrect++;
        return { v: `✗ ${displayVal}`, s: 13 };
      }
    });

    sumCorrectAll += qCorrect;
    sumIncorrectAll += qIncorrect;
    sumUnattemptedAll += qUnattempted;

    const qAccuracy =
      totalParticipants > 0
        ? Math.round((qCorrect / totalParticipants) * 100)
        : 0;
    const qAvgSec = qTimedCount > 0 ? Math.round(qTimeTotal / qTimedCount) : 0;
    sumAvgSecondsAll += qAvgSec;

    const qTypeLabel =
      q.allow_multiple || q.correct_options.length > 1
        ? t.values.multipleSelect
        : t.values.multipleChoice;

    const keySummary = q.correct_options
      .map((k) => {
        const txt = sanitizeXmlText(q.options[k] || "");
        return txt ? `${k}. ${txt}` : k;
      })
      .join(" ; ");

    overviewRows.push({
      height: 30,
      cells: [
        { v: idx + 1, s: centerStyle },
        { v: sanitizeXmlText(q.text), s: leftStyle },
        { v: qTypeLabel, s: centerStyle },
        { v: keySummary, s: leftStyle },
        { v: `${qAccuracy}%`, s: centerStyle },
        { v: formatDurationHMS(qAvgSec), s: centerStyle },
        { v: qCorrect, s: centerStyle },
        { v: qIncorrect, s: centerStyle },
        { v: qUnattempted, s: centerStyle },
        ...studentCells,
      ],
    });
  });

  const totalSlots = totalParticipants * totalQuestions;
  const overallAccuracy =
    totalSlots > 0 ? Math.round((sumCorrectAll / totalSlots) * 100) : 0;

  overviewRows.push({
    height: 28,
    cells: [
      { v: "", s: 15 },
      { v: t.values.classSummaryRow, s: 15 },
      { v: "", s: 15 },
      { v: "", s: 15 },
      { v: `${overallAccuracy}%`, s: 15 },
      { v: formatDurationHMS(sumAvgSecondsAll), s: 15 },
      { v: sumCorrectAll, s: 15 },
      { v: sumIncorrectAll, s: 15 },
      { v: sumUnattemptedAll, s: 15 },
      ...sortedPlayers.map((p) => {
        const pAcc =
          totalQuestions > 0
            ? Math.round((p.correct_count / totalQuestions) * 100)
            : 0;
        return { v: `${p.score100} (${pAcc}%)`, s: 15 };
      }),
    ],
  });

  // ==================== SHEET 2: PARTICIPANT DATA / DATA PESERTA ====================
  const participantColCount = 12;
  const participantBanner = makeBannerRows(
    participantColCount,
    t.banners.participantsTitle,
    subtitleText,
  );

  const participantHeaderCells: StyledCell[] = [
    { v: t.headers.rank, s: 6 },
    { v: t.headers.studentName, s: 6 },
    { v: t.headers.finalScore, s: 3 },
    { v: t.headers.gamePoints, s: 3 },
    { v: t.headers.accuracy, s: 3 },
    { v: t.headers.attempted, s: 3 },
    { v: t.headers.correct, s: 4 },
    { v: t.headers.incorrect, s: 5 },
    { v: t.headers.emptyShort, s: 7 },
    { v: t.headers.totalTime, s: 3 },
    { v: t.headers.joinedAt, s: 3 },
    { v: t.headers.sessionStatus, s: 3 },
  ];

  const participantRows: { height: number; cells: StyledCell[] }[] = [
    ...participantBanner.bannerRows,
    { height: 34, cells: participantHeaderCells },
  ];

  sortedPlayers.forEach((p, idx) => {
    const isZebra = idx % 2 === 1;
    const cellStyle = isZebra ? 10 : 8;
    const leftStyle = isZebra ? 11 : 9;

    const rankStyle =
      idx === 0 ? 17 : idx === 1 ? 18 : idx === 2 ? 19 : cellStyle;
    const rankLabel =
      idx === 0
        ? "🥇 #1"
        : idx === 1
          ? "🥈 #2"
          : idx === 2
            ? "🥉 #3"
            : `#${idx + 1}`;

    const attempted = p.answers.filter(
      (a) => a.selected_option !== null,
    ).length;
    const unattempted = Math.max(0, totalQuestions - attempted);
    const accuracy =
      totalQuestions > 0
        ? Math.round((p.correct_count / totalQuestions) * 100)
        : 0;

    const totalSec = p.answers.reduce((acc, a) => {
      if (!a.selected_option) return acc;
      const spent =
        typeof a.time_spent === "number" && a.time_spent > 0
          ? a.time_spent
          : Math.max(3, (a.moves_used || 1) * 4);
      return acc + spent;
    }, 0);

    const statusNote =
      (p.tab_switches ?? 0) > 0
        ? t.values.leftScreen(p.tab_switches ?? 0)
        : t.values.completed;

    participantRows.push({
      height: 26,
      cells: [
        { v: rankLabel, s: rankStyle },
        { v: p.nickname, s: leftStyle },
        { v: p.score100, s: 16 },
        { v: p.score || 0, s: cellStyle },
        { v: `${accuracy}%`, s: cellStyle },
        { v: `${attempted}/${totalQuestions}`, s: cellStyle },
        { v: p.correct_count, s: 12 },
        { v: p.wrong_count, s: 13 },
        { v: unattempted, s: cellStyle },
        { v: formatDurationHMS(totalSec), s: cellStyle },
        { v: formatStartedAt(p.joined_at || createdAt, lang), s: cellStyle },
        { v: statusNote, s: cellStyle },
      ],
    });
  });

  // ==================== SHEET 3: TIME DATA / ANALISIS WAKTU ====================
  const timeColCount = 5 + sortedPlayers.length;
  const timeBanner = makeBannerRows(
    timeColCount,
    t.banners.timeTitle,
    subtitleText,
  );

  const timeHeaderCells: StyledCell[] = [
    { v: t.headers.no, s: 3 },
    { v: t.headers.question, s: 3 },
    { v: t.headers.questionType, s: 3 },
    { v: t.headers.questionAccuracy, s: 3 },
    { v: t.headers.avgTimeFull, s: 3 },
    ...sortedPlayers.map((p) => ({ v: p.nickname, s: 6 })),
  ];

  const timeRows: { height: number; cells: StyledCell[] }[] = [
    ...timeBanner.bannerRows,
    { height: 34, cells: timeHeaderCells },
  ];
  const studentTotalSeconds = new Array<number>(sortedPlayers.length).fill(0);

  questions.forEach((q, idx) => {
    const isZebra = idx % 2 === 1;
    const centerStyle = isZebra ? 10 : 8;
    const leftStyle = isZebra ? 11 : 9;

    let qCorrect = 0;
    let qTimeSum = 0;
    let qCount = 0;

    const timeCells: StyledCell[] = sortedPlayers.map((p, pIdx) => {
      const ans = getAns(p, q, idx);
      if (!ans || !ans.selected_option) {
        return { v: "—", s: 14 };
      }
      if (ans.is_correct) qCorrect++;
      const sec =
        typeof ans.time_spent === "number" && ans.time_spent > 0
          ? ans.time_spent
          : Math.min(
              q.time_limit || 60,
              Math.max(3, (ans.moves_used || 1) * 4),
            );
      qTimeSum += sec;
      qCount++;
      studentTotalSeconds[pIdx] += sec;
      return { v: formatDurationHMS(sec), s: centerStyle };
    });

    const qAccuracy =
      totalParticipants > 0
        ? Math.round((qCorrect / totalParticipants) * 100)
        : 0;
    const avgSec = qCount > 0 ? Math.round(qTimeSum / qCount) : 0;
    const qTypeLabel =
      q.allow_multiple || q.correct_options.length > 1
        ? t.values.multipleSelect
        : t.values.multipleChoice;

    timeRows.push({
      height: 28,
      cells: [
        { v: idx + 1, s: centerStyle },
        { v: sanitizeXmlText(q.text), s: leftStyle },
        { v: qTypeLabel, s: centerStyle },
        { v: `${qAccuracy}%`, s: centerStyle },
        { v: formatDurationHMS(avgSec), s: centerStyle },
        ...timeCells,
      ],
    });
  });

  timeRows.push({
    height: 28,
    cells: [
      { v: "", s: 15 },
      { v: t.values.totalTimeRow, s: 15 },
      { v: "", s: 15 },
      { v: `${overallAccuracy}%`, s: 15 },
      { v: formatDurationHMS(sumAvgSecondsAll), s: 15 },
      ...studentTotalSeconds.map((sec) => ({
        v: formatDurationHMS(sec),
        s: 15,
      })),
    ],
  });

  // ==================== SHEET 4: QUIZ DETAILS / DETAIL KUIS ====================
  const detailsBanner = makeBannerRows(
    2,
    t.banners.detailsTitle,
    t.banners.detailsSub(roomPin),
  );

  const detailsRows: { height: number; cells: StyledCell[] }[] = [
    ...detailsBanner.bannerRows,
    {
      height: 30,
      cells: [
        { v: t.headers.infoCol, s: 3 },
        { v: t.headers.valueCol, s: 3 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.quizTitleLabel, s: 9 },
        { v: sanitizeXmlText(quizTitle), s: 8 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.roomPinLabel, s: 11 },
        { v: roomPin, s: 10 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.teacherLabel, s: 9 },
        { v: sanitizeXmlText(teacherName), s: 8 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.sessionDateLabel, s: 11 },
        { v: formattedDate, s: 10 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.totalParticipantsLabel, s: 9 },
        { v: totalParticipants, s: 8 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.totalQuestionsLabel, s: 11 },
        { v: totalQuestions, s: 10 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.classAccuracyLabel, s: 9 },
        { v: `${overallAccuracy}%`, s: 12 },
      ],
    },
    {
      height: 25,
      cells: [
        { v: t.values.avgClassScoreLabel, s: 11 },
        { v: avgScore100, s: 16 },
      ],
    },
  ];

  // ==================== BUILD 4 WORKSHEETS + SHARED STRINGS ====================
  const sheets: SheetSpec[] = [
    {
      name: t.sheets.overview,
      colWidths: [
        6,
        44,
        18,
        28,
        15,
        18,
        11,
        11,
        14,
        ...sortedPlayers.map(() => 24),
      ],
      freezeRow: 3,
      merges: overviewBanner.merges,
      rows: overviewRows,
    },
    {
      name: t.sheets.participants,
      colWidths: [12, 24, 18, 15, 13, 13, 11, 11, 11, 15, 22, 18],
      freezeRow: 3,
      merges: participantBanner.merges,
      rows: participantRows,
    },
    {
      name: t.sheets.time,
      colWidths: [6, 44, 18, 15, 22, ...sortedPlayers.map(() => 16)],
      freezeRow: 3,
      merges: timeBanner.merges,
      rows: timeRows,
    },
    {
      name: t.sheets.details,
      colWidths: [30, 42],
      freezeRow: 3,
      merges: detailsBanner.merges,
      rows: detailsRows,
    },
  ];

  const sst = new SharedStringPool();
  const sheetXmlList = sheets.map((s, idx) => buildWorksheetXml(s, sst, idx));
  const sharedStringsXml = sst.toXml();

  const zipFiles: { path: string; content: string }[] = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("\n  ")}
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("\n  ")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/>
  </bookViews>
  <sheets>
    ${sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("\n    ")}
  </sheets>
</workbook>`,
    },
    {
      path: "xl/styles.xml",
      content: STYLES_XML,
    },
    {
      path: "xl/sharedStrings.xml",
      content: sharedStringsXml,
    },
    ...sheetXmlList.map((xml, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      content: xml,
    })),
  ];

  const blob = createZipBlob(zipFiles);
  const url = URL.createObjectURL(blob);
  const safeSlug = sanitizeXmlText(quizTitle)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_|_$/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeSlug || t.values.defaultFileSlug}_${roomPin}_${lang}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
