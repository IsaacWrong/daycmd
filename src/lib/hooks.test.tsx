import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { mutate, usePoll } from "./hooks";

function Probe({ url }: { url: string }) {
  const { data, error } = usePoll<{ n: number }>(url, 60_000);
  return (
    <div>
      <span data-testid="n">{data?.n ?? "—"}</span>
      <span data-testid="err">{error ?? ""}</span>
    </div>
  );
}

describe("usePoll", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches on mount and exposes the parsed body", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Probe url="/api/x" />);
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/x", { cache: "no-store" });
  });

  it("refetches when mutate(url) fires for the same url", async () => {
    let n = 1;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: n++ }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Probe url="/api/x" />);
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("1"));

    act(() => {
      mutate("/api/x");
    });
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("2"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores mutate events for unrelated urls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: 42 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Probe url="/api/x" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      mutate("/api/other");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces non-2xx error bodies", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Probe url="/api/x" />);
    await waitFor(() => expect(screen.getByTestId("err").textContent).toBe("nope"));
  });

  it("still revalidates via mutate() when the tab is hidden", async () => {
    let n = 1;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: n++ }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const visibilitySpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    render(<Probe url="/api/hidden" />);
    await waitFor(() =>
      expect(screen.getByTestId("n").textContent).toBe("1"),
    );

    act(() => {
      mutate("/api/hidden");
    });
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("2"));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibilitySpy.mockRestore();
  });
});
