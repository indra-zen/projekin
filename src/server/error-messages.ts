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
  COVER_IMAGE_REQUIRED:
    "Thumbnail wajib diunggah sebelum layanan dipublikasikan.",
  SERVICE_BLOCKED: "Layanan ini diblokir oleh admin.",
  SERVICE_ARCHIVED: "Layanan yang diarsipkan tidak dapat diubah.",
  MAX_PUBLISHED_SERVICES: "Anda telah mencapai batas layanan terpublikasi.",
  NOT_FOUND: "Data tidak ditemukan.",
  // Jobs & proposals
  JOB_NOT_FOUND: "Lowongan tidak ditemukan.",
  NOT_JOB_OWNER: "Hanya pemilik lowongan yang dapat melakukan tindakan ini.",
  JOB_NOT_OPEN: "Lowongan ini sudah tidak menerima proposal atau perekrutan.",
  JOB_NOT_EDITABLE:
    "Lowongan hanya dapat diubah selama masih dibuka dan belum menerima proposal. Tutup lowongan lalu buat yang baru.",
  MAX_ACTIVE_JOBS:
    "Anda sudah memiliki 10 lowongan aktif. Tutup salah satu terlebih dahulu.",
  OWN_JOB: "Anda tidak dapat mengirim proposal ke lowongan milik sendiri.",
  ALREADY_PROPOSED: "Anda sudah pernah mengirim proposal untuk lowongan ini.",
  MAX_PROPOSALS_PER_DAY:
    "Batas 30 proposal per 24 jam telah tercapai. Coba lagi nanti.",
  INVALID_COVER_LETTER: "Surat pengantar harus 50–3.000 karakter.",
  INVALID_PRICE: "Harga harus antara Rp10.000 dan Rp50.000.000.",
  INVALID_DELIVERY_DAYS: "Waktu pengerjaan harus 1–60 hari.",
  INVALID_REVISIONS: "Jumlah revisi harus 0–5.",
  PROPOSAL_NOT_FOUND: "Proposal tidak ditemukan.",
  PROPOSAL_NOT_SUBMITTED: "Proposal ini sudah diproses sebelumnya.",
  MAX_AWAITING_PAYMENT_ORDERS:
    "Anda memiliki 5 pesanan yang menunggu pembayaran. Selesaikan atau batalkan salah satu terlebih dahulu.",
  JOB_ALREADY_HIRED: "Lowongan ini sudah memiliki freelancer terpilih.",
  // Orders
  ORDER_NOT_FOUND: "Pesanan tidak ditemukan.",
  ORDER_NOT_CANCELLABLE: "Pesanan ini tidak dapat dibatalkan lagi.",
  INVALID_CANCEL_REASON:
    "Alasan pembatalan wajib diisi (maksimal 500 karakter).",
  SERVICE_NOT_AVAILABLE: "Layanan ini sedang tidak dapat dipesan.",
  OWN_SERVICE: "Anda tidak dapat memesan layanan milik sendiri.",
  INVALID_REQUIREMENTS: "Kebutuhan pesanan harus 10–5.000 karakter.",
  SERVICE_ORDER_PENDING:
    "Anda sudah memiliki pesanan layanan ini yang menunggu pembayaran. Bayar atau batalkan pesanan tersebut di halaman Pesanan.",
  NOT_ORDER_FREELANCER:
    "Hanya freelancer pesanan ini yang dapat melakukan tindakan ini.",
  NOT_ORDER_CLIENT:
    "Hanya klien pesanan ini yang dapat melakukan tindakan ini.",
  ORDER_NOT_IN_PROGRESS:
    "Hasil kerja hanya dapat dikirim saat pesanan sedang dikerjakan.",
  ORDER_NOT_DELIVERED:
    "Pesanan hanya dapat diselesaikan setelah freelancer mengirim hasil kerja.",
  INVALID_MESSAGE: "Pesan wajib diisi (maksimal 5.000 karakter).",
  TOO_MANY_ATTACHMENTS: "Maksimal 10 lampiran per pengiriman.",
  ATTACHMENT_NOT_FOUND: "Lampiran tidak ditemukan. Unggah ulang file Anda.",
  // Payments
  ORDER_NOT_AWAITING_PAYMENT: "Pesanan ini tidak sedang menunggu pembayaran.",
  PAYMENT_WINDOW_CLOSING:
    "Batas waktu pembayaran pesanan ini hampir habis atau sudah lewat, sehingga pembayaran baru tidak dapat dimulai.",
  PAYMENT_IN_PROGRESS:
    "Pembayaran sedang disiapkan. Tunggu sebentar lalu coba lagi.",
  MAX_PAYMENT_ATTEMPTS:
    "Batas percobaan pembayaran untuk pesanan ini sudah tercapai.",
  PAYMENT_NOT_FOUND: "Data pembayaran tidak ditemukan.",
  PAYMENT_NOT_INITIATED: "Pembayaran ini sudah diproses sebelumnya.",
  INVALID_SNAP_TOKEN: "Gagal menyiapkan pembayaran. Coba lagi.",
  INVALID_TOKEN_EXPIRY: "Gagal menyiapkan pembayaran. Coba lagi.",
  PAYMENT_PROVIDER_ERROR:
    "Layanan pembayaran Midtrans sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.",
  PAYMENT_NOT_CONFIGURED:
    "Pembayaran belum dikonfigurasi di server ini. Hubungi admin.",
  INVALID_SERVICE_TRANSITION: "Perubahan status layanan tidak valid.",
  CANNOT_MODERATE_SELF: "Anda tidak dapat memoderasi akun sendiri.",
  FREELANCER_NOT_FOUND: "Profil freelancer tidak ditemukan.",
  INVALID_BLOCK_REASON: "Alasan blokir wajib diisi dan maksimal 500 karakter.",
  SERVICE_NOT_FOUND: "Layanan tidak ditemukan.",
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
  PAYMENT_PROVIDER_ERROR:
    "Layanan pembayaran sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.",
  INTERNAL_ERROR: "Terjadi kesalahan. Silakan coba lagi.",
};

export function messageFor(code: ErrorCode, reason?: string): string {
  return (reason && reasonMessages[reason]) || codeMessages[code];
}
