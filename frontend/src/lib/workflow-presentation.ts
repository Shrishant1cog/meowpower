import type { JobStatus } from "@/types/api"

export type WorkflowPresentationTone = "neutral" | "info" | "success" | "warning" | "error"

export interface WorkflowPresentation {
  label: "Ready" | "Running" | "Paused" | "Completed" | "Cancelled" | "Failed"
  tone: WorkflowPresentationTone
}

export function getWorkflowPresentation(status: JobStatus | null | undefined): WorkflowPresentation {
  switch (status) {
    case "queued":
      return { label: "Ready", tone: "neutral" }
    case "running":
      return { label: "Running", tone: "info" }
    case "completed":
      return { label: "Completed", tone: "success" }
    case "recoverable":
      return { label: "Paused", tone: "warning" }
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" }
    case "failed":
      return { label: "Failed", tone: "error" }
    default:
      return { label: "Ready", tone: "neutral" }
  }
}
