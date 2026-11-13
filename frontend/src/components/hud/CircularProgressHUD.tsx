import { MotionCircle } from "@/components/motion/primitives"

import { cn } from "@/lib/utils"
import { getWorkflowPresentation } from "@/lib/workflow-presentation"
import { useWorkflowStore } from "@/stores/workflow"

interface CircularProgressHUDProps {
  size?: "sm" | "md"
  className?: string
}

export function CircularProgressHUD({ size = "md", className }: CircularProgressHUDProps) {
  const job = useWorkflowStore((state) => state.job)
  const event = useWorkflowStore((state) => state.event)
  const progress = Math.max(0, Math.min(100, event?.progress_percent ?? job?.progress_percent ?? 0))
  const status = event?.status ?? job?.status ?? "queued"
  const elapsed = event?.elapsed_seconds ?? job?.elapsed_seconds ?? 0
  const eta = event?.eta_remaining_seconds ?? job?.eta_remaining_seconds ?? null
  const radius = size === "sm" ? 19 : 27
  const dimension = size === "sm" ? 48 : 68
  const circumference = 2 * Math.PI * radius
  const completed = status === "completed"
  const failed = status === "failed" || status === "cancelled"
  const stroke = completed ? "var(--primary)" : failed ? "var(--destructive)" : "var(--primary)"
  const operation = event?.operation ?? job?.operation ?? "Ready to start the Phase 1 partial workflow"
  const percentage = progress.toFixed(1).replace(/\.0$/, "")
  const presentation = getWorkflowPresentation(status)

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative shrink-0"
        style={{ width: dimension, height: dimension }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-valuetext={`${percentage} percent, ${presentation.label}`}
      >
        <svg viewBox={`0 0 ${dimension} ${dimension}`} className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={size === "sm" ? 4 : 5}
          />
          <MotionCircle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={size === "sm" ? 4 : 5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference * (1 - progress / 100) }}
            transition={{ type: "spring", stiffness: 150, damping: 24, mass: 0.8 }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">
          {percentage}%
        </span>
      </div>
      <div className={cn("min-w-0", size === "sm" ? "hidden xl:block" : "block")}>
        <div className="max-w-48 truncate text-xs font-medium">
          {event?.stage_label ?? job?.stage_label ?? "Ready for partial workflow"}
        </div>
        <div className="max-w-48 truncate text-[10px] text-muted-foreground">{operation}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {elapsed.toFixed(0)}s elapsed · {eta === null ? "ETA calculating" : `${Math.ceil(eta)}s remaining`}
        </div>
      </div>
    </div>
  )
}
