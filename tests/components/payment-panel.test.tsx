// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  sync: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/server/actions/payments", () => ({
  startPaymentAction: mocks.start,
  syncPaymentStatusAction: mocks.sync,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const { PaymentPanel } = await import("@/components/orders/payment-panel");

const ORDER = "33333333-4444-4555-8666-777777777777";

beforeEach(() => {
  mocks.start.mockReset();
  mocks.sync.mockReset();
  mocks.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  delete window.snap;
});

describe("PaymentPanel", () => {
  it("opens Snap with the server's token and only asks the server to verify on success", async () => {
    mocks.start.mockResolvedValue({
      ok: true,
      data: {
        snapToken: "snap-token",
        redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/x",
        midtransOrderId: "PJK-000123-1-a1b2c3d4",
        expiresAt: "2026-11-14T08:00:00.000Z",
      },
    });
    mocks.sync.mockResolvedValue({
      ok: true,
      data: { orderStatus: "in_progress", paymentStatus: "paid" },
    });
    const pay = vi.fn();
    window.snap = { pay };

    render(
      <PaymentPanel
        orderId={ORDER}
        clientKey="Mid-client-test"
        canPay
        resume={false}
        hasAttempt={false}
        autoSync={false}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bayar sekarang" }));
    });

    expect(mocks.start).toHaveBeenCalledWith({ orderId: ORDER });
    expect(pay).toHaveBeenCalledWith("snap-token", expect.any(Object));
    expect(mocks.sync).not.toHaveBeenCalled();

    // The browser callback only triggers a server-side Status API check.
    const callbacks = pay.mock.calls[0]![1] as { onSuccess: () => void };
    await act(async () => {
      callbacks.onSuccess();
    });
    expect(mocks.sync).toHaveBeenCalledWith({ orderId: ORDER });
    expect(mocks.refresh).toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toMatch(
      /Pembayaran terkonfirmasi/,
    );
  });

  it("shows the server's error and does not open Snap", async () => {
    mocks.start.mockResolvedValue({
      ok: false,
      error: {
        code: "LIMIT_REACHED",
        message: "Batas percobaan pembayaran untuk pesanan ini sudah tercapai.",
      },
    });
    const pay = vi.fn();
    window.snap = { pay };
    render(
      <PaymentPanel
        orderId={ORDER}
        clientKey="Mid-client-test"
        canPay
        resume={false}
        hasAttempt
        autoSync={false}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bayar sekarang" }));
    });
    expect(pay).not.toHaveBeenCalled();
    expect(screen.getByText(/Batas percobaan pembayaran/)).toBeTruthy();
  });

  it("syncs once automatically when returning from payment", async () => {
    mocks.sync.mockResolvedValue({
      ok: true,
      data: { orderStatus: "awaiting_payment", paymentStatus: "pending" },
    });
    render(
      <PaymentPanel
        orderId={ORDER}
        clientKey={null}
        canPay
        resume
        hasAttempt
        autoSync
      />,
    );
    expect(await screen.findByText(/Menunggu pembayaran Anda/)).toBeTruthy();
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Lanjutkan pembayaran" }),
    ).toBeTruthy();
  });
});
