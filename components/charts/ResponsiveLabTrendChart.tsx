"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { LabTrendChart } from "@/components/charts/LabTrendChart";

type Props = Omit<ComponentProps<typeof LabTrendChart>, "width" | "height">;

/**
 * LabTrendChart sized to its container in real pixels, so axis text stays 11px
 * on wide layouts instead of growing with the viewBox. Height follows the
 * design's 640 × 260 shape, kept between 220 and 320px.
 */
export function ResponsiveLabTrendChart(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = width ? Math.min(Math.max(Math.round((width * 260) / 640), 220), 320) : undefined;
  return (
    <div ref={ref} className="w-full">
      <LabTrendChart {...props} width={width} height={height} />
    </div>
  );
}
