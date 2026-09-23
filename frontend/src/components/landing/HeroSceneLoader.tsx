"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// WebGL only exists in the browser, and three.js is heavy: load it after the page.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

// On narrow screens the hero has no free space for the objects, so skip the
// scene (and its download) entirely.
const WIDE_QUERY = "(min-width: 721px)";

export default function HeroSceneLoader({ className }: { className?: string }) {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!wide) return null;

  return (
    <div className={className} aria-hidden="true">
      <HeroScene />
    </div>
  );
}
