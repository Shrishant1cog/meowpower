import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import type { AIProvider, CredentialProfile, ProviderType } from "@/types/api"

export interface ProviderInput {
  name: string
  provider_type: ProviderType
  model_identifier: string
  endpoint_url?: string | null
  api_key?: string
  api_key_profile_name?: string
  is_active?: boolean
  remove_credential?: boolean
}

export interface CredentialProfileInput {
  label: string
  api_key?: string
  is_active?: boolean
}

export function useProviders() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => apiRequest<AIProvider[]>("/api/v1/settings/providers"),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.providers })
  const invalidateModels = (providerId: number) =>
    queryClient.invalidateQueries({
      queryKey: ["settings", "providers", providerId, "models"],
    })

  const create = useMutation({
    mutationFn: (input: ProviderInput) =>
      apiRequest<AIProvider>("/api/v1/settings/providers", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ProviderInput> }) =>
      apiRequest<AIProvider>(`/api/v1/settings/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (provider) => {
      void invalidate()
      void invalidateModels(provider.id)
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`/api/v1/settings/providers/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      void invalidate()
      void invalidateModels(id)
    },
  })
  const createCredential = useMutation({
    mutationFn: ({
      providerId,
      input,
    }: {
      providerId: number
      input: CredentialProfileInput
    }) =>
      apiRequest<CredentialProfile>(
        `/api/v1/settings/providers/${providerId}/credential-profiles`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: (_profile, variables) => {
      void invalidate()
      void invalidateModels(variables.providerId)
    },
  })
  const updateCredential = useMutation({
    mutationFn: ({
      providerId,
      profileId,
      input,
    }: {
      providerId: number
      profileId: number
      input: Partial<CredentialProfileInput>
    }) =>
      apiRequest<CredentialProfile>(
        `/api/v1/settings/providers/${providerId}/credential-profiles/${profileId}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: (_profile, variables) => {
      void invalidate()
      void invalidateModels(variables.providerId)
    },
  })
  const removeCredential = useMutation({
    mutationFn: ({ providerId, profileId }: { providerId: number; profileId: number }) =>
      apiRequest<void>(
        `/api/v1/settings/providers/${providerId}/credential-profiles/${profileId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_result, variables) => {
      void invalidate()
      void invalidateModels(variables.providerId)
    },
  })

  return {
    ...query,
    create,
    update,
    remove,
    createCredential,
    updateCredential,
    removeCredential,
    isMutating:
      create.isPending ||
      update.isPending ||
      remove.isPending ||
      createCredential.isPending ||
      updateCredential.isPending ||
      removeCredential.isPending,
  }
}
