import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import type { DirectoryPickResponse, FolderSummary } from "@/types/api"

export function useMusicFolder() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.musicFolder,
    queryFn: () => apiRequest<FolderSummary>("/api/system/music-folder"),
  })

  const pick = useMutation({
    mutationFn: () =>
      apiRequest<DirectoryPickResponse>("/api/system/pick-directory", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.musicFolder })
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
  })

  const clear = useMutation({
    mutationFn: () =>
      apiRequest<FolderSummary>("/api/system/music-folder", { method: "DELETE" }),
    onSuccess: (summary) => {
      queryClient.setQueryData(queryKeys.musicFolder, summary)
      queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
  })

  return { ...query, pick, clear, isPicking: pick.isPending }
}
