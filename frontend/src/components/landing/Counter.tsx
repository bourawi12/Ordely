"use client";

import { useEffect, useRef, useState } from "react";

interface CounterProps {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}

/** Counts up from zero once the number scrolls into view. */
export default function Counter({
  to,
  decimals = 0,
  suffix = "",
  duration = 1600,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Render the final value on the server so it is correct without JS.
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    setValue(0);

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        setValue(to * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
