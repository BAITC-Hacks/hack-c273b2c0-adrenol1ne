"use client";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <div className="brand-mark">
        <span />
        <span />
        <span />
      </div>
      <div>
        halyk<span className="brand-product">TalentOS</span>
      </div>
    </div>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ReadinessRing({
  value,
  small = false,
}: {
  value: number;
  small?: boolean;
}) {
  const reduce = useReducedMotion();
  const r = 72,
    c = 2 * Math.PI * r;
  return (
    <div className={`readiness-ring ${small ? "ring-small" : ""}`}>
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`${value}% career readiness`}
      >
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="ring-track"
        />
        <motion.circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: reduce ? 0 : 1 }}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="ring-label">
        <strong>
          {value}
          <span>%</span>
        </strong>
        <span>career ready</span>
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <span className="loading-inline">
      <LoaderCircle className="spin" size={16} /> Updating…
    </span>
  );
}
export function StepCheck() {
  return (
    <span className="step-check">
      <Check size={14} />
    </span>
  );
}
export const Arrow = ArrowRight;
export const UpArrow = ArrowUpRight;
