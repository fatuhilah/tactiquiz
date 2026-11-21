"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Users,
  ChevronRight,
  FileBarChart,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTeacherSession, TeacherSession } from "@/lib/auth";

interface ReportRoom {
  id: string;
  pin_code: string;
  created_at: string;
  quiz_id: string;
  quiz_title: string;
  participant_count: number;
}

interface RoomQueryRow {
  id: string;
  pin_code: string;
  created_at: string;
  quiz_id: string;
  players: { id: string }[] | null;
}

export default function ReportsIndexPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [rooms, setRooms] = useState<ReportRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setTeacher(session);

    async function loadReports() {
      // 1. Ambil kuis milik guru ini
      const { data: myQuizzes } = await supabase
        .from("quizzes")
        .select("id, title")
        .eq("teacher_id", session?.id);

      if (!myQuizzes || myQuizzes.length === 0) {
        setLoading(false);
        return;
      }

      const quizMap = new Map(myQuizzes.map((q) => [q.id, q.title]));
      const quizIds = Array.from(quizMap.keys());

      // 2. Ambil room yang sudah selesai (finished) dari kuis-kuis tersebut
      const { data: finishedRooms } = await supabase
        .from("rooms")
        .select("id, pin_code, created_at, quiz_id, players(id)")
        .in("quiz_id", quizIds)
        .eq("status", "finished")
        .order("created_at", { ascending: false });

      if (finishedRooms) {
        const mapped: ReportRoom[] = (finishedRooms as RoomQueryRow[]).map(
          (r) => ({
            id: r.id,
            pin_code: r.pin_code,
            created_at: r.created_at,
            quiz_id: r.quiz_id,
            quiz_title: quizMap.get(r.quiz_id) || "Kuis",
            participant_count: r.players ? r.players.length : 0,
          }),
        );
        setRooms(mapped);
      }
      setLoading(false);
    }

    loadReports();
  }, [router]);

  const handleDeleteReport = async (e: React.MouseEvent, room: ReportRoom) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await window.modernConfirm(
      `Hapus laporan "${room.quiz_title}" (PIN: ${room.pin_code})?\nSemua data nilai siswa pada sesi ini juga akan terhapus permanen.`,
    );
    if (!confirmed) return;

    setDeletingId(room.id);
    try {
      // Hapus data peserta pada room ini terlebih dahulu agar aman dari constraint foreign key
      const { error: playersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", room.id);

      if (playersError) throw playersError;

      // Hapus room sesi kuis
      const { error: roomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", room.id);

      if (roomError) throw roomError;

      setRooms((prev) => prev.filter((item) => item.id !== room.id));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghapus laporan";
      alert(`Gagal menghapus laporan: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!teacher) return null;

  return (
    <main className="min-h-screen bg-[#F2F7FC] text-slate-800 pb-16">
      <header className="bg-white border-b-2 border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 leading-none">
                Laporan Kuis Selesai
              </h1>
              <span className="text-xs font-bold text-slate-400">
                Pilih sesi kelas untuk melihat nilai dan unduh PDF
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <FileBarChart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">
              Riwayat Kelas
            </h2>
            <p className="text-sm font-bold text-slate-500">
              Daftar sesi kuis yang telah Anda selesaikan
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 font-bold text-slate-400">
            Memuat laporan...
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white p-10 rounded-[28px] border-2 border-slate-200 text-center shadow-sm">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-xl font-black text-slate-700">
              Belum ada kelas yang selesai
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Mainkan kuis secara live bersama siswa untuk menghasilkan laporan
              di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => {
              const date = new Date(room.created_at).toLocaleDateString(
                "id-ID",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );

              const isDeleting = deletingId === room.id;

              return (
                <Link
                  key={room.id}
                  href={`/dashboard/reports/${room.id}`}
                  className="bg-white p-5 rounded-[24px] border-2 border-slate-200 border-b-[6px] hover:border-indigo-300 hover:shadow-md transition group flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black tracking-wider uppercase">
                        PIN: {room.pin_code}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <Clock className="w-3 h-3" /> {date}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight">
                      {room.quiz_title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 text-sm font-extrabold text-indigo-600">
                      <Users className="w-4 h-4" /> {room.participant_count}{" "}
                      Siswa
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteReport(e, room)}
                        disabled={isDeleting}
                        title="Hapus Laporan Sesi Ini"
                        className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="w-8 h-8 rounded-full bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-400 flex items-center justify-center transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
