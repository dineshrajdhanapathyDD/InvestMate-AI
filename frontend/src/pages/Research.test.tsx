import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the API module before importing components that use it.
vi.mock("../api", () => {
  class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    ApiError,
    api: {
      clientId: () => "test-client",
      getWatchlist: vi.fn().mockResolvedValue({ data: { symbols: [] } }),
      putWatchlist: vi.fn().mockResolvedValue({ data: { symbols: [] } }),
      research: vi.fn(),
    },
  };
});

import { api, ApiError } from "../api";
import { Research } from "./Research";
import { AppProvider } from "../store";

function renderResearch() {
  return render(
    <MemoryRouter>
      <AppProvider>
        <Research />
      </AppProvider>
    </MemoryRouter>
  );
}

describe("Research page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getWatchlist as any).mockResolvedValue({ data: { symbols: [] } });
  });

  it("preserves the user's question after a recoverable failure", async () => {
    (api.research as any).mockRejectedValueOnce(
      new ApiError("AI_UNAVAILABLE", "The AI model is unavailable, please retry.")
    );
    renderResearch();

    const box = screen.getByLabelText(/your question/i) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "What happened to WIPRO?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask investmate/i }));

    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeInTheDocument());
    // The question text must still be in the input so the user can retry.
    expect(box.value).toBe("What happened to WIPRO?");
    // A retry control is offered.
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("labels demonstration data and lists sources on success", async () => {
    (api.research as any).mockResolvedValueOnce({
      data: {
        answer: "**What the data shows** WIPRO rose 3%.",
        evidence: [],
        sources: [
          { source: "sample-data", asOf: "2026-10-09T00:00:00+00:00", isSample: true, note: "demo" },
        ],
        usedTools: ["get_history"],
        isSample: true,
        beginnerMode: true,
      },
    });
    renderResearch();

    fireEvent.change(screen.getByLabelText(/your question/i), {
      target: { value: "WIPRO performance?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ask investmate/i }));

    await waitFor(() => expect(screen.getByText(/what the data shows/i)).toBeInTheDocument());
    expect(screen.getByText(/demonstration data/i)).toBeInTheDocument();
    expect(screen.getByText(/get_history/i)).toBeInTheDocument();
  });
});
