import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { isTerminal, useWorkflowStore } from "@/stores/workflow"
import type { Job } from "@/types/api"

function createRequestId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `request-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useWorkflowActions() {
  const queryClient = useQueryClient()
  const store = useWorkflowStore

  const startMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const job = await apiRequest<Job>("/api/v1/jobs/demo", {
        method: "POST",
        body: JSON.stringify({ request_id: requestId }),
      })
      return job
    },
    onSuccess: (job) => {
      store.getState().setActiveJob(job)
      store.getState().addNotification({
        tone: "info",
        title: "Partial workflow started",
        message: "The backend is streaming implemented foundation-check activity.",
      })
      queryClient.setQueryData(queryKeys.job(job.id), job)
    },
    onError: (error) => {
      store.getState().addNotification({
        tone: "error",
        title: "Could not start workflow",
        message: error instanceof Error ? error.message : "The local API request failed.",
      })
    },
    onSettled: () => {
      store.getState().setStarting(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiRequest<Job>(`/api/v1/jobs/${jobId}/cancel`, { method: "POST" }),
    onSuccess: (job) => {
      const wasAlreadyCancelled = store.getState().job?.status === "cancelled"
      store.getState().setJobSnapshot(job)
      if (job.status === "cancelled" && !wasAlreadyCancelled) {
        store.getState().addNotification({
          tone: "error",
          title: "Partial workflow cancelled",
          message: job.message,
        })
      }
      queryClient.setQueryData(queryKeys.job(job.id), job)
    },
    onError: (error) => {
      store.getState().addNotification({
        tone: "error",
        title: "Could not cancel workflow",
        message: error instanceof Error ? error.message : "The local API request failed.",
      })
    },
    onSettled: () => {
      store.getState().setCancelling(false)
    },
  })

  const start = async () => {
    const state = store.getState()
    if (
      state.isStarting ||
      state.job?.status === "queued" ||
      state.job?.status === "running"
    ) {
      return
    }
    const previousFinished = state.job !== null && isTerminal(state.job.status)
    const requestId = previousFinished
      ? createRequestId()
      : state.idempotencyKey ?? createRequestId()
    state.setIdempotencyKey(requestId)
    state.setStarting(true)
    try {
      await startMutation.mutateAsync(requestId)
    } catch {
      // The mutation callback exposes a recoverable notification.
    }
  }

  const cancel = async () => {
    const state = store.getState()
    const jobId = state.activeJobId
    if (
      !jobId ||
      state.isCancelling ||
      (state.job?.status !== "queued" && state.job?.status !== "running")
    ) {
      return
    }
    state.setCancelling(true)
    try {
      await cancelMutation.mutateAsync(jobId)
    } catch {
      // The mutation callback exposes a recoverable notification.
    }
  }

  return {
    start,
    cancel,
    isStarting: store((state) => state.isStarting),
    isCancelling: store((state) => state.isCancelling),
  }
}
