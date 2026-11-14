// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) },
  }),
}));
vi.mock("@/server/actions/orders", () => ({}));

const { DeliveryAttachments, attachmentName } =
  await import("@/components/orders/order-forms");

const ORDER = "33333333-4444-4555-8666-777777777777";
const UID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
const PATH = `${ORDER}/${UID}/0b9a3c3e-1d2f-4a5b-8c7d-6e5f4a3b2c1d-desain-final.pdf`;

beforeEach(() => mocks.createSignedUrl.mockReset());
afterEach(() => cleanup());

describe("DeliveryAttachments (FR-ORD-09)", () => {
  it("shows the original file name without the random prefix", () => {
    expect(attachmentName(PATH)).toBe("desain-final.pdf");
    expect(attachmentName(`${ORDER}/${UID}/`)).toBe("lampiran");
  });

  it("creates a fresh 60-second download URL only when clicked", async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "#download-desain-final" },
      error: null,
    });
    render(<DeliveryAttachments paths={[PATH]} />);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Unduh desain-final.pdf" }),
      );
    });
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(PATH, 60, {
      download: "desain-final.pdf",
    });
    expect(window.location.hash).toBe("#download-desain-final");
  });

  it("explains when the file cannot be downloaded (e.g. not a party)", async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });
    render(<DeliveryAttachments paths={[PATH]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(
      screen.getByText(
        "Lampiran tidak dapat diunduh. Muat ulang halaman lalu coba lagi.",
      ),
    ).toBeTruthy();
  });

  it("renders nothing without attachments", () => {
    const { container } = render(<DeliveryAttachments paths={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
