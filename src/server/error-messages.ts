import type { ErrorCode } from "./action-result";

/** User-facing messages (Bahasa Indonesia) keyed by stable `reason` codes. */
export const reasonMessages: Record<string, string> = {
  // Generic / auth
  UNAUTHENTICATED: "Silakan masuk terlebih dahulu.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  NOT_ONBOARDED: "Lengkapi profil Anda terlebih dahulu.",
  INVALID_CREDENTIALS: "Email atau kata sandi salah.",
  EMAIL_NOT_CONFIRMED:
    "Email Anda belum dikonfirmasi. Periksa kotak masuk email Anda.",
  WEAK_PASSWORD: "Kata sandi terlalu lemah. Gunakan kombinasi yang lebih kuat.",
  SAME_PASSWORD: "Kata sandi baru harus berbeda dari kata sandi lama.",
  RATE_LIMITED: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  EMAIL_SEND_FAILED: "Email tidak dapat dikirim saat ini. Coba lagi nanti.",
  SIGNUP_DISABLED: "Pendaftaran sedang ditutup.",
  // Profile
  USERNAME_TAKEN: "Username sudah dipakai. Pilih username lain.",
  INVALID_USERNAME:
    "Username 3–30 karakter, hanya huruf kecil, angka, atau garis bawah (_).",
  INVALID_FULL_NAME: "Nama lengkap wajib diisi (maksimal 100 karakter).",
  TERMS_NOT_ACCEPTED: "Anda harus menyetujui Syarat & Ketentuan.",
  PROFILE_NOT_FOUND: "Profil tidak ditemukan.",
  INVALID_AVATAR_PATH: "File foto profil tidak valid. Unggah ulang.",
  // Verification
  VERIFICATION_PENDING:
    "Anda masih memiliki pengajuan verifikasi yang sedang ditinjau.",
  ALREADY_VERIFIED:
    "Verifikasi Anda masih berlaku. Perpanjangan dapat diajukan 30 hari sebelum masa berlaku habis.",
  UNIVERSITY_NOT_FOUND: "Kampus tidak ditemukan atau tidak aktif.",
  EMAIL_DOMAIN_NOT_ELIGIBLE:
    "Email akun Anda bukan email mahasiswa resmi kampus ini. Gunakan verifikasi dengan KTM.",
  INVALID_STUDENT_NUMBER: "NIM wajib diisi (maksimal 50 karakter).",
  DOCUMENT_NOT_FOUND: "Dokumen KTM tidak ditemukan. Unggah ulang dokumen Anda.",
  INVALID_METHOD: "Metode verifikasi tidak valid.",
  VERIFICATION_NOT_FOUND: "Pengajuan verifikasi tidak ditemukan.",
  CANNOT_REVIEW_OWN:
    "Anda tidak dapat meninjau pengajuan verifikasi milik sendiri.",
  NOT_PENDING: "Pengajuan ini sudah ditinjau.",
  VALID_UNTIL_OUT_OF_RANGE:
    "Tanggal berlaku harus setelah hari ini dan maksimal 24 bulan ke depan.",
  INVALID_REASON: "Alasan penolakan wajib diisi (maksimal 500 karakter).",
  INVALID_DECISION: "Keputusan tidak valid.",
  NOT_A_FREELANCER:
    "Profil freelancer tersedia setelah verifikasi mahasiswa disetujui.",
  FREELANCER_NOT_ELIGIBLE:
    "Hanya mahasiswa terverifikasi yang dapat melakukan tindakan ini.",
  INVALID_COVER_PATH: "Thumbnail layanan tidak valid. Unggah ulang.",
  COVER_IMAGE_REQUIRED: "Thumbnail wajib diunggah sebelum layanan dipublikasikan.",
  SERVICE_BLOCKED: "Layanan ini diblokir oleh admin.",
  SERVICE_ARCHIVED: "Layanan yang diarsipkan tidak dapat diubah.",
  MAX_PUBLISHED_SERVICES: "Anda telah mencapai batas layanan terpublikasi.",
  INVALID_SERVICE_TRANSITION: "Perubahan status layanan tidak valid.",
};

export const codeMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Periksa kembali isian Anda.",
  UNAUTHENTICATED: "Silakan masuk terlebih dahulu.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  NOT_FOUND: "Data tidak ditemukan.",
  INVALID_STATE: "Tindakan ini tidak dapat dilakukan saat ini.",
  CONFLICT: "Data bertentangan dengan data yang sudah ada.",
  LIMIT_REACHED: "Batas telah tercapai.",
  RATE_LIMITED: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  INTERNAL_ERROR: "Terjadi kesalahan. Silakan coba lagi.",
};

export function messageFor(code: ErrorCode, reason?: string): string {
  return (reason && reasonMessages[reason]) || codeMessages[code];
}
