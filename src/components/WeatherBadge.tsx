"use client";

import { useEffect, useState } from "react";

type Weather = {
  tempF: number;
  hi: number;
  lo: number;
  code: number;
  city: string;
  region: string;
};

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

const LS_LOC = "ai-os.weather.loc";
const LS_DATA = "ai-os.weather.data";
const CACHE_MS = 30 * 60_000;
const REFRESH_MS = 15 * 60_000;

const ICONS: Record<number, string> = {
  0: "☀",
  1: "🌤",
  2: "⛅",
  3: "☁",
  45: "🌫",
  48: "🌫",
  51: "🌦",
  53: "🌦",
  55: "🌦",
  61: "🌧",
  63: "🌧",
  65: "🌧",
  71: "🌨",
  73: "🌨",
  75: "❄",
  77: "🌨",
  80: "🌦",
  81: "🌧",
  82: "⛈",
  95: "⛈",
  96: "⛈",
  99: "⛈",
};

function iconFor(code: number): string {
  return ICONS[code] ?? "🌡";
}

async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ city: string; region: string }> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      principalSubdivisionCode?: string; // e.g. "US-KY"
      countryCode?: string;
    };
    const city = j.city || j.locality || "";
    let region = "";
    if (j.countryCode === "US" && j.principalSubdivisionCode) {
      region = j.principalSubdivisionCode.replace(/^US-/, "");
    } else if (j.countryCode === "US" && j.principalSubdivision) {
      region = US_STATES[j.principalSubdivision] ?? j.principalSubdivision;
    } else {
      region = j.principalSubdivision ?? "";
    }
    if (!city) return { city: `${lat.toFixed(1)}, ${lon.toFixed(1)}`, region };
    return { city, region };
  } catch {
    return { city: `${lat.toFixed(1)}, ${lon.toFixed(1)}`, region: "" };
  }
}

async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
  const [w, place] = await Promise.all([
    fetch(url).then((r) => r.json()) as Promise<{
      current: { temperature_2m: number; weather_code: number };
      daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    }>,
    reverseGeocode(lat, lon),
  ]);
  return {
    tempF: Math.round(w.current.temperature_2m),
    hi: Math.round(w.daily.temperature_2m_max[0]),
    lo: Math.round(w.daily.temperature_2m_min[0]),
    code: w.current.weather_code,
    city: place.city,
    region: place.region,
  };
}

function getLoc(): { lat: number; lon: number } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_LOC);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { lat: number; lon: number };
  } catch {
    return null;
  }
}

function saveLoc(lat: number, lon: number): void {
  localStorage.setItem(LS_LOC, JSON.stringify({ lat, lon }));
}

function getCached(): Weather | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_DATA);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { weather: Weather; ts: number };
    if (Date.now() - j.ts > CACHE_MS) return null;
    return j.weather;
  } catch {
    return null;
  }
}

function saveCache(weather: Weather): void {
  localStorage.setItem(
    LS_DATA,
    JSON.stringify({ weather, ts: Date.now() }),
  );
}

export function WeatherBadge() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const cached = getCached();
    if (cached) setWeather(cached);
    const loc = getLoc();
    if (!loc) return;

    let cancelled = false;
    const tick = () => {
      fetchWeather(loc.lat, loc.lon)
        .then((w) => {
          if (cancelled) return;
          saveCache(w);
          setWeather(w);
          setError(null);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setError("geolocation unavailable");
      return;
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveLoc(pos.coords.latitude, pos.coords.longitude);
        fetchWeather(pos.coords.latitude, pos.coords.longitude)
          .then((w) => {
            saveCache(w);
            setWeather(w);
            setAsking(false);
          })
          .catch((e: Error) => {
            setError(e.message);
            setAsking(false);
          });
      },
      (e) => {
        setError(e.message);
        setAsking(false);
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  if (!weather) {
    return (
      <button
        onClick={requestLocation}
        disabled={asking}
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        title={error ?? "Click to enable weather"}
      >
        {asking ? "…" : error ? "⚠ weather" : "📍 enable weather"}
      </button>
    );
  }

  const place = weather.region ? `${weather.city}, ${weather.region}` : weather.city;
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[10px] text-zinc-500">{place}</span>
      <span
        className="text-xs text-zinc-300 flex items-center gap-1.5"
        title={`hi ${weather.hi}° / lo ${weather.lo}°`}
      >
        <span className="text-base leading-none">{iconFor(weather.code)}</span>
        <span className="font-mono">{weather.tempF}°</span>
        <span className="text-zinc-600 text-[10px] font-mono">
          {weather.hi}/{weather.lo}
        </span>
      </span>
    </div>
  );
}
