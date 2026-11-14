/** Shared layout for the Terms and Privacy pages. Readability first. */
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
    <div className="container max-w-3xl py-10 md:py-16">
      <span className="eyebrow">Informasi hukum</span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Terakhir diperbarui {updated}
      </p>
      <div
        role="note"
        className="bg-highlight border-border mt-6 rounded-xl border-2 p-4 text-sm leading-6 font-medium"
      >
        Projekin adalah proyek tugas kuliah. Pembayaran memakai Midtrans Sandbox
        (mode uji), sehingga tidak ada uang sungguhan yang berpindah.
      </div>
      <article className="bg-card border-border shadow-ledge divide-hairline mt-8 divide-y rounded-2xl border-2 px-5 md:px-10">
        {sections.map((section) => (
          <section key={section.heading} className="py-7 first:pt-8 last:pb-9">
            <h2 className="text-2xl font-bold tracking-tight">
              {section.heading}
            </h2>
            <div className="mt-3 max-w-[68ch] space-y-3 leading-7">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
