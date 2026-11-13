import { create } from "zustand"

import type { Job, JobEventPayload, JobStatus } from "@/types/api"

export interface WorkflowNotification {
  id: string
  tone: "info" | "success" | "error"
  title: string
  message: string
}

interface WorkflowState {
  activeJobId: string | null
  job: Job | null
  event: JobEventPayload | null
  lastEventSequence: number
  isStarting: boolean
  isCancelling: boolean
  idempotencyKey: string | null
  notifications: WorkflowNotification[]
  setActiveJob: (job: Job) => void
  setJobSnapshot: (job: Job) => void
  applyEvent: (event: JobEventPayload) => void
  setStarting: (starting: boolean) => void
  setCancelling: (cancelling: boolean) => void
  setIdempotencyKey: (key: string | null) => void
  clearActiveJob: () => void
  addNotification: (notification: Omit<WorkflowNotification, "id">) => void
  dismissNotification: (id: string) => void
}

function isTerminal(status: JobStatus) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "recoverable"
  )
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  activeJobId: null,
  job: null,
  event: null,
  lastEventSequence: 0,
  isStarting: false,
  isCancelling: false,
  idempotencyKey: null,
  notifications: [],
  setActiveJob: (job) =>
    set({
      activeJobId: job.id,
      job,
      event: null,
      lastEventSequence: job.last_event_sequence,
      isStarting: false,
      isCancelling: false,
    }),
  setJobSnapshot: (job) =>
    set((state) => {
      const sameJob = state.activeJobId === job.id
      const snapshotIsStale = sameJob && state.lastEventSequence > job.last_event_sequence
      const eventIsCurrent =
        sameJob &&
        state.event !== null &&
        state.event.sequence <= job.last_event_sequence
      return {
        activeJobId: job.id,
        job: snapshotIsStale && state.job !== null ? state.job : job,
        event: eventIsCurrent ? state.event : null,
        lastEventSequence: sameJob
          ? Math.max(state.lastEventSequence, job.last_event_sequence)
          : job.last_event_sequence,
      }
    }),
  applyEvent: (event) =>
    set((state) => {
      if (!Number.isInteger(event.sequence) || event.sequence <= state.lastEventSequence) {
        return state
      }
      if (state.activeJobId !== event.job_id || state.job === null) {
        return state
      }
      return {
        activeJobId: event.job_id,
        event,
        lastEventSequence: event.sequence,
        job: {
          ...state.job,
          status: event.status,
          stage: event.stage,
          stage_label: event.stage_label,
          operation: event.operation ?? state.job.operation,
          progress_percent: event.progress_percent,
          elapsed_seconds: event.elapsed_seconds,
          eta_remaining_seconds: event.eta_remaining_seconds,
          message: event.message,
          error_message: event.error_message,
          updated_at: event.updated_at,
          last_event_sequence: event.sequence,
        },
      }
    }),
  setStarting: (isStarting) => set({ isStarting }),
  setCancelling: (isCancelling) => set({ isCancelling }),
  setIdempotencyKey: (idempotencyKey) => set({ idempotencyKey }),
  clearActiveJob: () =>
    set({
      activeJobId: null,
      job: null,
      event: null,
      lastEventSequence: 0,
      isStarting: false,
      isCancelling: false,
    }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: crypto.randomUUID() },
      ].slice(-4),
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
}))

export { isTerminal }
