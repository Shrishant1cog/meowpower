import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { isTerminal, useWorkflowStore } from "@/stores/workflow"
import type { Job, JobEventPayload } from "@/types/api"

export function useJobEvents(jobId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!jobId) return
    let source: EventSource | null = null
    let disposed = false

    const handleProgress = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as JobEventPayload
        if (!Number.isInteger(event.sequence)) return

        const store = useWorkflowStore.getState()
        const previousSequence = store.lastEventSequence
        store.applyEvent(event)
        const updatedStore = useWorkflowStore.getState()
        if (updatedStore.lastEventSequence === previousSequence) {
          if (isTerminal(event.status)) source?.close()
          return
        }

        if (updatedStore.job !== null) {
          queryClient.setQueryData(queryKeys.job(jobId), updatedStore.job)
        }
        if (isTerminal(event.status)) {
          source?.close()
          updatedStore.addNotification({
            tone: event.status === "completed" ? "success" : "error",
            title:
              event.status === "completed"
                ? "Partial workflow complete"
                : event.status === "cancelled"
                  ? "Partial workflow cancelled"
                  : event.status === "recoverable"
                    ? "Partial workflow paused"
                    : "Partial workflow failed",
            message: event.message,
          })
        }
      } catch {
        // Ignore malformed events and wait for the next valid server event.
      }
    }

    const connect = async () => {
      let cursor = useWorkflowStore.getState().lastEventSequence
      try {
        const snapshot = await apiRequest<Job>(`/api/v1/jobs/${jobId}`)
        if (disposed) return
        useWorkflowStore.getState().setJobSnapshot(snapshot)
        const current = useWorkflowStore.getState()
        queryClient.setQueryData(queryKeys.job(jobId), current.job ?? snapshot)
        cursor = Math.max(snapshot.last_event_sequence, current.lastEventSequence)
        if (isTerminal(snapshot.status)) return
      } catch {
        // The current in-memory cursor remains safe when a snapshot request fails.
      }

      if (disposed) return
      source = new EventSource(
        `/api/v1/jobs/${jobId}/events?after=${encodeURIComponent(cursor)}`,
      )
      source.addEventListener("job.progress", handleProgress as EventListener)
    }

    void connect()
    return () => {
      disposed = true
      source?.close()
    }
  }, [jobId, queryClient])
}
