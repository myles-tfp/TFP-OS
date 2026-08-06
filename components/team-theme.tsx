"use client";

import { useEffect } from "react";

/** Flips the whole app into the universal "team hub" theme while mounted. */
export function TeamTheme() {
  useEffect(() => {
    document.body.classList.add("team-theme");
    return () => document.body.classList.remove("team-theme");
  }, []);
  return null;
}
