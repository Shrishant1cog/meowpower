import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { useWorkflowStore } from "@/stores/workflow"
import type { AppSettings, Theme } from "@/types/api"

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme
  localStorage.setItem("meowpower-theme", theme)
}

export function useSettings() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiRequest<AppSettings>("/api/v1/settings"),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (query.data) applyTheme(query.data.theme)
  }, [query.data])

  const mutation = useMutation({
    mutationFn: (theme: Theme) =>
      apiRequest<AppSettings>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      }),
    onMutate: (theme) => applyTheme(theme),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings, settings)
      applyTheme(settings.theme)
    },
  })

  return { ...query, setTheme: mutation.mutateAsync, isUpdating: mutation.isPending }
}
