import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { useWorkflowStore } from "@/stores/workflow"
import type { ActiveJobResponse } from "@/types/api"

export function useActiveJob() {
  const query = useQuery({
    queryKey: queryKeys.activeJob,
    queryFn: () => apiRequest<ActiveJobResponse>("/api/v1/jobs/active"),
    retry: 1,
    staleTime: 5_000,
  })

  useEffect(() => {
    const recovered = query.data?.job
    if (!recovered) return

    const current = useWorkflowStore.getState().job
    if (
      current !== null &&
      current.id !== recovered.id &&
      Date.parse(recovered.created_at) < Date.parse(current.created_at)
    ) {
      return
    }
    useWorkflowStore.getState().setJobSnapshot(recovered)
  }, [query.data])

  return query
}
