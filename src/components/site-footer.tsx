import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="border-border/70 bg-muted/30 border-t">
      <div className="text-muted-foreground container flex flex-col gap-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Brand />
        <p>© 2026 Projekin. Dibangun untuk talenta mahasiswa.</p>
      </div>
    </footer>
  );
}
