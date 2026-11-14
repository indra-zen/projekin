import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

const sections = [
  {
    heading: "1. Data yang kami simpan",
    body: [
      "Akun: email dan kata sandi (disimpan terenkripsi oleh Supabase Auth). Profil: nama lengkap, username, bio, lokasi, dan foto profil. Freelancer: kampus, jurusan, keahlian, portofolio, dan dokumen verifikasi (KTM).",
      "Transaksi: pesanan, pesan, file hasil kerja, ulasan, dan status pembayaran dari Midtrans. Kami tidak menyimpan data kartu atau rekening Anda.",
    ],
  },
  {
    heading: "2. Siapa yang dapat melihat data Anda",
    body: [
      "Publik: nama, username, bio, profil freelancer, portofolio, layanan, dan ulasan. Email Anda tidak pernah ditampilkan.",
      "Hanya Anda dan admin: dokumen verifikasi mahasiswa. Hanya klien, freelancer, dan admin pesanan terkait: isi pesanan, pesan, dan file hasil kerja (diunduh lewat tautan sementara).",
    ],
  },
  {
    heading: "3. Untuk apa data digunakan",
    body: [
      "Untuk menjalankan marketplace: verifikasi mahasiswa, memproses pesanan dan pembayaran, menyelesaikan sengketa, dan menampilkan rating.",
    ],
  },
  {
    heading: "4. Pihak ketiga",
    body: [
      "Supabase (basis data, autentikasi, dan penyimpanan file), Midtrans (pembayaran, mode Sandbox), dan Vercel (hosting).",
    ],
  },
  {
    heading: "5. Penyimpanan dan hak Anda",
    body: [
      "Dokumen verifikasi disimpan selama masa verifikasi berlaku. Anda dapat memperbarui profil kapan saja. Untuk menghapus akun atau data, hubungi admin Projekin.",
    ],
  },
];

export default function Page() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      updated="14 November 2026"
      sections={sections}
    />
  );
}
