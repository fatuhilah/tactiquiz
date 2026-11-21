"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, Trash2, X } from "lucide-react";

declare global {
  interface Window {
    modernConfirm: (message: string) => Promise<boolean>;
  }
}

interface DialogState {
  type: "ALERT" | "CONFIRM";
  title: string;
  description?: string;
  variant: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  confirmText: string;
  cancelText: string;
  resolve?: (value: boolean) => void;
}

function parseDialogContent(
  rawMessage: string,
  isConfirm: boolean,
): Omit<DialogState, "resolve"> {
  const clean = String(rawMessage || "").trim();
  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const title = lines[0] || (isConfirm ? "Konfirmasi Tindakan" : "Informasi");
  const description = lines.length > 1 ? lines.slice(1).join("\n") : undefined;
  const lower = clean.toLowerCase();

  if (isConfirm) {
    const savedLang =
      typeof window !== "undefined"
        ? localStorage.getItem("tactiquiz_lang") || localStorage.getItem("lang")
        : null;

    const isEn =
      savedLang === "EN" ||
      (!savedLang &&
        (lower.includes("are you sure") ||
          lower.includes("delete") ||
          lower.includes("end the game") ||
          lower.includes("leave") ||
          lower.includes("return to")));

    const isDestructive =
      lower.includes("hapus") ||
      lower.includes("permanen") ||
      lower.includes("akhiri") ||
      lower.includes("keluar") ||
      lower.includes("delete") ||
      lower.includes("permanently") ||
      lower.includes("end the game") ||
      lower.includes("log out") ||
      lower.includes("leave");

    const isDelete = lower.includes("hapus") || lower.includes("delete");

    return {
      type: "CONFIRM",
      title,
      description,
      variant: isDestructive ? "DANGER" : "WARNING",
      confirmText: isDelete
        ? isEn
          ? "Yes, Delete"
          : "Ya, Hapus"
        : isEn
          ? "Yes, Continue"
          : "Ya, Lanjutkan",
      cancelText: isEn ? "Cancel" : "Batal",
    };
  }

  let variant: DialogState["variant"] = "INFO";
  if (lower.includes("sukses") || lower.includes("berhasil")) {
    variant = "SUCCESS";
  } else if (
    lower.includes("gagal") ||
    lower.includes("wajib") ||
    lower.includes("tidak") ||
    lower.includes("kosong") ||
    lower.includes("besar") ||
    lower.includes("pastikan")
  ) {
    variant = "WARNING";
  }

  return {
    type: "ALERT",
    title,
    description,
    variant,
    confirmText: "Mengerti",
    cancelText: "Tutup",
  };
}

export default function ModernDialogProvider() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const closeDialog = useCallback(
    (result: boolean) => {
      if (dialog?.resolve) {
        dialog.resolve(result);
      }
      setDialog(null);
    },
    [dialog],
  );

  useEffect(() => {
    const originalAlert = window.alert;

    // 1. Otomatis override semua window.alert() di seluruh aplikasi
    window.alert = (message?: unknown) => {
      const parsed = parseDialogContent(String(message ?? ""), false);
      setDialog({ ...parsed });
    };

    // 2. Sediakan window.modernawait window.modernConfirm() berbasis Promise untuk pengganti await window.modernConfirm()
    window.modernConfirm = (message: string) => {
      return new Promise<boolean>((resolve) => {
        const parsed = parseDialogContent(message, true);
        setDialog({ ...parsed, resolve });
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Dukungan tombol keyboard Enter & Escape
  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        closeDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog, closeDialog]);

  const iconConfig = {
    SUCCESS: {
      bg: "bg-emerald-100 text-emerald-600",
      icon: <CheckCircle2 className="w-7 h-7" />,
      btn: "bg-[#22C55E] hover:bg-[#1EB054] border-[#15803D] text-white",
    },
    WARNING: {
      bg: "bg-amber-100 text-amber-600",
      icon: <AlertTriangle className="w-7 h-7" />,
      btn: "bg-[#2B90FF] hover:bg-[#1D7AFC] border-[#1359B8] text-white",
    },
    DANGER: {
      bg: "bg-rose-100 text-rose-600",
      icon: <Trash2 className="w-7 h-7" />,
      btn: "bg-rose-500 hover:bg-rose-600 border-rose-700 text-white",
    },
    INFO: {
      bg: "bg-sky-100 text-[#2B90FF]",
      icon: <Info className="w-7 h-7" />,
      btn: "bg-[#2B90FF] hover:bg-[#1D7AFC] border-[#1359B8] text-white",
    },
  };

  return (
    <AnimatePresence>
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeDialog(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          {/* Kotak Modal Modern */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="relative z-10 w-full max-w-md bg-white rounded-[28px] border-2 border-slate-200 border-b-8 p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => closeDialog(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className={`w-14 h-14 rounded-2xl ${iconConfig[dialog.variant].bg} flex items-center justify-center mb-4 shadow-xs`}
              >
                {iconConfig[dialog.variant].icon}
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-800 leading-snug">
                {dialog.title}
              </h3>

              {dialog.description && (
                <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-2 whitespace-pre-line leading-relaxed">
                  {dialog.description}
                </p>
              )}

              <div className="w-full flex items-center gap-3 mt-6">
                {dialog.type === "CONFIRM" && (
                  <button
                    type="button"
                    onClick={() => closeDialog(false)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm border-b-4 border-slate-300 active:translate-y-0.5 transition cursor-pointer"
                  >
                    {dialog.cancelText}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => closeDialog(true)}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-sm border-b-4 active:translate-y-0.5 shadow-sm transition cursor-pointer ${
                    iconConfig[dialog.variant].btn
                  }`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
