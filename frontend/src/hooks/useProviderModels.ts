import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import type { ModelCatalog, ProviderConnectionResult } from "@/types/api"

function modelCatalogUrl(
  providerId: number,
  credentialProfileId: number | null,
  refresh = false,
) {
  const params = new URLSearchParams()
  if (credentialProfileId !== null) {
    params.set("credential_profile_id", String(credentialProfileId))
  }
  if (refresh) params.set("refresh", "true")
  const suffix = params.size > 0 ? `?${params.toString()}` : ""
  return `/api/v1/settings/providers/${providerId}/models${suffix}`
}

export function useProviderModels(
  providerId: number | null,
  credentialProfileId: number | null,
  enabled = true,
) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.providerModels(providerId ?? 0, credentialProfileId)
  const query = useQuery({
    queryKey,
    queryFn: () =>
      apiRequest<ModelCatalog>(modelCatalogUrl(providerId!, credentialProfileId)),
    enabled: providerId !== null && enabled,
    retry: false,
    staleTime: 60_000,
  })

  const refresh = useMutation({
    mutationFn: () =>
      apiRequest<ModelCatalog>(
        modelCatalogUrl(providerId!, credentialProfileId, true),
      ),
    onSuccess: (catalog) => {
      queryClient.setQueryData(queryKey, catalog)
    },
  })

  return { ...query, refresh }
}

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: ({
      providerId,
      credentialProfileId,
    }: {
      providerId: number
      credentialProfileId: number | null
    }) =>
      apiRequest<ProviderConnectionResult>(
        `/api/v1/settings/providers/${providerId}/test-connection`,
        {
          method: "POST",
          body: JSON.stringify({ credential_profile_id: credentialProfileId }),
        },
      ),
    retry: false,
  })
}
