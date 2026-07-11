'use client';

// The broadcast field scene (PixiJS / WebGL). Bundled (not CDN), so it's CSP-safe on the Next
// app. Renders a football field with team-colored end zones, yard lines, a line of scrimmage, a
// gold first-down marker, and a ball that slides to each play's spot. Fails soft: if WebGL is
// unavailable the host stays empty and the rest of the viewer still works.

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';

export interface FieldState {
  ballYardLine: number; // 0-100 in the offense's frame (0 = own goal, 100 = touchdown)
  firstDownYardLine: number | null;
  possession: 'home' | 'away';
  homeColor: number;
  awayColor: number;
}

const W = 680;
const H = 300;
const EZ = (W * 10) / 120; // end-zone width (10 of 120 yards)
const FIELD_W = (W * 100) / 120;
const yardToX = (yl: number) => EZ + (yl / 100) * FIELD_W;
const toFieldX = (yl: number, poss: 'home' | 'away') => yardToX(poss === 'home' ? yl : 100 - yl);

export function FieldCanvas({ state }: { state: FieldState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const nodes = useRef<{
    leftEZ: Graphics;
    rightEZ: Graphics;
    los: Graphics;
    firstDown: Graphics;
    ball: Container;
  } | null>(null);
  const target = useRef({ ballX: yardToX(50) });

  useEffect(() => {
    let disposed = false;
    const app = new Application();
    app
      .init({ width: W, height: H, backgroundAlpha: 0, antialias: true })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }
        appRef.current = app;
        hostRef.current?.appendChild(app.canvas as HTMLCanvasElement);

        // Grass + yard lines (static).
        const field = new Graphics();
        field.rect(EZ, 0, FIELD_W, H).fill(0x1f7a3d);
        for (let yl = 0; yl <= 100; yl += 10) {
          const x = yardToX(yl);
          field.moveTo(x, 0).lineTo(x, H);
        }
        field.stroke({ width: 1.5, color: 0xffffff, alpha: 0.55 });
        app.stage.addChild(field);

        // Yard numbers at the 10s.
        for (let yl = 10; yl < 100; yl += 10) {
          const n = yl <= 50 ? yl : 100 - yl;
          const label = new Text({
            text: String(n),
            style: { fill: 0xffffff, fontSize: 13, fontWeight: '700', fontFamily: 'system-ui' },
          });
          label.alpha = 0.6;
          label.anchor.set(0.5);
          label.x = yardToX(yl);
          label.y = H - 20;
          app.stage.addChild(label);
        }

        const leftEZ = new Graphics();
        const rightEZ = new Graphics();
        leftEZ.rect(0, 0, EZ, H);
        rightEZ.rect(W - EZ, 0, EZ, H);
        app.stage.addChild(leftEZ, rightEZ);

        const firstDown = new Graphics();
        firstDown.rect(-1.5, 0, 3, H).fill(0xf2c24e);
        firstDown.visible = false;
        app.stage.addChild(firstDown);

        const los = new Graphics();
        los.rect(-1, 0, 2, H).fill({ color: 0xffffff, alpha: 0.9 });
        app.stage.addChild(los);

        const ball = new Container();
        const bg = new Graphics();
        bg.circle(0, 0, 12).fill({ color: 0x000000, alpha: 0.25 });
        bg.ellipse(0, 0, 8, 5).fill(0x7a3b12).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
        ball.addChild(bg);
        ball.y = H / 2;
        ball.x = yardToX(50);
        app.stage.addChild(ball);

        nodes.current = { leftEZ, rightEZ, los, firstDown, ball };
        applyState(stateRef.current);

        // Slide the ball toward its target each frame.
        app.ticker.add(() => {
          const b = nodes.current?.ball;
          if (!b) return;
          b.x += (target.current.ballX - b.x) * 0.2;
        });
      })
      .catch(() => {
        // WebGL not available — degrade to an empty scene.
      });

    return () => {
      disposed = true;
      appRef.current?.destroy(true);
      appRef.current = null;
      nodes.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the latest state available to the async init, and apply it on every change.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    applyState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function applyState(s: FieldState) {
    const n = nodes.current;
    if (!n) return;
    n.leftEZ.clear().rect(0, 0, EZ, H).fill(s.homeColor);
    n.rightEZ.clear().rect(W - EZ, 0, EZ, H).fill(s.awayColor);
    const ballX = toFieldX(s.ballYardLine, s.possession);
    target.current.ballX = ballX;
    n.los.x = ballX;
    if (s.firstDownYardLine === null) {
      n.firstDown.visible = false;
    } else {
      n.firstDown.visible = true;
      n.firstDown.x = toFieldX(s.firstDownYardLine, s.possession);
    }
  }

  return (
    <div
      ref={hostRef}
      className="border-border mx-auto w-full overflow-hidden rounded-lg border"
      style={{ maxWidth: W, aspectRatio: `${W} / ${H}` }}
    />
  );
}
