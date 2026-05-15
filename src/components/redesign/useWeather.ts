"use client";

import { useEffect, useState } from "react";
import { migrateKey } from "@/lib/ls-migrate";
import { fetchState, putState } from "@/lib/vault-state-client";

export type Weather = {
  tempF: number;
  hi: number;
  lo: number;
  code: number;
  city: string;
  region: string;
};

type WeatherLoc = { lat: number; lon: number };

const LS_LOC = "daycmd.weather.loc";
const LS_DATA = "daycmd.weather.data";
const WEATHER_LOC_KEY = "weather/loc";
const CACHE_MS = 30 * 60_000;

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

export function useWeather(): Weather | null {
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
      if (!loc && typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          loc = await new Promise<WeatherLoc>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve({
                  lat: Number(pos.coords.latitude.toFixed(3)),
                  lon: Number(pos.coords.longitude.toFixed(3)),
                }),
              (err) => reject(err),
              { timeout: 10_000, maximumAge: 24 * 60 * 60_000 },
            );
          });
          if (loc) await putState(WEATHER_LOC_KEY, loc);
        } catch {}
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
  return weather;
}

export function useClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
