// Demo content for scripts/seed-demo (Bahasa Indonesia, Tarakan context).
// Every person, business and address is fictional; e-mail addresses use the
// reserved example.com domain, so no message can ever reach a real inbox.

const WITA = 8 * 60 * 60 * 1000; // Tarakan is UTC+8

/** ISO timestamp `days` days ago at local (WITA) time `hhmm`, e.g. ago(3, "14:05"). */
export function ago(days, hhmm = "10:00", now = Date.now()) {
  const [h, m] = hhmm.split(":").map(Number);
  const local = new Date(now + WITA);
  local.setUTCDate(local.getUTCDate() - days);
  local.setUTCHours(h, m, 0, 0);
  const t = local.getTime() - WITA;
  // Never in the future (a "today" time later than now becomes 5 minutes ago).
  return new Date(Math.min(t, now - 5 * 60 * 1000)).toISOString();
}

/** ISO timestamp `hours` hours ago. */
export const hoursAgo = (hours, now = Date.now()) =>
  new Date(now - hours * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// People. `login` is the role label written to .demo-accounts; the first three
// (admin, freelancer, klien) are the accounts the browser tests sign in with.
// ---------------------------------------------------------------------------

export const users = [
  // Admins
  {
    key: "admin",
    login: "admin",
    email: "demo.admin@example.com",
    fullName: "Admin Projekin",
    username: "admin_projekin",
    admin: true,
    joined: 70,
    color: "#7b4fb8",
    bio: "Tim pengelola Projekin. Memverifikasi mahasiswa, menengahi sengketa, dan memproses pencairan dana.",
    location: "Tarakan, Kalimantan Utara",
  },
  {
    key: "sari",
    login: "admin-2",
    email: "sari.admin@example.com",
    fullName: "Sari Wulandari",
    username: "sari_moderator",
    admin: true,
    joined: 66,
    color: "#f56b9a",
    bio: "Moderator konten dan verifikasi mahasiswa.",
    location: "Tarakan",
  },

  // Student freelancers (verified with a student card, approved by an admin)
  {
    key: "rina",
    login: "freelancer",
    email: "demo.freelancer@example.com",
    fullName: "Rina Pratiwi",
    username: "rina_desain",
    joined: 64,
    color: "#ffb86b",
    uni: "STMIK PPKIA",
    nim: "2250013",
    major: "Sistem Informasi",
    bio: "Mahasiswi Sistem Informasi semester 5. Suka membantu UMKM tampil lebih rapi lewat logo, kemasan, dan konten Instagram yang konsisten.",
    location: "Tarakan Barat",
    headline:
      "Desainer grafis untuk UMKM: logo, branding, dan konten media sosial",
    skills: [
      "Desain Logo",
      "Branding",
      "Adobe Illustrator",
      "Canva",
      "Desain Kemasan",
    ],
  },
  {
    key: "dimas",
    login: "freelancer-2",
    email: "dimas.saputra@example.com",
    fullName: "Dimas Saputra",
    username: "dimas_webdev",
    joined: 63,
    color: "#9165c7",
    uni: "STMIK PPKIA",
    nim: "2150021",
    major: "Teknik Informatika",
    bio: "Mahasiswa Teknik Informatika, sudah membuat lebih dari 10 website untuk usaha lokal dan organisasi kampus.",
    location: "Tarakan Tengah",
    headline: "Web developer Next.js dan Laravel untuk usaha lokal",
    skills: ["Next.js", "React", "Tailwind CSS", "Laravel", "MySQL"],
  },
  {
    key: "nurul",
    login: "freelancer-3",
    email: "nurul.aini@example.com",
    fullName: "Nurul Aini",
    username: "nurul_menulis",
    joined: 62,
    color: "#c9f2c7",
    uni: "UBT",
    nim: "2240317",
    major: "Pendidikan Bahasa Inggris",
    bio: "Penulis konten dan penerjemah Inggris–Indonesia. Terbiasa menulis artikel SEO dan menyunting naskah akademik.",
    location: "Tarakan Utara",
    headline: "Penulis konten dan penerjemah Inggris–Indonesia",
    skills: [
      "Penulisan Artikel",
      "SEO",
      "Terjemahan",
      "Proofreading",
      "Copywriting",
    ],
  },
  {
    key: "andi",
    login: "freelancer-4",
    email: "andi.wijaya@example.com",
    fullName: "Andi Wijaya",
    username: "andi_motion",
    joined: 60,
    color: "#ffe27a",
    uni: "UBT",
    nim: "2140452",
    major: "Ilmu Komunikasi",
    bio: "Editor video dan motion graphic. Fokus pada video pendek yang menarik untuk Reels dan TikTok.",
    location: "Tarakan Timur",
    headline: "Editor video dan motion graphic untuk Reels dan TikTok",
    skills: [
      "Premiere Pro",
      "After Effects",
      "CapCut",
      "Motion Graphic",
      "Color Grading",
    ],
  },
  {
    key: "putri",
    login: "freelancer-5",
    email: "putri.lestari@example.com",
    fullName: "Putri Lestari",
    username: "putri_sosmed",
    joined: 58,
    color: "#ffd6e2",
    uni: "STMIK PPKIA",
    nim: "2250088",
    major: "Manajemen Informatika",
    bio: "Mengelola akun media sosial beberapa UMKM kuliner di Tarakan. Paham iklan Meta dan perencanaan konten bulanan.",
    location: "Tarakan Barat",
    headline: "Pengelola media sosial dan iklan digital untuk UMKM",
    skills: [
      "Instagram Ads",
      "Meta Business Suite",
      "Content Planning",
      "Copywriting",
      "Analitik",
    ],
  },
  {
    key: "fajar",
    login: "freelancer-6",
    email: "fajar.ramadhan@example.com",
    fullName: "Fajar Ramadhan",
    username: "fajar_uiux",
    joined: 57,
    color: "#7b4fb8",
    uni: "UBT",
    nim: "2140199",
    major: "Teknik Informatika",
    bio: "UI/UX designer. Merancang aplikasi mobile dan website yang mudah dipakai, dari riset sampai prototipe Figma.",
    location: "Tarakan Tengah",
    headline: "UI/UX designer: Figma, prototipe, dan design system",
    skills: [
      "Figma",
      "UI Design",
      "UX Research",
      "Prototyping",
      "Design System",
    ],
  },

  // Applicants: one waiting in the admin queue, one rejected
  {
    key: "yoga",
    login: "pemohon",
    email: "yoga.pratama@example.com",
    fullName: "Yoga Pratama",
    username: "yoga_foto",
    joined: 6,
    color: "#ffb86b",
    uni: "UBT",
    nim: "2340061",
    major: "Ilmu Komunikasi",
    bio: "Mahasiswa baru, hobi fotografi. Sedang menunggu verifikasi untuk membuka jasa foto produk.",
    location: "Tarakan",
  },
  {
    key: "melati",
    login: "ditolak",
    email: "melati.kusuma@example.com",
    fullName: "Melati Kusuma",
    username: "melati_k",
    joined: 9,
    color: "#9165c7",
    uni: "STMIK PPKIA",
    nim: "2350102",
    major: "Teknik Informatika",
    location: "Tarakan",
  },

  // Clients
  {
    key: "budi",
    login: "klien",
    email: "demo.klien@example.com",
    fullName: "Budi Santoso",
    username: "budi_kopi",
    joined: 61,
    color: "#f56b9a",
    bio: "Pemilik Kedai Kopi Senja di Tarakan. Sedang membangun merek dan pemasaran online kedai.",
    location: "Jl. Yos Sudarso, Tarakan",
  },
  {
    key: "maya",
    login: "klien-2",
    email: "maya.anggraini@example.com",
    fullName: "Maya Anggraini",
    username: "maya_kue",
    joined: 55,
    color: "#c9f2c7",
    bio: "Usaha kue rumahan Dapur Maya. Menerima pesanan kue ulang tahun dan hampers.",
    location: "Karang Anyar, Tarakan",
  },
  {
    key: "hendra",
    login: "klien-3",
    email: "hendra.gunawan@example.com",
    fullName: "Hendra Gunawan",
    username: "hendra_bengkel",
    joined: 52,
    color: "#ffe27a",
    bio: "Bengkel Motor Gunawan Jaya, servis dan suku cadang motor sejak 2015.",
    location: "Juata, Tarakan",
  },
  {
    key: "lina",
    login: "klien-4",
    email: "lina.marlina@example.com",
    fullName: "Lina Marlina",
    username: "lina_peneliti",
    joined: 45,
    color: "#ffd6e2",
    bio: "Dosen dan peneliti bidang perikanan. Sering membutuhkan terjemahan dan penyuntingan artikel ilmiah.",
    location: "Tarakan",
  },
  {
    key: "rizky",
    login: "klien-5",
    email: "rizky.hidayat@example.com",
    fullName: "Rizky Hidayat",
    username: "rizky_kirim",
    joined: 40,
    color: "#9165c7",
    bio: "Pendiri KirimCepat Tarakan, layanan antar barang dalam kota.",
    location: "Tarakan Tengah",
  },
  {
    key: "ayu",
    login: "klien-6",
    email: "ayu.permata@example.com",
    fullName: "Ayu Permatasari",
    username: "ayu_wedding",
    joined: 33,
    color: "#ffb86b",
    bio: "Wedding organizer Permata Organizer.",
    location: "Tarakan Barat",
  },
];

/** Users whose verification is approved (the student freelancers). */
export const verifiedFreelancers = [
  "rina",
  "dimas",
  "nurul",
  "andi",
  "putri",
  "fajar",
];

/** Admin approving each freelancer, and when (days ago). */
export const verificationReview = {
  rina: { admin: "admin", submitted: 63, reviewed: 62 },
  dimas: { admin: "admin", submitted: 62, reviewed: 62 },
  nurul: { admin: "sari", submitted: 61, reviewed: 60 },
  andi: { admin: "admin", submitted: 59, reviewed: 58 },
  putri: { admin: "sari", submitted: 57, reviewed: 56 },
  fajar: { admin: "admin", submitted: 56, reviewed: 55 },
};

// ---------------------------------------------------------------------------
// Services. Status defaults to published; covers are generated per service.
// ---------------------------------------------------------------------------

export const services = [
  {
    key: "logo",
    cover: "Logo UMKM",
    by: "rina",
    cat: "desain",
    days: 62,
    title: "Desain logo profesional untuk UMKM",
    price: 350000,
    delivery: 4,
    revisions: 2,
    art: "logo",
    description:
      "Logo yang mudah diingat dan sesuai karakter usaha Anda. Saya mulai dari brief singkat, lalu membuat 3 konsep awal untuk dipilih. Konsep terpilih disempurnakan sampai Anda puas sesuai jumlah revisi.\n\nYang Anda dapatkan:\n- 3 konsep awal\n- File PNG transparan, JPG, dan PDF\n- Versi warna dan hitam-putih\n- Panduan warna dan font sederhana",
    requirements:
      "Ceritakan nama usaha, produk utama, target pembeli, dan warna atau gaya yang Anda sukai. Lampirkan contoh logo yang Anda suka jika ada.",
  },
  {
    key: "feed",
    cover: "9 Feed Instagram",
    by: "rina",
    cat: "desain",
    days: 61,
    title: "Paket 9 desain feed Instagram siap posting",
    price: 250000,
    delivery: 3,
    revisions: 1,
    art: "social",
    description:
      "Sembilan desain feed Instagram dengan gaya yang konsisten, siap diunggah. Cocok untuk promo menu, produk baru, atau informasi jam buka.\n\nTermasuk:\n- 9 desain ukuran 1080 × 1350 px\n- Template Canva yang bisa Anda edit sendiri\n- Penyesuaian dengan warna merek Anda",
    requirements:
      "Kirim logo, foto produk (jika ada), dan daftar isi untuk setiap postingan.",
  },
  {
    key: "kemasan",
    cover: "Kemasan & Label",
    by: "rina",
    cat: "desain",
    days: 50,
    title: "Desain kemasan produk dan stiker label",
    price: 300000,
    delivery: 5,
    revisions: 2,
    art: "package",
    description:
      "Desain kemasan dan label stiker untuk produk makanan, minuman, atau kerajinan. Saya siapkan file siap cetak lengkap dengan bleed dan ukuran yang sesuai dengan percetakan Anda.\n\nTermasuk mockup 3D untuk promosi di media sosial.",
    requirements:
      "Sebutkan ukuran kemasan, jenis bahan, dan informasi wajib di label (komposisi, berat bersih, PIRT, dan lain-lain).",
  },
  {
    key: "kartu",
    by: "rina",
    cat: "desain",
    days: 5,
    title: "Desain kartu nama dan kop surat usaha",
    price: 100000,
    delivery: 2,
    revisions: 1,
    art: "logo",
    status: "draft",
    cover: false,
    description:
      "Kartu nama dua sisi dan kop surat yang serasi dengan logo usaha Anda. File siap cetak dalam format PDF dan PNG.",
  },
  {
    key: "compro",
    cover: "Company Profile",
    by: "dimas",
    cat: "pengembangan",
    days: 61,
    title: "Website company profile dengan Next.js",
    price: 1500000,
    delivery: 10,
    revisions: 2,
    art: "web",
    description:
      "Website company profile yang cepat, rapi di ponsel, dan mudah ditemukan di Google. Dibangun dengan Next.js dan Tailwind CSS.\n\nTermasuk:\n- Hingga 5 halaman (Beranda, Tentang, Layanan, Galeri, Kontak)\n- Tombol WhatsApp dan peta lokasi\n- Optimasi SEO dasar\n- Bantuan deploy ke hosting gratis atau domain Anda",
    requirements:
      "Kirim profil usaha, logo, foto, dan daftar layanan. Sebutkan juga website referensi yang Anda suka.",
  },
  {
    key: "landing",
    cover: "Landing Page",
    by: "dimas",
    cat: "pengembangan",
    days: 60,
    title: "Landing page promosi produk, responsif dan cepat",
    price: 750000,
    delivery: 6,
    revisions: 2,
    art: "web",
    description:
      "Satu halaman promosi yang fokus mengubah pengunjung menjadi pembeli: judul yang kuat, keunggulan produk, testimoni, dan tombol pemesanan yang jelas.\n\nSkor Lighthouse di atas 90 dan tampilan rapi di semua ukuran layar.",
    requirements:
      "Jelaskan produk yang dipromosikan, harga, dan tujuan halaman (pesan lewat WhatsApp, formulir, atau marketplace).",
  },
  {
    key: "bugfix",
    cover: "Perbaikan Laravel",
    by: "dimas",
    cat: "pengembangan",
    days: 45,
    title: "Perbaikan bug dan optimasi website Laravel",
    price: 400000,
    delivery: 3,
    revisions: 1,
    art: "code",
    description:
      "Website Laravel Anda error, lambat, atau tampilannya berantakan? Saya bantu menelusuri masalah, memperbaiki bug, dan mempercepat halaman yang lambat. Anda mendapat laporan singkat tentang apa yang diperbaiki.",
    requirements:
      "Jelaskan masalahnya, versi Laravel, dan cara saya mendapatkan akses ke kode (repositori atau file zip).",
  },
  {
    key: "artikel",
    cover: "Artikel SEO",
    by: "nurul",
    cat: "penulisan",
    days: 60,
    title: "Artikel SEO 1.000 kata dalam bahasa Indonesia",
    price: 120000,
    delivery: 2,
    revisions: 1,
    art: "doc",
    description:
      "Artikel orisinal 1.000 kata yang enak dibaca dan dioptimasi untuk kata kunci Anda. Setiap artikel lolos pemeriksaan plagiarisme dan dilengkapi meta description.\n\nCocok untuk blog usaha, website sekolah, atau toko online.",
    requirements:
      "Berikan topik, kata kunci utama, target pembaca, dan contoh gaya tulisan yang Anda inginkan.",
  },
  {
    key: "terjemah",
    cover: "Terjemahan EN ⇄ ID",
    by: "nurul",
    cat: "penulisan",
    days: 59,
    title: "Terjemahan Inggris–Indonesia per 1.000 kata",
    price: 150000,
    delivery: 3,
    revisions: 1,
    art: "doc",
    description:
      "Terjemahan dua arah Inggris–Indonesia yang akurat dan alami, bukan terjemahan mesin. Berpengalaman menerjemahkan dokumen akademik, profil usaha, dan materi pemasaran.",
    requirements:
      "Lampirkan dokumen yang akan diterjemahkan dan sebutkan arah terjemahan serta tenggat Anda.",
  },
  {
    key: "proofread",
    cover: "Proofreading Jurnal",
    by: "nurul",
    cat: "penulisan",
    days: 40,
    title: "Proofreading abstrak dan artikel jurnal ilmiah",
    price: 100000,
    delivery: 2,
    revisions: 2,
    art: "doc",
    description:
      "Penyuntingan tata bahasa, ejaan, dan kejelasan kalimat untuk abstrak dan artikel jurnal, dalam bahasa Indonesia maupun Inggris. Perubahan ditandai dengan track changes agar mudah Anda tinjau.",
  },
  {
    key: "reels",
    cover: "Reels & TikTok",
    by: "andi",
    cat: "video",
    days: 57,
    title: "Edit video Reels atau TikTok hingga 60 detik",
    price: 150000,
    delivery: 2,
    revisions: 2,
    art: "video",
    description:
      "Video pendek yang menarik sejak detik pertama: potongan cepat, teks animasi, musik bebas royalti, dan subtitle. Anda cukup mengirim rekaman mentah dari ponsel.",
    requirements:
      "Kirim rekaman mentah (link Google Drive), pesan utama video, dan contoh video yang Anda suka.",
  },
  {
    key: "motion",
    cover: "Animasi Logo",
    by: "andi",
    cat: "video",
    days: 55,
    title: "Animasi logo motion graphic 5–10 detik",
    price: 400000,
    delivery: 5,
    revisions: 2,
    art: "motion",
    description:
      "Logo Anda dihidupkan menjadi animasi pendek untuk pembuka video, story Instagram, atau presentasi. Termasuk efek suara dan versi format vertikal maupun horizontal.",
    requirements:
      "Kirim file logo dalam format vektor (AI, SVG, atau PDF) dan gaya animasi yang diinginkan.",
  },
  {
    key: "profilvideo",
    cover: "Video Profil Usaha",
    by: "andi",
    cat: "video",
    days: 30,
    title: "Video profil usaha berdurasi 2 menit",
    price: 900000,
    delivery: 10,
    revisions: 2,
    art: "video",
    status: "paused",
    description:
      "Video profil usaha lengkap dari naskah, pengambilan gambar di lokasi Tarakan, hingga penyuntingan akhir. Sedang dijeda karena jadwal kuliah lapangan.",
  },
  {
    key: "kelolaig",
    cover: "Kelola Instagram",
    by: "putri",
    cat: "pemasaran",
    days: 56,
    title: "Kelola Instagram bisnis selama 1 bulan",
    price: 1200000,
    delivery: 30,
    revisions: 0,
    art: "social",
    description:
      "Akun Instagram usaha Anda dikelola selama 30 hari: rencana konten, 12 postingan feed, 20 story, balas komentar, dan laporan performa di akhir bulan.",
    requirements:
      "Berikan akses akun (atau jadikan saya editor di Meta Business Suite), logo, dan foto produk terbaru.",
  },
  {
    key: "iklan",
    cover: "Iklan Instagram",
    by: "putri",
    cat: "pemasaran",
    days: 54,
    title: "Setup dan optimasi iklan Instagram dan Facebook",
    price: 500000,
    delivery: 5,
    revisions: 1,
    art: "chart",
    description:
      "Saya siapkan kampanye iklan Meta dari nol: target audiens lokal, materi iklan, dan pengaturan anggaran. Setelah berjalan, saya optimasi selama 5 hari dan memberi laporan hasil.",
    requirements:
      "Sebutkan produk yang diiklankan, anggaran iklan harian, dan area target (misalnya Tarakan dan sekitarnya).",
  },
  {
    key: "uiapp",
    cover: "UI Aplikasi Mobile",
    by: "fajar",
    cat: "desain",
    days: 55,
    title: "Desain UI aplikasi mobile di Figma (5 layar)",
    price: 850000,
    delivery: 7,
    revisions: 2,
    art: "app",
    description:
      "Lima layar aplikasi mobile yang modern dan konsisten, lengkap dengan komponen dan panduan warna di Figma. Cocok untuk tugas akhir, startup, atau presentasi ke investor.",
    requirements:
      "Jelaskan tujuan aplikasi, pengguna utamanya, dan daftar layar yang dibutuhkan.",
  },
  {
    key: "prototipe",
    cover: "Prototipe Figma",
    by: "fajar",
    cat: "desain",
    days: 50,
    title: "Prototipe website interaktif di Figma",
    price: 600000,
    delivery: 5,
    revisions: 2,
    art: "web",
    description:
      "Prototipe website yang bisa diklik untuk menguji alur sebelum dibangun. Termasuk versi desktop dan ponsel, serta catatan untuk developer.",
  },
];

// ---------------------------------------------------------------------------
// Portfolio items (one generated image each).
// ---------------------------------------------------------------------------

export const portfolio = [
  {
    by: "rina",
    title: "Identitas visual Warung Sambal Bu Ani",
    short: "Warung Sambal Bu Ani",
    art: "logo",
    description:
      "Logo, kemasan sambal botol, dan stiker label untuk usaha sambal rumahan (proyek kelas kewirausahaan).",
  },
  {
    by: "rina",
    title: "Konten Instagram Himpunan Mahasiswa SI",
    short: "Konten Himpunan SI",
    art: "social",
    description:
      "Seri konten feed dan story untuk kegiatan himpunan selama satu semester.",
  },
  {
    by: "dimas",
    title: "Website Seminar Nasional Teknologi Kampus",
    short: "Seminar Nasional",
    art: "web",
    description:
      "Website pendaftaran seminar dengan Next.js dan formulir pendaftaran online untuk 300 peserta.",
  },
  {
    by: "dimas",
    title: "Sistem kasir sederhana untuk koperasi",
    short: "Kasir Koperasi",
    art: "code",
    description:
      "Aplikasi web Laravel untuk mencatat penjualan dan stok koperasi mahasiswa.",
  },
  {
    by: "nurul",
    title: "Terjemahan profil wisata Pulau Tarakan",
    short: "Wisata Tarakan",
    art: "doc",
    description:
      "Menerjemahkan brosur wisata 2.500 kata dari bahasa Indonesia ke bahasa Inggris.",
  },
  {
    by: "nurul",
    title: "Seri artikel blog kuliner lokal",
    short: "Blog Kuliner Lokal",
    art: "doc",
    description: "Sepuluh artikel SEO tentang kuliner khas Kalimantan Utara.",
  },
  {
    by: "andi",
    title: "Video Reels promo kedai es kopi",
    short: "Reels Es Kopi",
    art: "video",
    description: "Tiga video pendek dengan total lebih dari 40 ribu tayangan.",
  },
  {
    by: "andi",
    title: "Animasi pembuka kanal YouTube kampus",
    short: "Intro YouTube",
    art: "motion",
    description: "Intro 8 detik untuk kanal YouTube unit kegiatan mahasiswa.",
  },
  {
    by: "putri",
    title: "Kampanye iklan pembukaan toko roti",
    short: "Iklan Toko Roti",
    art: "chart",
    description:
      "Iklan Instagram selama 2 minggu dengan biaya per klik di bawah Rp400.",
  },
  {
    by: "putri",
    title: "Kalender konten bulanan UMKM kuliner",
    short: "Kalender Konten",
    art: "social",
    description: "Perencanaan dan penjadwalan 30 hari konten untuk tiga UMKM.",
  },
  {
    by: "fajar",
    title: "Aplikasi antrean puskesmas (konsep)",
    short: "Antrean Puskesmas",
    art: "app",
    description:
      "Studi kasus UX: riset pengguna, alur antrean online, dan prototipe 12 layar.",
  },
  {
    by: "fajar",
    title: "Redesain website perpustakaan kampus",
    short: "Perpustakaan Kampus",
    art: "web",
    description:
      "Prototipe Figma dengan pencarian buku yang lebih mudah dipakai.",
  },
];

// ---------------------------------------------------------------------------
// Jobs and proposals.
// ---------------------------------------------------------------------------

export const jobs = [
  {
    key: "menu",
    by: "budi",
    cat: "desain",
    days: 4,
    deadline: 14,
    title: "Desain menu kopi dan poster promo bulan ini",
    budget: [200000, 400000],
    description:
      "Kedai Kopi Senja butuh desain menu baru (satu halaman A4, dua sisi) dan satu poster promo untuk Instagram dan cetak A3. Gaya hangat dan modern, warna cokelat dan krem.",
    requirements:
      "Menu berisi 18 minuman dan 6 makanan ringan. Harga dan nama menu akan saya kirim dalam Excel.",
  },
  {
    key: "tokokue",
    by: "maya",
    cat: "pengembangan",
    days: 21,
    deadline: 35,
    title: "Website toko kue dengan katalog dan pemesanan WhatsApp",
    budget: [1000000, 2000000],
    description:
      "Saya ingin website sederhana untuk Dapur Maya: katalog kue dengan foto dan harga, halaman hampers, dan tombol pesan lewat WhatsApp. Harus mudah diubah sendiri jika ada menu baru.",
    requirements: "Sekitar 30 produk. Saya sudah punya foto produk.",
  },
  {
    key: "videobengkel",
    by: "hendra",
    cat: "video",
    days: 34,
    deadline: 20,
    title: "Video promosi bengkel motor untuk Instagram",
    budget: [300000, 600000],
    description:
      "Butuh 1 video promosi 45–60 detik tentang layanan servis bengkel kami: ganti oli, servis CVT, dan pemesanan suku cadang. Rekaman bisa diambil di bengkel pada hari Minggu.",
  },
  {
    key: "abstrak",
    by: "lina",
    cat: "penulisan",
    days: 3,
    deadline: 12,
    title: "Terjemahan artikel penelitian perikanan ke bahasa Inggris",
    budget: [300000, 600000],
    description:
      "Artikel penelitian sekitar 4.000 kata tentang budidaya kepiting bakau perlu diterjemahkan ke bahasa Inggris akademik untuk dikirim ke jurnal internasional.",
    requirements:
      "Istilah teknis perikanan harus konsisten. Saya sediakan daftar istilah.",
  },
  {
    key: "kontenapp",
    by: "rizky",
    cat: "pemasaran",
    days: 2,
    deadline: 21,
    title: "Strategi konten media sosial untuk peluncuran aplikasi",
    budget: [800000, 1500000],
    description:
      "KirimCepat Tarakan akan meluncurkan aplikasi pemesanan kurir. Kami butuh strategi konten 4 minggu untuk Instagram dan TikTok, termasuk 12 desain postingan.",
  },
  {
    key: "landingapp",
    by: "rizky",
    cat: "pengembangan",
    days: 6,
    deadline: 30,
    title: "Landing page untuk aplikasi KirimCepat Tarakan",
    budget: [1000000, 2500000],
    description:
      "Landing page satu halaman untuk mengenalkan aplikasi: fitur, tarif, testimoni, dan tombol unduh di Play Store. Desain sudah tersedia di Figma.",
  },
  {
    key: "undangan",
    by: "ayu",
    cat: "desain",
    days: 15,
    deadline: 25,
    title: "Desain undangan pernikahan digital dan cetak",
    budget: [150000, 300000],
    description:
      "Untuk klien wedding organizer kami: undangan digital (format story dan PDF) dan versi cetak ukuran 12 × 18 cm dengan tema rustic.",
  },
  {
    key: "logokomunitas",
    by: "yoga",
    cat: "desain",
    days: 5,
    deadline: 20,
    title: "Logo untuk komunitas fotografi kampus",
    budget: [100000, 250000],
    description:
      "Komunitas fotografi di kampus kami butuh logo baru yang bisa dipakai untuk kaus, stiker, dan watermark foto. Gaya minimalis.",
  },
];

/** Proposals: `outcome` is what happens to them (accepted ones create an order). */
export const proposals = [
  {
    key: "menu-rina",
    job: "menu",
    by: "rina",
    days: 3,
    price: 350000,
    delivery: 4,
    revisions: 2,
    cover:
      "Halo Pak Budi, saya Rina. Saya sudah beberapa kali membuat menu dan poster untuk kedai kopi di Tarakan. Saya akan membuat dua alternatif gaya menu, lalu poster promo yang serasi. Contoh karya bisa dilihat di portofolio saya.",
  },
  {
    key: "menu-fajar",
    job: "menu",
    by: "fajar",
    days: 2,
    price: 300000,
    delivery: 5,
    revisions: 1,
    cover:
      "Selamat siang Pak, saya Fajar. Saya biasa mendesain antarmuka, tetapi juga senang membuat materi cetak. Menu akan saya susun agar mudah dibaca dan harga terlihat jelas.",
  },
  {
    key: "tokokue-dimas",
    job: "tokokue",
    by: "dimas",
    days: 20,
    price: 1600000,
    delivery: 21,
    revisions: 2,
    outcome: "accepted",
    cover:
      "Halo Bu Maya, saya Dimas. Saya akan membuat website dengan Next.js dan katalog yang bisa Ibu ubah sendiri lewat Google Sheets, jadi tidak perlu menghubungi saya setiap ada menu baru. Termasuk tombol pesan WhatsApp per produk.",
  },
  {
    key: "tokokue-fajar",
    job: "tokokue",
    by: "fajar",
    days: 20,
    price: 1400000,
    delivery: 10,
    revisions: 2,
    cover:
      "Bu Maya, saya bisa membantu mulai dari desain tampilan sampai website jadi. Saya akan membuat prototipe dulu agar Ibu bisa mencoba alurnya sebelum dibangun.",
  },
  {
    key: "videobengkel-andi",
    job: "videobengkel",
    by: "andi",
    days: 33,
    price: 450000,
    delivery: 5,
    revisions: 2,
    outcome: "accepted",
    cover:
      "Pak Hendra, saya Andi. Saya bisa datang hari Minggu untuk mengambil gambar di bengkel. Videonya akan dibuat dalam format vertikal dengan teks promo dan musik yang energik.",
  },
  {
    key: "abstrak-nurul",
    job: "abstrak",
    by: "nurul",
    days: 2,
    price: 500000,
    delivery: 6,
    revisions: 2,
    cover:
      "Ibu Lina, saya Nurul dari Pendidikan Bahasa Inggris UBT. Saya pernah menerjemahkan dua artikel bidang kelautan dan akan memakai daftar istilah dari Ibu agar konsisten.",
  },
  {
    key: "kontenapp-putri",
    job: "kontenapp",
    by: "putri",
    days: 1,
    price: 1200000,
    delivery: 14,
    revisions: 1,
    cover:
      "Halo Mas Rizky, saya Putri. Saya akan menyusun strategi peluncuran 4 minggu: teaser, peluncuran, edukasi fitur, dan promo pengguna pertama, lengkap dengan 12 desain postingan.",
  },
  {
    key: "kontenapp-nurul",
    job: "kontenapp",
    by: "nurul",
    days: 1,
    price: 900000,
    delivery: 10,
    revisions: 1,
    cover:
      "Mas Rizky, saya bisa membantu dari sisi naskah dan caption. Saya akan menulis seluruh caption dan naskah video pendek untuk empat minggu peluncuran.",
  },
  {
    key: "landingapp-dimas",
    job: "landingapp",
    by: "dimas",
    days: 5,
    price: 1800000,
    delivery: 8,
    revisions: 2,
    outcome: "accepted",
    cover:
      "Mas Rizky, saya sudah melihat desain Figma-nya. Saya akan membangun landing page dengan Next.js, animasi ringan, dan skor performa tinggi agar cepat dibuka di jaringan seluler.",
  },
  {
    key: "landingapp-fajar",
    job: "landingapp",
    by: "fajar",
    days: 5,
    price: 1500000,
    delivery: 10,
    revisions: 2,
    outcome: "rejected",
    reason:
      "Terima kasih, kami memilih developer yang sudah pernah membangun landing page aplikasi.",
    cover:
      "Mas Rizky, saya bisa membantu menyempurnakan desain Figma sekaligus membuat versi ponsel yang lebih rapi sebelum dibangun.",
  },
  {
    key: "logokomunitas-rina",
    job: "logokomunitas",
    by: "rina",
    days: 4,
    price: 200000,
    delivery: 3,
    revisions: 2,
    outcome: "withdrawn",
    cover:
      "Halo Yoga, saya Rina. Saya punya beberapa ide logo bertema lensa kamera yang tetap terlihat jelas saat dipakai sebagai watermark.",
  },
  {
    key: "logokomunitas-fajar",
    job: "logokomunitas",
    by: "fajar",
    days: 3,
    price: 180000,
    delivery: 4,
    revisions: 2,
    cover:
      "Yoga, saya Fajar. Logo minimalis akan saya buat dalam versi garis dan versi penuh, supaya cocok untuk kaus, stiker, dan watermark.",
  },
];

/** Jobs closed by their owner (with the reason). */
export const closedJobs = [
  {
    job: "undangan",
    days: 10,
    reason: "Klien kami memutuskan memakai undangan dari percetakan langganan.",
  },
];

// ---------------------------------------------------------------------------
// Orders. Steps run in order; times are days ago (WITA) or hours ago.
//   ["pay", when, payment_type]           client pays (simulated Midtrans settlement)
//   ["msg", who, when, text]              order message
//   ["deliver", when, text, files?]       freelancer delivers (files are generated)
//   ["revision", when, reason]            client asks for a revision
//   ["complete", when]                    client confirms completion
//   ["review", who, when, rating, text]   client or freelancer review
//   ["payout", admin, when, reference]    admin marks the payout as paid
//   ["dispute", who, when, reason]        opens a dispute
//   ["resolve", admin, when, resolution, note]
//   ["refund", admin, when, reference]    admin marks the refund as done
//   ["cancel", who, when, reason]         cancelled before payment
// ---------------------------------------------------------------------------

const d = (days, hhmm) => ({ days, hhmm });
const h = (hours) => ({ hours });

export const orders = [
  // --- Rina (main demo freelancer) -----------------------------------------
  {
    key: "o-logo-budi",
    client: "budi",
    service: "logo",
    created: d(52, "09:12"),
    requirements:
      "Logo untuk Kedai Kopi Senja. Konsep: hangat, senja di pantai Tarakan, cocok untuk gelas dan papan nama. Warna oranye dan cokelat tua.",
    steps: [
      ["pay", d(52, "09:30"), "bank_transfer"],
      [
        "msg",
        "rina",
        d(52, "10:05"),
        "Terima kasih Pak Budi. Saya mulai dengan 3 konsep, ya. Apakah ada logo kedai lain yang Bapak suka sebagai referensi?",
      ],
      [
        "msg",
        "budi",
        d(52, "12:40"),
        "Saya suka logo yang sederhana, ada gambar matahari terbenamnya. Tulisan jangan terlalu tipis.",
      ],
      [
        "deliver",
        d(49, "16:20"),
        "Berikut 3 konsep logo beserta file final dari konsep pilihan Bapak (konsep 2). Tersedia PNG transparan dan PDF.",
        [
          {
            name: "logo-kedai-kopi-senja.png",
            art: "logo",
            title: "Kedai Kopi Senja",
          },
          {
            name: "panduan-warna.pdf",
            art: "doc",
            title: "Panduan warna Kedai Kopi Senja",
          },
        ],
      ],
      ["complete", d(48, "19:02")],
      [
        "review",
        "budi",
        d(48, "19:05"),
        5,
        "Rina cepat menangkap maksud saya. Logonya sekarang dipakai di gelas dan papan nama kedai. Sangat direkomendasikan!",
      ],
      [
        "review",
        "rina",
        d(48, "20:10"),
        5,
        "Pak Budi jelas memberi arahan dan cepat membalas pesan. Senang bekerja sama.",
      ],
      ["payout", "admin", d(46, "10:00"), "TRF-BCA-0046-001"],
    ],
  },
  {
    key: "o-feed-maya",
    client: "maya",
    service: "feed",
    created: d(38, "08:45"),
    requirements:
      "9 desain feed untuk Dapur Maya: 3 promo kue ulang tahun, 3 hampers Natal dan Tahun Baru, 3 testimoni pelanggan. Warna pastel.",
    steps: [
      ["pay", d(38, "09:02"), "qris"],
      [
        "deliver",
        d(36, "15:30"),
        "Sembilan desain feed sudah selesai, beserta link template Canva agar Ibu bisa mengganti harga sendiri.",
        [{ name: "feed-dapur-maya.png", art: "social", title: "Dapur Maya" }],
      ],
      ["complete", d(35, "21:15")],
      [
        "review",
        "maya",
        d(35, "21:20"),
        5,
        "Desainnya cantik dan template Canva-nya sangat membantu. Pesanan hampers naik setelah posting.",
      ],
      [
        "review",
        "rina",
        d(35, "22:00"),
        5,
        "Bu Maya ramah dan materi fotonya lengkap.",
      ],
      ["payout", "sari", d(33, "11:30"), "TRF-BCA-0033-004"],
    ],
  },
  {
    key: "o-kemasan-hendra",
    client: "hendra",
    service: "kemasan",
    created: d(27, "13:10"),
    requirements:
      "Label stiker untuk botol oli kemasan ulang 1 liter merek Gunawan Jaya. Ukuran 8 × 12 cm, ada logo bengkel dan nomor WhatsApp.",
    steps: [
      ["pay", d(27, "13:25"), "gopay"],
      [
        "deliver",
        d(23, "17:45"),
        "Desain label versi pertama sudah saya kirim. File siap cetak dengan bleed 3 mm.",
        [
          {
            name: "label-oli-gunawan-jaya.pdf",
            art: "package",
            title: "Label Oli Gunawan Jaya",
          },
        ],
      ],
      [
        "revision",
        d(23, "20:10"),
        "Nomor WhatsApp kurang besar dan tolong tambahkan tulisan 'Khusus motor matic'.",
      ],
      [
        "msg",
        "rina",
        d(23, "20:30"),
        "Siap Pak, saya perbesar nomornya dan tambahkan tulisan tersebut. Besok sore saya kirim ulang.",
      ],
      [
        "deliver",
        d(22, "16:00"),
        "Revisi sudah selesai: nomor WhatsApp diperbesar dan tulisan 'Khusus motor matic' ditambahkan.",
        [
          {
            name: "label-oli-revisi.pdf",
            art: "package",
            title: "Label Oli — Revisi",
          },
        ],
      ],
      ["complete", d(21, "08:30")],
      [
        "review",
        "hendra",
        d(21, "08:35"),
        4,
        "Hasil bagus dan revisi cepat. Hanya perlu satu kali revisi untuk ukuran tulisan.",
      ],
      ["payout", "admin", d(19, "10:15"), "TRF-BCA-0019-002"],
    ],
  },
  {
    key: "o-logo-dimas",
    client: "dimas",
    service: "logo",
    created: d(12, "10:00"),
    requirements:
      "Logo untuk jasa pembuatan website saya sendiri, nama 'Dimas Dev'. Ingin gaya modern, ada unsur kurung kurawal { }.",
    steps: [
      ["pay", d(12, "10:20"), "shopeepay"],
      [
        "deliver",
        d(9, "14:00"),
        "Logo Dimas Dev sudah jadi dalam versi terang dan gelap.",
        [{ name: "logo-dimas-dev.png", art: "logo", title: "Dimas Dev" }],
      ],
      ["complete", d(8, "09:10")],
      [
        "review",
        "dimas",
        d(8, "09:12"),
        5,
        "Rina teman satu kampus dan hasilnya profesional. Logo langsung saya pakai di website portofolio.",
      ],
    ],
  },
  {
    key: "o-feed-budi",
    client: "budi",
    service: "feed",
    created: h(30),
    requirements:
      "Feed untuk promo menu baru: es kopi gula aren, kopi susu pandan, dan croissant cokelat. Pakai foto yang saya kirim di Google Drive.",
    steps: [
      ["pay", h(29.5), "bank_transfer"],
      [
        "msg",
        "rina",
        h(26),
        "Pak Budi, fotonya sudah saya terima. Saya akan kirim draf pertama besok siang.",
      ],
      ["msg", "budi", h(25), "Baik, terima kasih Rina."],
    ],
  },
  {
    key: "o-kemasan-ayu",
    client: "ayu",
    service: "kemasan",
    created: d(4, "09:00"),
    requirements:
      "Stiker label untuk souvenir pernikahan (toples kue kering). Ukuran bulat 5 cm, tema rustic, nama pengantin Rafi & Nisa.",
    steps: [
      ["pay", d(4, "09:15"), "qris"],
      [
        "deliver",
        h(20),
        "Label souvenir Rafi & Nisa sudah selesai. Saya sertakan file siap cetak berisi 12 stiker per lembar A4.",
        [
          {
            name: "label-souvenir-rafi-nisa.png",
            art: "package",
            title: "Rafi & Nisa",
          },
        ],
      ],
    ],
  },

  // --- Dimas ----------------------------------------------------------------
  {
    key: "o-landing-budi",
    client: "budi",
    service: "landing",
    created: d(47, "14:00"),
    requirements:
      "Landing page untuk paket langganan kopi bulanan Kedai Kopi Senja, dengan formulir pendaftaran yang terhubung ke WhatsApp.",
    steps: [
      ["pay", d(47, "14:30"), "bank_transfer"],
      [
        "msg",
        "dimas",
        d(46, "09:00"),
        "Pak Budi, apakah sudah ada domain? Jika belum, saya bisa pakai subdomain gratis dulu.",
      ],
      [
        "msg",
        "budi",
        d(46, "11:20"),
        "Belum ada, pakai yang gratis dulu saja.",
      ],
      [
        "deliver",
        d(41, "20:00"),
        "Landing page sudah online dan formulir terhubung ke WhatsApp. Kode sumber saya lampirkan dalam PDF panduan.",
        [
          {
            name: "panduan-landing-page.pdf",
            art: "web",
            title: "Langganan Kopi Senja",
          },
        ],
      ],
      ["complete", d(40, "10:00")],
      [
        "review",
        "budi",
        d(40, "10:05"),
        5,
        "Halamannya cepat dan sudah ada 25 pelanggan yang daftar lewat formulirnya.",
      ],
      [
        "review",
        "dimas",
        d(40, "12:00"),
        5,
        "Klien yang menyenangkan, kebutuhan dijelaskan dengan jelas.",
      ],
      ["payout", "admin", d(38, "10:30"), "TRF-BCA-0038-003"],
    ],
  },
  {
    key: "o-bugfix-hendra",
    client: "hendra",
    service: "bugfix",
    created: d(29, "19:30"),
    requirements:
      "Website katalog suku cadang bengkel kami error 500 setiap membuka halaman produk. Dibuat dengan Laravel 9.",
    steps: [
      ["pay", d(29, "19:45"), "echannel"],
      [
        "deliver",
        d(27, "22:10"),
        "Masalahnya ada pada query gambar produk yang kosong. Sudah diperbaiki dan halaman produk 3× lebih cepat. Laporan perbaikan terlampir.",
        [
          {
            name: "laporan-perbaikan.pdf",
            art: "code",
            title: "Laporan perbaikan website",
          },
        ],
      ],
      ["complete", d(26, "07:50")],
      [
        "review",
        "hendra",
        d(26, "07:55"),
        4,
        "Error sudah hilang dan website lebih cepat. Penjelasannya juga mudah dipahami.",
      ],
      ["payout", "sari", d(24, "13:00"), "TRF-BCA-0024-001"],
    ],
  },
  {
    key: "o-compro-rizky",
    client: "rizky",
    service: "compro",
    created: d(9, "10:30"),
    requirements:
      "Company profile KirimCepat Tarakan: Beranda, Tentang, Tarif, Area Layanan, Kontak. Warna hijau dan putih.",
    steps: [
      ["pay", d(9, "10:45"), "bank_transfer"],
      [
        "deliver",
        d(3, "21:00"),
        "Versi pertama website sudah bisa dilihat. Semua halaman sudah lengkap.",
        [
          {
            name: "preview-kirimcepat.png",
            art: "web",
            title: "KirimCepat Tarakan",
          },
        ],
      ],
      [
        "revision",
        d(2, "09:15"),
        "Tabel tarif perlu dipisah per kecamatan dan tambahkan peta area layanan di halaman Area.",
      ],
      [
        "msg",
        "dimas",
        d(2, "10:00"),
        "Siap Mas, saya pisahkan tabel tarif per kecamatan dan tambahkan peta. Perkiraan selesai dalam 2 hari.",
      ],
    ],
  },

  // --- Nurul ----------------------------------------------------------------
  {
    key: "o-proofread-lina",
    client: "lina",
    service: "proofread",
    created: d(32, "07:30"),
    requirements:
      "Abstrak bahasa Inggris 300 kata untuk seminar nasional perikanan. Mohon cek tata bahasa dan istilah teknis.",
    steps: [
      ["pay", d(32, "07:40"), "qris"],
      [
        "deliver",
        d(31, "16:00"),
        "Abstrak sudah disunting dengan track changes. Ada 14 perbaikan tata bahasa dan 3 saran istilah.",
        [
          {
            name: "abstrak-disunting.pdf",
            art: "doc",
            title: "Abstrak — hasil suntingan",
          },
        ],
      ],
      ["complete", d(30, "08:00")],
      [
        "review",
        "lina",
        d(30, "08:10"),
        5,
        "Teliti dan tepat waktu. Penjelasan setiap perubahan sangat membantu.",
      ],
      [
        "review",
        "nurul",
        d(30, "09:00"),
        5,
        "Terima kasih Bu Lina, daftar istilahnya sangat membantu.",
      ],
      ["payout", "admin", d(28, "10:00"), "TRF-BCA-0028-002"],
    ],
  },
  {
    key: "o-terjemah-lina",
    client: "lina",
    service: "terjemah",
    created: d(16, "08:00"),
    requirements:
      "Terjemahan pengantar laporan penelitian 1.000 kata dari bahasa Indonesia ke bahasa Inggris.",
    steps: [
      ["pay", d(16, "08:10"), "bank_transfer"],
      [
        "deliver",
        d(13, "19:30"),
        "Terjemahan sudah selesai dan istilah teknis mengikuti daftar dari Ibu.",
        [
          {
            name: "terjemahan-pengantar.pdf",
            art: "doc",
            title: "Research report — introduction",
          },
        ],
      ],
      ["complete", d(12, "07:45")],
      [
        "review",
        "lina",
        d(12, "07:50"),
        5,
        "Terjemahannya alami, tidak terasa seperti terjemahan mesin.",
      ],
    ],
  },
  {
    key: "o-artikel-rizky",
    client: "rizky",
    service: "artikel",
    created: d(7, "11:00"),
    requirements:
      "Artikel '5 Cara Mengirim Barang Aman di Dalam Kota' untuk blog KirimCepat, kata kunci: kurir Tarakan.",
    steps: [
      ["pay", d(7, "11:05"), "gopay"],
      [
        "deliver",
        d(5, "18:00"),
        "Artikel 1.000 kata sudah selesai beserta meta description.",
        [
          {
            name: "artikel-kurir-tarakan.pdf",
            art: "doc",
            title: "5 Cara Mengirim Barang Aman",
          },
        ],
      ],
      [
        "dispute",
        "rizky",
        d(3, "09:30"),
        "Artikel yang dikirim terlalu umum dan tidak menyebut area Tarakan sama sekali, padahal itu inti brief. Saya minta revisi tetapi belum ada tanggapan selama 2 hari.",
      ],
      [
        "msg",
        "nurul",
        d(3, "12:00"),
        "Mohon maaf Mas Rizky, saya sedang ujian tengah semester. Saya siap merevisi artikel dengan menambahkan contoh area di Tarakan.",
      ],
    ],
  },

  // --- Andi -----------------------------------------------------------------
  {
    key: "o-reels-maya",
    client: "maya",
    service: "reels",
    created: d(20, "10:00"),
    requirements:
      "Video Reels 30 detik untuk hampers Natal, rekaman mentah ada di Google Drive.",
    steps: [
      ["pay", d(20, "10:10"), "shopeepay"],
      [
        "deliver",
        d(19, "21:00"),
        "Video Reels hampers Natal sudah selesai, sudah saya tambahkan subtitle dan musik bebas royalti.",
        [
          {
            name: "thumbnail-reels-hampers.png",
            art: "video",
            title: "Hampers Natal",
          },
        ],
      ],
      ["complete", d(18, "08:00")],
      [
        "review",
        "maya",
        d(18, "08:05"),
        5,
        "Videonya ditonton lebih dari 12 ribu kali! Terima kasih Andi.",
      ],
      [
        "review",
        "andi",
        d(18, "09:30"),
        4,
        "Bu Maya ramah, hanya rekaman mentahnya dikirim agak terlambat.",
      ],
      ["payout", "sari", d(16, "10:00"), "TRF-BCA-0016-001"],
    ],
  },
  {
    key: "o-motion-budi",
    client: "budi",
    service: "motion",
    created: d(17, "15:00"),
    requirements:
      "Animasi logo Kedai Kopi Senja untuk pembuka video Reels, durasi 6 detik.",
    steps: [
      ["pay", d(17, "15:10"), "qris"],
      [
        "msg",
        "budi",
        d(12, "09:00"),
        "Andi, sudah lewat batas waktu. Bagaimana progresnya?",
      ],
      [
        "dispute",
        "budi",
        d(10, "10:00"),
        "Sudah lewat 5 hari dari batas waktu pengerjaan dan freelancer tidak membalas pesan. Saya minta dana dikembalikan.",
      ],
      [
        "resolve",
        "admin",
        d(9, "11:00"),
        "refund_client",
        "Freelancer tidak mengirim hasil dan tidak merespons sampai melewati batas waktu. Dana dikembalikan penuh ke klien.",
      ],
    ],
  },
  {
    key: "o-reels-ayu",
    client: "ayu",
    service: "reels",
    created: d(25, "13:00"),
    requirements:
      "Video Reels behind the scenes dekorasi pernikahan, 45 detik.",
    steps: [
      ["pay", d(25, "13:20"), "bank_transfer"],
      [
        "deliver",
        d(24, "20:00"),
        "Video behind the scenes sudah selesai.",
        [
          {
            name: "thumbnail-bts-dekorasi.png",
            art: "video",
            title: "Behind the scenes",
          },
        ],
      ],
      [
        "msg",
        "ayu",
        d(24, "21:30"),
        "Warna videonya terlalu gelap, tidak seperti dekorasi aslinya.",
      ],
      [
        "msg",
        "andi",
        d(24, "22:00"),
        "Bisa saya cerahkan lewat revisi, Bu. Masih ada 2 kali revisi.",
      ],
      [
        "dispute",
        "ayu",
        d(23, "09:00"),
        "Video tidak sesuai harapan: warnanya gelap dan musiknya kurang cocok untuk acara pernikahan.",
      ],
      [
        "resolve",
        "sari",
        d(21, "14:00"),
        "release_to_freelancer",
        "Hasil sesuai brief dan freelancer menawarkan revisi yang masih tersedia, tetapi klien memilih sengketa. Dana diteruskan ke freelancer.",
      ],
      ["payout", "sari", d(19, "10:00"), "TRF-BCA-0019-003"],
    ],
  },

  // --- Putri ----------------------------------------------------------------
  {
    key: "o-iklan-maya",
    client: "maya",
    service: "iklan",
    created: d(19, "09:30"),
    requirements:
      "Iklan Instagram untuk promo hampers Tahun Baru, target ibu-ibu di Tarakan, anggaran Rp50.000 per hari.",
    steps: [
      ["pay", d(19, "09:40"), "gopay"],
      [
        "deliver",
        d(14, "17:00"),
        "Kampanye sudah berjalan 5 hari. Laporan hasil terlampir: 18.400 jangkauan, 612 klik, biaya per klik Rp408.",
        [
          {
            name: "laporan-iklan-dapur-maya.pdf",
            art: "chart",
            title: "Laporan iklan Dapur Maya",
          },
        ],
      ],
      ["complete", d(14, "20:00")],
      [
        "review",
        "maya",
        d(14, "20:05"),
        4,
        "Iklan berjalan baik dan laporannya jelas. Semoga bulan depan bisa lanjut.",
      ],
      ["payout", "admin", d(12, "10:00"), "TRF-BCA-0012-005"],
    ],
  },
  {
    key: "o-kelolaig-budi",
    client: "budi",
    service: "kelolaig",
    created: d(11, "08:00"),
    requirements:
      "Kelola Instagram @kedaikopisenja selama 30 hari mulai minggu ini.",
    steps: [
      ["pay", d(11, "08:15"), "bank_transfer"],
      [
        "msg",
        "putri",
        d(10, "09:00"),
        "Pak Budi, rencana konten minggu pertama sudah saya kirim lewat Google Drive. Mohon dicek, ya.",
      ],
      ["msg", "budi", d(10, "13:30"), "Sudah saya lihat, bagus. Lanjutkan."],
      [
        "msg",
        "putri",
        d(3, "19:00"),
        "Update minggu ke-2: pengikut naik 140 dan 3 postingan menembus 1.000 tayangan.",
      ],
    ],
  },
  {
    key: "o-iklan-ayu",
    client: "ayu",
    service: "iklan",
    created: d(30, "10:00"),
    requirements:
      "Iklan Facebook untuk paket pernikahan intimate, target Tarakan dan Tanjung Selor.",
    steps: [
      ["pay", d(30, "10:10"), "qris"],
      [
        "dispute",
        "ayu",
        d(26, "08:00"),
        "Iklan belum berjalan sama sekali setelah 4 hari dan akun iklan kami terkena pembatasan karena materi yang diunggah.",
      ],
      [
        "resolve",
        "admin",
        d(25, "10:00"),
        "refund_client",
        "Kampanye tidak sempat berjalan. Disepakati kedua pihak, dana dikembalikan ke klien.",
      ],
      ["refund", "sari", d(24, "11:00"), "RFD-BCA-0024-001"],
    ],
  },

  // --- Fajar ----------------------------------------------------------------
  {
    key: "o-uiapp-hendra",
    client: "hendra",
    service: "uiapp",
    created: d(36, "10:00"),
    requirements:
      "Desain UI aplikasi booking servis motor: beranda, pilih layanan, pilih jadwal, riwayat servis, dan profil.",
    steps: [
      ["pay", d(36, "10:20"), "bank_transfer"],
      [
        "deliver",
        d(29, "18:00"),
        "Lima layar sudah selesai di Figma beserta komponen dan panduan warna.",
        [
          {
            name: "ui-booking-servis.png",
            art: "app",
            title: "Booking Servis",
          },
        ],
      ],
      ["complete", d(28, "09:00")],
      [
        "review",
        "hendra",
        d(28, "09:05"),
        5,
        "Desainnya rapi dan mudah dipahami pelanggan kami saat diuji coba.",
      ],
      [
        "review",
        "fajar",
        d(28, "10:00"),
        5,
        "Pak Hendra memberi masukan yang jelas di setiap tahap.",
      ],
      ["payout", "admin", d(26, "10:00"), "TRF-BCA-0026-004"],
    ],
  },
  {
    key: "o-prototipe-rizky",
    client: "rizky",
    service: "prototipe",
    created: h(3),
    requirements:
      "Prototipe Figma untuk website pelacakan paket KirimCepat: halaman cek resi dan riwayat pengiriman.",
    steps: [],
  },
  {
    key: "o-uiapp-lina",
    client: "lina",
    service: "uiapp",
    created: d(6, "14:00"),
    requirements:
      "Desain UI aplikasi pencatatan panen tambak untuk penelitian.",
    steps: [
      [
        "cancel",
        "lina",
        d(6, "16:30"),
        "Kebutuhan penelitian berubah, aplikasi belum diperlukan semester ini.",
      ],
    ],
  },

  // --- Orders from accepted job proposals ------------------------------------
  {
    key: "o-job-tokokue",
    client: "maya",
    proposal: "tokokue-dimas",
    created: d(18, "09:00"),
    steps: [
      ["pay", d(18, "09:20"), "bank_transfer"],
      [
        "msg",
        "dimas",
        d(17, "10:00"),
        "Bu Maya, Google Sheets untuk katalog sudah saya bagikan. Silakan isi nama, harga, dan foto kue.",
      ],
      [
        "msg",
        "maya",
        d(16, "20:00"),
        "Sudah saya isi 28 produk, sisanya menyusul.",
      ],
      [
        "msg",
        "dimas",
        d(4, "19:00"),
        "Halaman katalog dan hampers sudah jadi, tinggal menunggu sisa foto produk.",
      ],
    ],
  },
  {
    key: "o-job-videobengkel",
    client: "hendra",
    proposal: "videobengkel-andi",
    created: d(32, "08:00"),
    steps: [
      ["pay", d(32, "08:30"), "qris"],
      [
        "deliver",
        d(26, "20:00"),
        "Video promosi 55 detik sudah selesai dalam format vertikal dan horizontal.",
        [
          {
            name: "thumbnail-video-bengkel.png",
            art: "video",
            title: "Bengkel Gunawan Jaya",
          },
        ],
      ],
      ["complete", d(25, "08:00")],
      [
        "review",
        "hendra",
        d(25, "08:05"),
        5,
        "Pengambilan gambar di bengkel profesional, videonya membuat pelanggan baru datang.",
      ],
      [
        "review",
        "andi",
        d(25, "10:00"),
        5,
        "Pak Hendra sangat kooperatif saat pengambilan gambar.",
      ],
      ["payout", "admin", d(23, "10:00"), "TRF-BCA-0023-002"],
    ],
  },
  {
    key: "o-job-landingapp",
    client: "rizky",
    proposal: "landingapp-dimas",
    created: h(2),
    steps: [],
  },
];
