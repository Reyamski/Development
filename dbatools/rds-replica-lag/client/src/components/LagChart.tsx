import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/app-store';

const PADDING = { top: 20, right: 20, bottom: 32, left: 60 };

function formatLag(seconds: number): string {
  if (seconds >= 3600) return (seconds / 3600).toFixed(1) + 'h';
  if (seconds >= 60) return (seconds / 60).toFixed(1) + 'm';
  return seconds.toFixed(0) + 's';
}

function formatTimeLabel(iso: string, rangeMins: number, utc: boolean): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { hour12: false, ...(utc ? { timeZone: 'UTC' } : {}) };
  if (rangeMins <= 60) return d.toLocaleTimeString([], { ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (rangeMins <= 1440) return d.toLocaleTimeString([], { ...opts, hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { ...opts, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatIops(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

export function LagChart({ chartHeight = 200 }: { chartHeight?: number }) {
  const cloudwatchData = useAppStore((s) => s.cloudwatchData);
  const sourceCloudwatchData = useAppStore((s) => s.sourceCloudwatchData);
  const sourceInstanceId = useAppStore((s) => s.sourceInstanceId);
  const timeRange = useAppStore((s) => s.timeRange);
  const setTimeRange = useAppStore((s) => s.setTimeRange);
  const lagLoading = useAppStore((s) => s.lagLoading);
  const showUtc = useAppStore((s) => s.showUtc);
  const lagThreshold = useAppStore((s) => s.lagThreshold);
  const setChartHoverContext = useAppStore((s) => s.setChartHoverContext);
  const chartPinned = useAppStore((s) => s.chartPinned);
  const setChartPinned = useAppStore((s) => s.setChartPinned);

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 900;
  const height = chartHeight;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const rangeMins = (new Date(timeRange.until).getTime() - new Date(timeRange.since).getTime()) / 60000;

  const data = cloudwatchData;

  // Y axis — ensure threshold line is always visible
  const dataMax = Math.max(...data.map(p => p.lagSeconds), 1);
  const yMax = Math.max(dataMax, lagThreshold > 0 ? lagThreshold * 1.2 : 0) * 1.1;

  const xScale = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (v: number) => PADDING.top + chartH - (v / yMax) * chartH;

  // Build SVG paths
  const lagPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.lagSeconds).toFixed(1)}`).join(' ');
  const lagArea = lagPath + ` L${xScale(data.length - 1).toFixed(1)},${yScale(0).toFixed(1)} L${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} Z`;

  // Ticks
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];
  const tickCount = 13;
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * (data.length - 1))
  ).filter((v, i, arr) => v >= 0 && v < data.length && arr.indexOf(v) === i);

  // Drag-to-zoom
  const getXIndex = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = width / rect.width;
    const viewBoxX = (clientX - rect.left) * scale;
    const x = viewBoxX - PADDING.left;
    const pct = Math.max(0, Math.min(1, x / chartW));
    return Math.round(pct * (data.length - 1));
  }, [data.length, chartW]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const idx = getXIndex(e.clientX);
    setDragStart(idx);
    setDragEnd(idx);
  }, [getXIndex]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const idx = getXIndex(e.clientX);
    setHoveredIdx(idx);
    const point = data[idx];
    if (point && !chartPinned) {
      const isBreach = lagThreshold > 0 && point.lagSeconds > lagThreshold;
      setChartHoverContext(point.lagSeconds, isBreach);
    }
    if (dragStart !== null) setDragEnd(idx);
  }, [dragStart, getXIndex, data, lagThreshold, setChartHoverContext, chartPinned]);

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && Math.abs(dragEnd - dragStart) >= 2) {
      const minIdx = Math.min(dragStart, dragEnd);
      const maxIdx = Math.max(dragStart, dragEnd);
      if (data[minIdx] && data[maxIdx]) {
        setChartPinned(true);
        setTimeRange({
          since: data[minIdx].timestamp,
          until: data[maxIdx].timestamp,
          label: 'Custom',
        });
      }
    } else if (dragStart !== null && dragEnd !== null && Math.abs(dragEnd - dragStart) < 2) {
      const idx = dragEnd;
      const point = idx !== null ? data[idx] : null;
      if (point) {
        const isBreach = lagThreshold > 0 && point.lagSeconds > lagThreshold;
        if (isBreach) {
          setChartPinned(true);
          setChartHoverContext(point.lagSeconds, true);
        } else {
          setChartPinned(false);
          setChartHoverContext(null, false);
        }
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, data, setTimeRange, lagThreshold, setChartHoverContext, setChartPinned]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    if (!chartPinned) {
      setChartHoverContext(null, false);
    }
    if (dragStart !== null) {
      setDragStart(null);
      setDragEnd(null);
    }
  }, [dragStart, setChartHoverContext, chartPinned]);

  // Empty state
  if (data.length === 0 && !lagLoading) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-xs" style={{ height }}>
        No CloudWatch data — ensure AWS SSO is active
      </div>
    );
  }

  if (data.length === 0 && lagLoading) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-xs gap-2" style={{ height }}>
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Loading CloudWatch ReplicaLag...</span>
      </div>
    );
  }

  const selX1 = dragStart !== null && dragEnd !== null ? xScale(Math.min(dragStart, dragEnd)) : null;
  const selX2 = dragStart !== null && dragEnd !== null ? xScale(Math.max(dragStart, dragEnd)) : null;
  const hoveredPoint = hoveredIdx !== null && data[hoveredIdx] ? data[hoveredIdx] : null;
  const breachCount = lagThreshold > 0 ? data.filter(p => p.lagSeconds > lagThreshold).length : 0;
  const peak = Math.max(...data.map(p => p.lagSeconds));

  return (
    <div className="relative">
      {/* Loading overlay */}
      {lagLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 rounded">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-3 py-1.5">
            <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-slate-300">Fetching CloudWatch ReplicaLag...</span>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full select-none cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Y-axis label */}
        <text x={4} y={PADDING.top + chartH / 2} textAnchor="middle" fill="#6b7280" fontSize={8} transform={`rotate(-90, 4, ${PADDING.top + chartH / 2})`}>
          Lag (s)
        </text>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PADDING.left} y1={yScale(v)} x2={width - PADDING.right} y2={yScale(v)} stroke="#1f2937" strokeWidth={1} />
            <text x={PADDING.left - 8} y={yScale(v) + 3} textAnchor="end" fill="#6b7280" fontSize={9}>
              {formatLag(v)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map((i) => (
          data[i] && (
            <text key={i} x={xScale(i)} y={height - 4} textAnchor="middle" fill="#6b7280" fontSize={7}>
              {formatTimeLabel(data[i].timestamp, rangeMins, showUtc)}
            </text>
          )
        ))}

        {/* Breach zone — red fill above threshold */}
        {lagThreshold > 0 && (
          <>
            <defs>
              <clipPath id="breach-clip">
                <rect x={PADDING.left} y={PADDING.top} width={chartW} height={Math.max(yScale(lagThreshold) - PADDING.top, 0)} />
              </clipPath>
            </defs>
            <path d={lagArea} fill="rgba(239, 68, 68, 0.35)" clipPath="url(#breach-clip)" />
          </>
        )}

        {/* Lag area fill */}
        <path d={lagArea} fill="rgba(148, 163, 184, 0.08)" />

        {/* Lag line */}
        <path d={lagPath} fill="none" stroke="#94a3b8" strokeWidth={1.5} />

        {/* Source WriteIOPS overlay (secondary Y-axis) */}
        {sourceCloudwatchData.length > 0 && (() => {
          const srcMax = Math.max(...sourceCloudwatchData.map(p => p.writeIops), 1) * 1.1;
          const srcYScale = (v: number) => PADDING.top + chartH - (v / srcMax) * chartH;
          const srcTimeMap = new Map(sourceCloudwatchData.map(p => [p.timestamp.slice(0, 16), p]));

          const srcPoints: { x: number; y: number }[] = [];
          for (let i = 0; i < data.length; i++) {
            const key = data[i].timestamp.slice(0, 16);
            const sp = srcTimeMap.get(key);
            if (sp) srcPoints.push({ x: xScale(i), y: srcYScale(sp.writeIops) });
          }

          if (srcPoints.length < 2) {
            const srcXScale = (i: number) => PADDING.left + (i / Math.max(sourceCloudwatchData.length - 1, 1)) * chartW;
            sourceCloudwatchData.forEach((p, i) => {
              srcPoints.push({ x: srcXScale(i), y: srcYScale(p.writeIops) });
            });
          }

          const srcPath = srcPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          const srcTicks = [0, srcMax * 0.25, srcMax * 0.5, srcMax * 0.75, srcMax];

          return (
            <>
              <path d={srcPath} fill="none" stroke="#f59e0b" strokeWidth={1.2} opacity={0.7} />
              {srcTicks.map((v, i) => (
                <text key={`src-y-${i}`} x={width - PADDING.right + 6} y={srcYScale(v) + 3} textAnchor="start" fill="#f59e0b" fontSize={8} opacity={0.6}>
                  {formatIops(v)}
                </text>
              ))}
              <text x={width - 4} y={PADDING.top + chartH / 2} textAnchor="middle" fill="#f59e0b" fontSize={8} opacity={0.6} transform={`rotate(90, ${width - 4}, ${PADDING.top + chartH / 2})`}>
                Source WriteIOPS
              </text>
            </>
          );
        })()}

        {/* Threshold line */}
        {lagThreshold > 0 && (
          <>
            <line
              x1={PADDING.left} y1={yScale(lagThreshold)}
              x2={width - PADDING.right} y2={yScale(lagThreshold)}
              stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.8}
            />
            <text
              x={width - PADDING.right - 2} y={yScale(lagThreshold) - 4}
              textAnchor="end" fill="#ef4444" fontSize={8} fontWeight="bold" opacity={0.9}
            >
              SLA THRESHOLD ({formatLag(lagThreshold)})
            </text>
          </>
        )}

        {/* Drag selection overlay */}
        {selX1 !== null && selX2 !== null && (
          <rect
            x={selX1} y={PADDING.top} width={selX2 - selX1} height={chartH}
            fill="rgba(148, 163, 184, 0.15)" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 2"
          />
        )}

        {/* Hover crosshair */}
        {hoveredIdx !== null && dragStart === null && (
          <line
            x1={xScale(hoveredIdx)} y1={PADDING.top}
            x2={xScale(hoveredIdx)} y2={PADDING.top + chartH}
            stroke="#4b5563" strokeWidth={1} strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-slate-400 rounded" />
          <span className="text-[10px] text-slate-500">ReplicaLag</span>
        </div>
        {sourceCloudwatchData.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-amber-500 rounded" style={{ opacity: 0.7 }} />
            <span className="text-[10px] text-slate-500">Source WriteIOPS</span>
          </div>
        )}
        {lagThreshold > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ borderTop: '1.5px dashed #ef4444' }} />
            <span className="text-[10px] text-slate-500">SLA Threshold</span>
          </div>
        )}
        <span className="text-[10px] text-slate-600 ml-auto">{sourceInstanceId ? `Source: ${sourceInstanceId}` : 'Drag to zoom'}</span>
      </div>

      {/* Breach summary */}
      {lagThreshold > 0 && breachCount > 0 && (
        <div className="flex items-center gap-2 px-4 mt-0.5 mb-1">
          <span className="text-[10px] font-medium text-red-400">
            BREACH — {breachCount} of {data.length} intervals exceed SLA threshold
          </span>
          <span className="text-[10px] text-slate-600">
            Peak: {formatLag(peak)} ({((peak / lagThreshold) * 100).toFixed(0)}% of {formatLag(lagThreshold)} limit)
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredPoint && dragStart === null && (() => {
        const hoverKey = hoveredPoint.timestamp.slice(0, 16);
        const srcPoint = sourceCloudwatchData.find(p => p.timestamp.slice(0, 16) === hoverKey);
        return (
          <div className={`absolute top-2 right-6 border rounded px-2 py-1.5 text-[10px] text-slate-300 space-y-0.5 pointer-events-none ${
            lagThreshold > 0 && hoveredPoint.lagSeconds > lagThreshold
              ? 'bg-red-950 border-red-700'
              : 'bg-slate-800 border-slate-700'
          }`}>
            <div className="text-slate-500">{formatTimeLabel(hoveredPoint.timestamp, rangeMins, showUtc)}</div>
            <div>Lag: <span className="text-slate-200 font-medium">{formatLag(hoveredPoint.lagSeconds)}</span></div>
            {srcPoint && (
              <>
                <div>Source Write: <span className="text-amber-400 font-medium">{formatIops(srcPoint.writeIops)} IOPS</span></div>
                <div>Source CPU: <span className="text-slate-200 font-medium">{srcPoint.cpuUtilization.toFixed(1)}%</span></div>
              </>
            )}
            {lagThreshold > 0 && hoveredPoint.lagSeconds > lagThreshold && (
              <div className="text-red-400 font-bold">BREACH ({((hoveredPoint.lagSeconds / lagThreshold) * 100).toFixed(0)}% of limit)</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
