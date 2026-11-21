"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserPlus,
  Users,
  KeyRound,
  Trash2,
  Pencil,
  Save,
  X,
  Eye,
  EyeOff,
  Search,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getTeacherSession,
  saveTeacherSession,
  isSuperAdmin,
  TeacherSession,
} from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

interface TeacherAccountRow {
  id: string;
  username: string;
  full_name: string;
  password?: string;
  password_hash?: string;
  created_at?: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [currentUser, setCurrentUser] = useState<TeacherSession | null>(null);
  const [accounts, setAccounts] = useState<TeacherAccountRow[]>([]);
  const [passwordColumn, setPasswordColumn] = useState<
    "password" | "password_hash"
  >("password");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Form tambah akun baru
  const [newFullName, setNewFullName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Modal edit akun & reset password
  const [editingAccount, setEditingAccount] =
    useState<TeacherAccountRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const rows = data as TeacherAccountRow[];
      if (
        rows.length > 0 &&
        "password_hash" in rows[0] &&
        !("password" in rows[0])
      ) {
        setPasswordColumn("password_hash");
      }
      setAccounts(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const session = getTeacherSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    // Proteksi ketat: hanya Super Admin yang diizinkan masuk
    if (!isSuperAdmin(session)) {
      alert(
        lang === "EN"
          ? "Access denied! Only Super Admin can manage user accounts."
          : "Akses ditolak! Hanya Super Admin yang dapat mengelola akun pengguna.",
      );
      router.replace("/dashboard");
      return;
    }

    setCurrentUser(session);
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFullName.trim();
    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();

    if (!cleanName || !cleanUser || !cleanPass) return;

    if (cleanPass.length < 4) {
      alert(
        lang === "EN"
          ? "Password must be at least 4 characters!"
          : "Password minimal terdiri dari 4 karakter!",
      );
      return;
    }

    const exists = accounts.some(
      (acc) => acc.username.toLowerCase() === cleanUser.toLowerCase(),
    );
    if (exists) {
      alert(
        lang === "EN"
          ? `Username "${cleanUser}" is already taken!`
          : `Username "${cleanUser}" sudah digunakan!`,
      );
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("teachers").insert([
      {
        full_name: cleanName,
        username: cleanUser,
        [passwordColumn]: cleanPass,
      },
    ]);
    setCreating(false);

    if (error) {
      alert(
        lang === "EN"
          ? `Failed to create account: ${error.message}`
          : `Gagal menambahkan akun: ${error.message}`,
      );
      return;
    }

    sound.playCorrect();
    setNewFullName("");
    setNewUsername("");
    setNewPassword("");
    await loadAccounts();
    alert(
      lang === "EN"
        ? `Account "${cleanUser}" created successfully!`
        : `Akun "${cleanUser}" berhasil dibuat!`,
    );
  };

  const openEditModal = (acc: TeacherAccountRow) => {
    setEditingAccount(acc);
    setEditFullName(acc.full_name);
    setEditUsername(acc.username);
    setEditPassword(acc.password ?? acc.password_hash ?? "");
    setShowEditPassword(false);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    const cleanName = editFullName.trim();
    const cleanUser = editUsername.trim();
    const cleanPass = editPassword.trim();

    if (!cleanName || !cleanUser || !cleanPass) {
      alert(
        lang === "EN"
          ? "Full name, username, and password cannot be empty!"
          : "Nama lengkap, username, dan password tidak boleh kosong!",
      );
      return;
    }

    const duplicate = accounts.some(
      (acc) =>
        acc.id !== editingAccount.id &&
        acc.username.toLowerCase() === cleanUser.toLowerCase(),
    );
    if (duplicate) {
      alert(
        lang === "EN"
          ? `Username "${cleanUser}" is already used by another account!`
          : `Username "${cleanUser}" sudah dipakai akun lain!`,
      );
      return;
    }

    setUpdating(true);
    const { error } = await supabase
      .from("teachers")
      .update({
        full_name: cleanName,
        username: cleanUser,
        [passwordColumn]: cleanPass,
      })
      .eq("id", editingAccount.id);
    setUpdating(false);

    if (error) {
      alert(
        lang === "EN"
          ? `Failed to update account: ${error.message}`
          : `Gagal memperbarui akun: ${error.message}`,
      );
      return;
    }

    if (currentUser && currentUser.id === editingAccount.id) {
      const updatedSession: TeacherSession = {
        ...currentUser,
        full_name: cleanName,
        username: cleanUser,
      };
      saveTeacherSession(updatedSession);
      setCurrentUser(updatedSession);
    }

    sound.playPowerUp();
    setEditingAccount(null);
    await loadAccounts();
    alert(
      lang === "EN"
        ? "Account and password updated successfully!"
        : "Data akun dan password berhasil diperbarui!",
    );
  };

  const handleDeleteAccount = async (acc: TeacherAccountRow) => {
    if (currentUser && acc.id === currentUser.id) {
      alert(
        lang === "EN"
          ? "You cannot delete the Super Admin account you are currently logged into!"
          : "Anda tidak dapat menghapus akun Super Admin yang sedang digunakan!",
      );
      return;
    }

    const msg =
      lang === "EN"
        ? `Delete account "${acc.full_name}" (@${acc.username})?\nThis action cannot be undone.`
        : `Hapus akun "${acc.full_name}" (@${acc.username})?\nTindakan ini tidak dapat dibatalkan.`;

    if (!(await window.modernConfirm(msg))) return;

    const { error } = await supabase.from("teachers").delete().eq("id", acc.id);
    if (error) {
      alert(
        lang === "EN"
          ? `Failed to delete account: ${error.message}`
          : `Gagal menghapus akun: ${error.message}`,
      );
      return;
    }

    setAccounts((prev) => prev.filter((item) => item.id !== acc.id));
  };

  if (!currentUser || !isSuperAdmin(currentUser)) return null;

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
                {lang === "EN"
                  ? "User & Password Management"
                  : "Manajemen Akun & Password"}
              </h1>
              <span className="text-xs font-bold text-slate-400">
                {lang === "EN"
                  ? "Super Admin Control Panel"
                  : "Panel Kontrol Khusus Super Admin"}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Super Admin: {currentUser.full_name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleCreateAccount}
          className="lg:col-span-4 bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 text-[#2B90FF] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-slate-800">
                {lang === "EN" ? "Create New Account" : "Tambah Akun Baru"}
              </h2>
              <p className="text-xs font-semibold text-slate-400">
                {lang === "EN"
                  ? "Register a new teacher login"
                  : "Daftarkan akses login pengajar baru"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              {lang === "EN" ? "FULL NAME *" : "NAMA LENGKAP *"}
            </label>
            <input
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder={
                lang === "EN" ? "e.g. Ms. Sarah" : "Contoh: Ibu Siti Aminah"
              }
              className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              USERNAME *
            </label>
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) =>
                setNewUsername(e.target.value.replace(/\s+/g, ""))
              }
              placeholder={
                lang === "EN" ? "e.g. sarah_chem" : "Contoh: siti_ipa"
              }
              className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
              PASSWORD *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={
                  lang === "EN" ? "Min. 4 characters" : "Minimal 4 karakter"
                }
                className="w-full pl-4 pr-11 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-2 w-full py-3.5 rounded-2xl bg-[#22C55E] hover:bg-[#1EB054] disabled:opacity-50 active:translate-y-0.5 text-white font-black text-sm flex items-center justify-center gap-2 border-b-4 border-[#15803D] shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {creating
                ? lang === "EN"
                  ? "Saving..."
                  : "Menyimpan..."
                : lang === "EN"
                  ? "Save New Account"
                  : "Simpan Akun Baru"}
            </span>
          </button>
        </form>

        <div className="lg:col-span-8 bg-white p-6 rounded-[28px] border-2 border-slate-200/90 border-b-[6px] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-lg text-slate-800">
                  {lang === "EN"
                    ? `Registered Accounts (${accounts.length})`
                    : `Daftar Akun Terdaftar (${accounts.length})`}
                </h2>
                <p className="text-xs font-bold text-slate-400">
                  {lang === "EN"
                    ? "Click Edit / Password to update user credentials"
                    : "Klik Edit / Password untuk mengubah data atau kata sandi"}
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "EN"
                    ? "Search name or user..."
                    : "Cari nama / username..."
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none text-xs font-bold text-slate-700"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center font-bold text-slate-400">
              {lang === "EN" ? "Loading accounts..." : "Memuat daftar akun..."}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="py-14 text-center font-bold text-slate-400 bg-[#F8FBFF] rounded-2xl border border-slate-200">
              {lang === "EN"
                ? "No matching accounts found."
                : "Tidak ada akun yang cocok."}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredAccounts.map((acc) => {
                const isSelf = currentUser.id === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="p-4 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 text-white font-black text-base flex items-center justify-center shrink-0">
                        {acc.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm sm:text-base text-slate-800 truncate">
                            {acc.full_name}
                          </p>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black shrink-0">
                              Super Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-500">
                          Username:{" "}
                          <span className="text-[#1E82F5]">
                            @{acc.username}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(acc)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-black text-xs transition cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Edit / Password</span>
                      </button>

                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc)}
                          title={
                            lang === "EN" ? "Delete Account" : "Hapus Akun"
                          }
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-200 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateAccount}
            className="w-full max-w-md bg-white rounded-[28px] border-2 border-slate-200 border-b-8 p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 leading-none">
                    {lang === "EN"
                      ? "Edit Account & Password"
                      : "Ubah Akun & Password"}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    @{editingAccount.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                {lang === "EN" ? "FULL NAME" : "NAMA LENGKAP"}
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                USERNAME
              </label>
              <input
                type="text"
                required
                value={editUsername}
                onChange={(e) =>
                  setEditUsername(e.target.value.replace(/\s+/g, ""))
                }
                className="w-full px-4 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                {lang === "EN" ? "NEW PASSWORD" : "PASSWORD BARU"}
              </label>
              <div className="relative">
                <input
                  type={showEditPassword ? "text" : "password"}
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-2xl bg-[#F8FBFF] border-2 border-slate-200 focus:border-[#2B90FF] focus:outline-none font-bold text-sm text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showEditPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm cursor-pointer"
              >
                {lang === "EN" ? "Cancel" : "Batal"}
              </button>

              <button
                type="submit"
                disabled={updating}
                className="flex-1 py-3 rounded-2xl bg-[#2B90FF] hover:bg-[#1D7AFC] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-1.5 border-b-4 border-[#1359B8] cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {updating
                    ? lang === "EN"
                      ? "Saving..."
                      : "Menyimpan..."
                    : lang === "EN"
                      ? "Save Changes"
                      : "Simpan Perubahan"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
