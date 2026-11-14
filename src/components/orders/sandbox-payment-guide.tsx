import { ExternalLink } from "lucide-react";

/**
 * Midtrans Sandbox payment simulators (no real money). Steps verified against
 * the sandbox on 2026-11-13 for every method enabled in snap-request.ts.
 */
const SIMULATOR = "https://simulator.sandbox.midtrans.com";

const VA_SIMULATORS = [
  { label: "BCA", href: `${SIMULATOR}/bca/va/index` },
  { label: "BNI / Bank lain", href: `${SIMULATOR}/bni/va/index` },
  { label: "BRI", href: `${SIMULATOR}/openapi/va/index?bank=bri` },
  { label: "Permata", href: `${SIMULATOR}/openapi/va/index?bank=permata` },
  { label: "CIMB Niaga", href: `${SIMULATOR}/openapi/va/index?bank=cimb` },
  { label: "Mandiri", href: `${SIMULATOR}/openapi/va/index?bank=mandiri` },
] as const;

function SimLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-0.5 font-semibold hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

export function SandboxPaymentGuide() {
  return (
    <details className="bg-card border-border rounded-xl border-2 p-3 text-xs leading-5">
      <summary className="cursor-pointer text-sm font-bold">
        Cara membayar di mode Sandbox (tanpa uang sungguhan)
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <p className="font-semibold">
            QRIS, GoPay QRIS, ShopeePay QRIS (komputer)
          </p>
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>
              Di jendela Snap, klik kanan gambar QR lalu pilih &quot;Salin
              alamat gambar&quot; (Copy image address).
            </li>
            <li>
              Buka{" "}
              <SimLink href={`${SIMULATOR}/v2/qris/index`}>
                Simulator QRIS
              </SimLink>
              , tempel di kolom &quot;QR Code Image Url&quot;, klik{" "}
              <strong>Scan QR</strong>, lalu <strong>Pay</strong>.
            </li>
            <li>
              Jika diminta PIN, isi <strong>123456</strong> lalu{" "}
              <strong>Confirm</strong>.
            </li>
            <li>
              Snap menampilkan &quot;Payment successful&quot; dan pesanan
              diperbarui otomatis.
            </li>
          </ol>
        </div>
        <div>
          <p className="font-semibold">GoPay / ShopeePay (HP)</p>
          <p>
            Ketuk <strong>Pay now</strong>; Anda diarahkan ke simulator. GoPay:
            ketuk <strong>Pay</strong>. ShopeePay: isi PIN{" "}
            <strong>123456</strong> lalu <strong>Confirm</strong>. Setelah itu
            kembali ke halaman pesanan ini.
          </p>
        </div>
        <div>
          <p className="font-semibold">Virtual Account</p>
          <p>
            Salin nomor VA dari Snap, buka simulator bank yang sama, tempel
            nomornya, klik <strong>Inquire</strong> lalu <strong>Pay</strong>.
            Mandiri: isi <em>Company code</em> dari Snap sebagai Biller Code dan
            nomor VA sebagai Bill Key. &quot;Bank lain&quot; memakai VA BNI.
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {VA_SIMULATORS.map((sim) => (
              <SimLink key={sim.href} href={sim.href}>
                {sim.label}
              </SimLink>
            ))}
          </p>
        </div>
        <p className="text-muted-foreground">
          Kembali ke tab ini setelah membayar: status diperiksa otomatis ke
          Midtrans. Anda juga dapat menekan &quot;Periksa status
          pembayaran&quot;.
        </p>
      </div>
    </details>
  );
}
