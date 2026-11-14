import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

const sections = [
  {
    heading: "1. Tentang Projekin",
    body: [
      "Projekin adalah marketplace yang mempertemukan klien dengan mahasiswa yang menawarkan jasa. Klien dapat memesan layanan yang dipublikasikan freelancer atau memasang lowongan dan memilih proposal.",
    ],
  },
  {
    heading: "2. Akun",
    body: [
      "Anda wajib memberikan data yang benar, menjaga kerahasiaan kata sandi, dan bertanggung jawab atas aktivitas di akun Anda. Satu akun dapat bertindak sebagai klien dan sebagai freelancer.",
    ],
  },
  {
    heading: "3. Freelancer mahasiswa",
    body: [
      "Hanya mahasiswa aktif yang lolos verifikasi (dokumen KTM atau email kampus) yang dapat menjadi freelancer, mempublikasikan layanan, dan mengirim proposal. Admin dapat menolak verifikasi atau menangguhkan freelancer yang melanggar ketentuan.",
    ],
  },
  {
    heading: "4. Pesanan dan pembayaran",
    body: [
      "Harga yang tertera adalah harga yang dibayar klien. Projekin memotong biaya platform 10% dari pendapatan freelancer. Pesanan baru dikerjakan setelah pembayaran terkonfirmasi oleh Midtrans; pesanan yang tidak dibayar dalam 24 jam dibatalkan otomatis.",
      "Freelancer mengirim hasil kerja, lalu klien menerima hasil atau meminta revisi sesuai jatah revisi. Hasil kerja yang tidak ditanggapi selama 3 hari dianggap diterima.",
    ],
  },
  {
    heading: "5. Pembatalan, sengketa, dan pengembalian dana",
    body: [
      "Pesanan yang belum dibayar dapat dibatalkan oleh kedua pihak. Setelah dibayar, freelancer dapat membatalkan sebelum mengirim hasil kerja dan dana dikembalikan ke klien.",
      "Jika ada masalah, klien atau freelancer dapat membuka sengketa. Admin meninjau pesan dan hasil kerja, lalu memutuskan dana diteruskan ke freelancer atau dikembalikan penuh ke klien. Pengembalian dan pencairan dana diproses manual oleh admin.",
    ],
  },
  {
    heading: "6. Konten dan perilaku",
    body: [
      "Dilarang menawarkan atau meminta jasa yang melanggar hukum atau melanggar integritas akademik (misalnya mengerjakan ujian atau tugas kuliah orang lain), serta mengunggah konten yang bukan milik Anda. Admin dapat memblokir layanan yang melanggar.",
    ],
  },
  {
    heading: "7. Ulasan",
    body: [
      "Setelah pesanan selesai, kedua pihak dapat saling memberi satu ulasan dalam 14 hari. Ulasan bersifat publik dan tidak dapat diubah.",
    ],
  },
  {
    heading: "8. Batasan",
    body: [
      "Projekin disediakan apa adanya untuk keperluan pembelajaran. Kami tidak menjamin layanan selalu tersedia dan tidak bertanggung jawab atas kesepakatan di luar platform.",
    ],
  },
];

export default function Page() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      updated="14 November 2026"
      sections={sections}
    />
  );
}
