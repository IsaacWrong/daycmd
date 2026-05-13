"use client";

import { useEffect, useState } from "react";
import { migrateKey } from "@/lib/ls-migrate";

export type Tod = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night" | "deep";

export function todForHour(h: number): Tod {
  if (h >= 6 && h < 9) return "dawn";
  if (h >= 9 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "noon";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "dusk";
  if (h >= 20 && h < 23) return "night";
  return "deep";
}

export function useTod(): Tod {
  const [tod, setTod] = useState<Tod>(() => todForHour(new Date().getHours()));
  useEffect(() => {
    const id = setInterval(() => setTod(todForHour(new Date().getHours())), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return tod;
}

const FOCUS_LS_KEY = "daycmd.focus-mode";

export function useFocusMode(): [boolean, () => void, (v: boolean) => void] {
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    migrateKey("ai-os.focus-mode", FOCUS_LS_KEY);
    const v = localStorage.getItem(FOCUS_LS_KEY);
    if (v === "1") setFocus(true);
  }, []);
  useEffect(() => {
    localStorage.setItem(FOCUS_LS_KEY, focus ? "1" : "0");
  }, [focus]);
  return [focus, () => setFocus((v) => !v), setFocus];
}

const TOD_CLASSES: Tod[] = ["dawn", "morning", "noon", "afternoon", "dusk", "night", "deep"];

export function TodFrame({
  tod,
  focus,
  children,
}: {
  tod: Tod;
  focus: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    for (const t of TOD_CLASSES) root.classList.remove(`tod-${t}`);
    root.classList.add(`tod-${tod}`);
  }, [tod]);
  return (
    <div className={`daycmd-frame tod-${tod}${focus ? " focus" : ""}`}>
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="grain" />
      <div className="surface">{children}</div>
    </div>
  );
}
