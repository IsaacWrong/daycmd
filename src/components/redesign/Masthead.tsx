"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { usePoll } from "@/lib/hooks";
import { migrateKey } from "@/lib/ls-migrate";
import { fetchState, putState } from "@/lib/vault-state-client";
import type { Tod } from "./TodFrame";
import { todEmoji, weatherEmoji } from "./Glyph";

type Weather = { tempF: number; hi: number; lo: number; code: number; city: string; region: string };

const LS_LOC = "daycmd.weather.loc";
const LS_DATA = "daycmd.weather.data";
const WEATHER_LOC_KEY = "weather/loc";
const CACHE_MS = 30 * 60_000;

type WeatherLoc = { lat: number; lon: number };

function getCachedWeather(): Weather | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (!raw) return null;
    const j = JSON.parse(raw) as { weather: Weather; ts: number };
    if (Date.now() - j.ts > CACHE_MS) return null;
    return j.weather;
  } catch {
    return null;
  }
}

async function fetchWeatherDirect(lat: number, lon: number): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  const j = (await res.json()) as {
    current: { temperature_2m: number; weather_code: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  };
  return {
    tempF: Math.round(j.current.temperature_2m),
    hi: Math.round(j.daily.temperature_2m_max[0]),
    lo: Math.round(j.daily.temperature_2m_min[0]),
    code: j.current.weather_code,
    city: "",
    region: "",
  };
}

function greetingFor(tod: Tod, name: string): string {
  const verb: Record<Tod, string> = {
    dawn: "Morning",
    morning: "Morning",
    noon: "Afternoon",
    afternoon: "Afternoon",
    dusk: "Evening",
    night: "Evening",
    deep: "Up late",
  };
  return `${verb[tod]}, ${name}`;
}

function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

export function Masthead({
  tod,
  name = "Isaac",
}: {
  tod: Tod;
  name?: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dateLine = format(now, "EEEE, MMMM d");
  const week = weekOfYear(now);
  const clock = format(now, "h:mm a");
  const streaks =
    usePoll<{ dailyNote: number; ship: number }>("/api/streaks", 5 * 60_000).data;
  const shipStreak = streaks?.ship ?? 0;

  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    let cancelled = false;
    migrateKey("ai-os.weather.loc", LS_LOC);
    migrateKey("ai-os.weather.data", LS_DATA);
    const cached = getCachedWeather();
    if (cached) setWeather(cached);
    (async () => {
      let loc = await fetchState<WeatherLoc>(WEATHER_LOC_KEY);
      if (!loc) {
        const rawLoc = localStorage.getItem(LS_LOC);
        if (rawLoc) {
          try {
            loc = JSON.parse(rawLoc) as WeatherLoc;
            await putState(WEATHER_LOC_KEY, loc);
          } catch {}
          localStorage.removeItem(LS_LOC);
        }
      }
      if (!loc || cancelled) return;
      try {
        const w = await fetchWeatherDirect(loc.lat, loc.lon);
        if (cancelled) return;
        localStorage.setItem(LS_DATA, JSON.stringify({ weather: w, ts: Date.now() }));
        setWeather(w);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const w = weather;

  return (
    <div
      className="dimmable flex items-center gap-[22px] px-12 pt-[22px] pb-[18px]"
      style={{ borderBottom: "1px solid var(--rule)" }}
    >
      <div className="flex items-center gap-3.5">
        <span
          className="inline-flex items-center justify-center text-white font-semibold"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, var(--c-agent), var(--c-tasks) 80%, var(--c-github))",
            fontSize: 14,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.20)",
          }}
        >
          ◉
        </span>
        <div>
          <div
            className="text-[19px] font-medium leading-[1.15]"
            style={{ letterSpacing: "-0.015em" }}
          >
            {greetingFor(tod, name)}.
          </div>
          <div className="t-mono text-[11px] text-fg-soft mt-0.5">
            {dateLine} · Week {week}
            {shipStreak > 0 ? ` · Day ${shipStreak} of ship streak` : ""}
          </div>
        </div>
      </div>

      <span className="flex-1" />

      <span
        className="t-mono t-num text-[12px] text-fg whitespace-nowrap"
        title={format(now, "yyyy-MM-dd HH:mm:ss")}
        suppressHydrationWarning
      >
        {clock}
      </span>
      <span className="w-px h-3.5" style={{ background: "var(--rule)" }} />
      <div className="flex items-center gap-2 text-[12px] whitespace-nowrap">
        <span style={{ fontSize: 14, opacity: 0.85 }}>
          {w ? weatherEmoji(w.code, tod === "night" || tod === "deep") : todEmoji(tod)}
        </span>
        {w ? (
          <span className="t-mono t-num text-fg-soft">
            {w.tempF}° · H{w.hi} L{w.lo}
          </span>
        ) : (
          <span className="t-mono text-fg-soft opacity-60">—</span>
        )}
      </div>
      <span className="w-px h-3.5" style={{ background: "var(--rule)" }} />
      <Link
        href="/settings"
        className="t-mono text-[12px] text-fg-soft hover:text-fg cursor-pointer"
      >
        settings
      </Link>
    </div>
  );
}
