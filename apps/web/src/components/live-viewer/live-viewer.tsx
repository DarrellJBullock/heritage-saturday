'use client';

// The live game viewer: replays a finished game's plays with a scorebug, an animated field
// (PixiJS, loaded client-only), playback controls, and a running text-commentary feed.

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PlayDto } from '@heritage-saturday/shared';
import { Button } from '@/components/ui/button';
import { commentaryFor } from '@/lib/commentary';
import type { FieldState } from './field-canvas';

// PixiJS touches the DOM/WebGL — never render it on the server.
const FieldCanvas = dynamic(() => import('./field-canvas').then((m) => m.FieldCanvas), {
  ssr: false,
  loading: () => (
    <div
      className="border-border bg-muted/30 mx-auto w-full rounded-lg border"
      style={{ maxWidth: 680, aspectRatio: '680 / 300' }}
    />
  ),
});

function parseHex(hex: string | null, fallback: number): number {
  if (!hex) return fallback;
  const m = hex.trim().replace(/^#/, '');
  const full = m.length === 3 ? m.replace(/(.)/g, '$1$1') : m;
  return /^[0-9a-fA-F]{6}$/.test(full) ? parseInt(full, 16) : fallback;
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];
const BASE_INTERVAL_MS = 1600;

export interface LiveViewerProps {
  homeName: string;
  awayName: string;
  homeColorHex: string | null;
  awayColorHex: string | null;
  finalScore: { home: number; away: number };
  plays: PlayDto[];
}

export function LiveViewer({
  homeName,
  awayName,
  homeColorHex,
  awayColorHex,
  finalScore,
  plays,
}: LiveViewerProps) {
  const homeColor = parseHex(homeColorHex, 0x2c4372);
  const awayColor = parseHex(awayColorHex, 0x8a6d1f);

  const [idx, setIdx] = useState(0); // index of the play currently on screen
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = plays.length - 1;

  // Advance while playing.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => Math.min(last, i + 1)), BASE_INTERVAL_MS / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, last]);

  const play = plays[idx];

  // Approximate running score (TD 7, FG 3); pinned to the real final on the last play so it never
  // contradicts the box score.
  const running = useMemo(() => {
    if (idx >= last) return finalScore;
    let h = 0;
    let a = 0;
    for (let i = 0; i <= idx; i++) {
      const p = plays[i];
      const pts = p.result === 'TOUCHDOWN' ? 7 : p.result === 'FIELD_GOAL_GOOD' ? 3 : 0;
      if (pts) p.side === 'home' ? (h += pts) : (a += pts);
    }
    return { home: h, away: a };
  }, [idx, last, plays, finalScore]);

  const isSpecial = play.playType === 'PUNT' || play.playType === 'FIELD_GOAL';
  const fieldState: FieldState = {
    ballYardLine: play.result === 'TOUCHDOWN' ? 100 : play.yardLine,
    firstDownYardLine: isSpecial || play.down === 0 ? null : Math.min(100, play.yardLine + play.yardsToGo),
    possession: play.side,
    homeColor,
    awayColor,
  };

  // Commentary up to the current play.
  const commentary = useMemo(() => {
    let h = 0;
    let a = 0;
    const lines: { key: number; text: string }[] = [];
    for (let i = 0; i <= idx; i++) {
      const p = plays[i];
      const pts = p.result === 'TOUCHDOWN' ? 7 : p.result === 'FIELD_GOAL_GOOD' ? 3 : 0;
      if (pts) p.side === 'home' ? (h += pts) : (a += pts);
      lines.push({
        key: i,
        text: commentaryFor(p, { homeName, awayName, homeScore: h, awayScore: a }, i),
      });
    }
    return lines;
  }, [idx, plays, homeName, awayName]);

  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [idx]);

  const quarterLabel = play.quarter <= 4 ? `Q${play.quarter}` : 'OT';
  const downDistance = isSpecial || !play.down ? '' : `${ORDINAL[play.down] ?? play.down} & ${play.yardsToGo}`;
  const possName = play.side === 'home' ? homeName : awayName;

  function nextDrive() {
    let i = idx + 1;
    while (i < last && plays[i].side === play.side && plays[i].quarter === play.quarter) i++;
    setIdx(Math.min(last, i));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Scorebug */}
      <div className="from-brand-strong via-brand to-brand-strong flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r px-4 py-2 text-white shadow">
        <TeamScore name={awayName} score={running.away} live={play.side === 'away'} />
        <div className="text-center leading-tight">
          <div className="text-brand-accent text-sm font-bold tabular-nums">{play.clock || '—'}</div>
          <div className="text-[10px] uppercase tracking-widest text-white/60">{quarterLabel}</div>
        </div>
        <TeamScore name={homeName} score={running.home} live={play.side === 'home'} align="right" />
      </div>
      {downDistance && (
        <p className="text-muted-foreground -mt-1 text-center text-xs">
          {downDistance} · {possName} ball
        </p>
      )}

      <FieldCanvas state={fieldState} />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setIdx(0)} disabled={idx === 0}>
          ⏮
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ◀
        </Button>
        <Button size="sm" onClick={() => setPlaying((p) => !p)} disabled={idx >= last && !playing}>
          {playing ? 'Pause' : idx >= last ? 'Replay' : 'Play'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.min(last, i + 1))} disabled={idx >= last}>
          ▶
        </Button>
        <Button size="sm" variant="outline" onClick={nextDrive} disabled={idx >= last}>
          Skip drive
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIdx(last)} disabled={idx >= last}>
          Final
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
        >
          {speed}×
        </Button>
      </div>

      {/* Commentary feed */}
      <div
        ref={feedRef}
        className="bg-muted/30 flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg p-3 text-sm"
      >
        {commentary.map((c) => (
          <p key={c.key} className={c.key === idx ? 'font-medium' : 'text-muted-foreground'}>
            {c.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function TeamScore({
  name,
  score,
  live,
  align = 'left',
}: {
  name: string;
  score: number;
  live: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className={`bg-brand-accent h-2 w-2 shrink-0 rounded-full ${live ? '' : 'opacity-0'}`} aria-hidden />
      <span className="truncate text-sm font-semibold">{name}</span>
      <span className="text-xl font-bold tabular-nums">{score}</span>
    </div>
  );
}
