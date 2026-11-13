export const queryKeys = {
  health: ["health"] as const,
  settings: ["settings"] as const,
  providers: ["settings", "providers"] as const,
  providerModels: (providerId: number, credentialProfileId: number | null) =>
    ["settings", "providers", providerId, "models", credentialProfileId] as const,
  musicFolder: ["system", "music-folder"] as const,
  activeJob: ["jobs", "active"] as const,
  job: (id: string) => ["jobs", id] as const,
}
