// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorView } from "@/components/error-view";
import { NotFoundView } from "@/components/not-found-view";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorView (ARCHITECTURE §11.1)", () => {
  it("shows Indonesian copy and the digest, and retries on demand", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const retry = vi.fn();
    const error = Object.assign(new Error("hidden"), { digest: "1234567890" });
    render(<ErrorView error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Maaf, halaman ini gagal dimuat." }),
    ).toBeTruthy();
    expect(screen.getByText("Kode: 1234567890")).toBeTruthy();
    // The raw message never reaches the page.
    expect(screen.queryByText(/hidden/)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByRole("button", { name: /Coba lagi/ }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Ke beranda" }).getAttribute("href"),
    ).toBe("/");
  });

  it("omits the code when the error has no digest and honours the home link", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorView
        error="boom"
        retry={() => {}}
        homeHref="/dashboard"
        homeLabel="Ke dasbor"
      />,
    );
    expect(screen.queryByText(/Kode:/)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ke dasbor" }).getAttribute("href"),
    ).toBe("/dashboard");
  });
});

describe("NotFoundView (PRD NFR-11)", () => {
  it("renders the Indonesian 404 with a way back and to the marketplace", () => {
    render(
      <NotFoundView
        title="Data yang Anda cari tidak ada."
        backHref="/admin"
        backLabel="Ke ringkasan admin"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Data yang Anda cari tidak ada." }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Ke ringkasan admin/ })
        .getAttribute("href"),
    ).toBe("/admin");
    expect(
      screen.getByRole("link", { name: /Cari jasa/ }).getAttribute("href"),
    ).toBe("/services");
  });
});
