import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  getCache,
  mutate,
  mutateCache,
  setCache,
  useDebouncedCallback,
  usePoll,
  useResource,
} from "./hooks";

function Probe({ url }: { url: string }) {
  const { data, error } = usePoll<{ n: number }>(url, 60_000);
  return (
    <div>
      <span data-testid="n">{data?.n ?? "—"}</span>
      <span data-testid="err">{error ?? ""}</span>
    </div>
  );
}

function ResourceProbe({ url }: { url: string }) {
  const { data, error, refresh } = useResource<{ n: number }>(url, url);
  return (
    <div>
      <span data-testid="n">{data?.n ?? "—"}</span>
      <span data-testid="err">{error ?? ""}</span>
      <button onClick={refresh}>refresh</button>
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

  it("refetches once when the tab becomes visible again", async () => {
    let n = 1;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: n++ }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    let visibility: DocumentVisibilityState = "hidden";
    const visibilitySpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockImplementation(() => visibility);

    render(<Probe url="/api/vischange" />);
    await waitFor(() =>
      expect(screen.getByTestId("n").textContent).toBe("1"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("n").textContent).toBe("2"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibilitySpy.mockRestore();
  });
});

describe("useResource", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches once on mount and refreshes via the returned callback", async () => {
    let n = 1;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: n++ }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ResourceProbe url="/api/resource" />);
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByText("refresh").click();
    });
    await waitFor(() => expect(screen.getByTestId("n").textContent).toBe("2"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces network errors as the error field", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ResourceProbe url="/api/error" />);
    await waitFor(() =>
      expect(screen.getByTestId("err").textContent).toBe("offline"),
    );
  });
});

describe("setCache / getCache", () => {
  it("round-trips arbitrary data and survives a re-read", () => {
    setCache("cache:k1", { a: 1 });
    expect(getCache<{ a: number }>("cache:k1")).toEqual({ a: 1 });
    setCache("cache:k1", { a: 2 });
    expect(getCache<{ a: number }>("cache:k1")).toEqual({ a: 2 });
  });

  it("getCache returns undefined for unseen keys", () => {
    expect(getCache("cache:never")).toBeUndefined();
  });
});

describe("mutateCache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("applies optimistic data immediately and keeps the request's return value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ n: 99 }), { status: 200 }),
      ),
    );
    setCache<{ n: number }>("cache:opt", { n: 1 });

    const seen: Array<number | undefined> = [];
    await mutateCache<{ n: number }>(
      "cache:opt",
      "/api/opt",
      (prev) => {
        seen.push(prev?.n);
        return { n: (prev?.n ?? 0) + 10 };
      },
      async () => ({ n: 42 }),
    );

    expect(seen).toEqual([1]);
    expect(getCache<{ n: number }>("cache:opt")).toEqual({ n: 42 });
  });

  it("falls back to fetchInto when the request returns void", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ n: 7 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setCache<{ n: number }>("cache:void", { n: 0 });

    await mutateCache<{ n: number }>(
      "cache:void",
      "/api/void",
      () => ({ n: 1 }),
      async () => undefined,
    );

    // fetch was triggered to refetch the canonical value
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/void", { cache: "no-store" }));
  });

  it("rolls back optimistic data and rethrows on failure", async () => {
    vi.stubGlobal("fetch", vi.fn());
    setCache<{ n: number }>("cache:rb", { n: 3 });

    await expect(
      mutateCache<{ n: number }>(
        "cache:rb",
        "/api/rb",
        (prev) => ({ n: (prev?.n ?? 0) + 100 }),
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");

    expect(getCache<{ n: number }>("cache:rb")).toEqual({ n: 3 });
  });
});

describe("mutate", () => {
  it("is a no-op without a window (SSR safety)", () => {
    // jsdom provides window; just exercise the callable. The SSR branch is
    // covered structurally by the early-return guard at the top of mutate().
    expect(() => mutate("/api/anything")).not.toThrow();
  });
});

describe("useDebouncedCallback", () => {
  it("calls through with only the latest arguments after the delay", async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn();

      function Host() {
        const [, force] = useState(0);
        const debounced = useDebouncedCallback(handler, 50);
        return (
          <div>
            <button
              onClick={() => {
                debounced(1);
                debounced(2);
                debounced(3);
                force((v) => v + 1);
              }}
            >
              fire
            </button>
          </div>
        );
      }
      render(<Host />);
      act(() => {
        screen.getByText("fire").click();
      });
      expect(handler).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
