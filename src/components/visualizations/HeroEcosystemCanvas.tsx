import { useEffect, useRef } from 'react';

interface GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  label?: string;
  primary?: boolean;
}

const primaryLabels = [
  'Intelligence & Research',
  'Real-World Engineering',
  'Low-Level Model Eng.',
  'Agentic & Generative AI',
  'Universal Episode Engine',
  'Training Infrastructure',
  'LIIO Observatory',
  'Agentic Research',
];

export function HeroEcosystemCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let width = 0;
    let height = 0;
    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const nodes: GraphNode[] = [];
    const totalNodes = 34;

    const initNodes = (w: number, h: number) => {
      nodes.length = 0;
      for (let i = 0; i < totalNodes; i++) {
        const isPrimary = i < primaryLabels.length;
        const angle = (i / primaryLabels.length) * Math.PI * 2;
        const rx = w * 0.28;
        const ry = h * 0.28;
        const x = isPrimary
          ? w * 0.62 + Math.cos(angle) * rx * (0.75 + (i % 2) * 0.32)
          : Math.random() * w;
        const y = isPrimary
          ? h * 0.5 + Math.sin(angle) * ry * (0.75 + ((i + 1) % 2) * 0.28)
          : Math.random() * h;

        nodes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * (isPrimary ? 0.14 : 0.22),
          vy: (Math.random() - 0.5) * (isPrimary ? 0.14 : 0.22),
          radius: isPrimary ? 3.5 : 1.6,
          label: isPrimary ? primaryLabels[i] : undefined,
          primary: isPrimary,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) {
        initNodes(width, height);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    let tick = 0;

    const draw = () => {
      tick += 0.008;
      ctx.clearRect(0, 0, width, height);

      // Update positions gently
      if (!prefersReducedMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;

          const minX = n.primary ? width * 0.28 : 20;
          const maxX = width - 24;
          const minY = 24;
          const maxY = height - 24;

          if (n.x < minX || n.x > maxX) n.vx *= -1;
          if (n.y < minY || n.y > maxY) n.vy *= -1;
          n.x = Math.max(minX, Math.min(maxX, n.x));
          n.y = Math.max(minY, Math.min(maxY, n.y));
        }
      }

      // Draw edges between nearby nodes
      const maxDist = Math.min(230, Math.max(150, width * 0.18));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (a.primary || b.primary ? 0.24 : 0.1);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle =
              a.primary && b.primary
                ? `rgba(59, 130, 246, ${alpha * 1.4})`
                : `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = a.primary && b.primary ? 1 : 0.7;
            ctx.stroke();

            // Subtle traveling signal pulse on primary-to-primary connections
            if (!prefersReducedMotion && a.primary && b.primary && (i + j) % 2 === 0) {
              const t = (tick * 0.65 + (i * 0.23 + j * 0.17)) % 1;
              const px = a.x + dx * t;
              const py = a.y + dy * t;
              ctx.beginPath();
              ctx.arc(px, py, 1.5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
              ctx.fill();
            }
          }
        }
      }

      // Draw nodes and primary labels
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.primary ? '#38BDF8' : 'rgba(148, 163, 184, 0.45)';
        ctx.fill();

        if (n.primary && n.label) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = '500 11px "IBM Plex Mono", monospace';
          ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
          ctx.fillText(n.label, n.x + 10, n.y + 3);
        }
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-75"
    />
  );
}
