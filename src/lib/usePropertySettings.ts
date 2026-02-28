"use client";

import { useEffect, useState } from "react";

export type PropertySettingsDTO = {
  fridgeMinTenthC: number;
  fridgeMaxTenthC: number;
  freezerMinTenthC: number;
  freezerMaxTenthC: number;

  foodCostTargetBps: number;

  cookedMinTenthC: number;
  reheatedMinTenthC: number;

  chilledMinTenthC: number;
  chilledMaxTenthC: number;

  blastChillTargetTenthC: number;
  blastChillMaxMinutes: number;
};

export function usePropertySettings() {
  const [settings, setSettings] = useState<PropertySettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    fetch("/api/property-settings-read")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSettings(j?.settings ?? null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { settings, loading };
}