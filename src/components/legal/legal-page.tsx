/** Shared layout for the Terms and Privacy pages. */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Terakhir diperbarui {updated}
      </p>
      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Projekin adalah proyek tugas kuliah. Pembayaran memakai Midtrans Sandbox
        (mode uji), sehingga tidak ada uang sungguhan yang berpindah.
      </div>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold">{section.heading}</h2>
            <div className="text-muted-foreground mt-3 space-y-3 leading-7">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
