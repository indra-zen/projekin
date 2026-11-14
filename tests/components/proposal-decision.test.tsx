// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ accept: [] as FormData[] }));

vi.mock("@/server/actions/jobs", () => ({
  acceptProposalAction: vi.fn(async (_prev: unknown, fd: FormData) => {
    calls.accept.push(fd);
    return {
      ok: false,
      error: { code: "INVALID_STATE", message: "SERVER_SAID_NO" },
    };
  }),
  rejectProposalAction: vi.fn(async () => null),
  closeJobAction: vi.fn(async () => null),
  createJobAction: vi.fn(async () => null),
  submitProposalAction: vi.fn(async () => null),
  updateJobAction: vi.fn(async () => null),
}));

const { ProposalDecision } = await import("@/components/jobs/job-forms");

afterEach(cleanup);

describe("ProposalDecision", () => {
  it("submits the proposal id to the accept action after confirmation", async () => {
    render(
      <ProposalDecision
        proposalId="6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b"
        freelancerName="Rina"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Terima/ }));
    expect(screen.getByText(/Rekrut/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ya, rekrut" }));
    });
    await screen.findByText("SERVER_SAID_NO");
    expect(calls.accept).toHaveLength(1);
    expect(calls.accept[0]!.get("proposalId")).toBe(
      "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b",
    );
  });
});
