import { vi } from "vitest"

import type {
  AIProvider,
  AppSettings,
  FolderSummary,
  Job,
  ModelCatalog,
  ProviderConnectionResult,
} from "@/types/api"

export interface MockApiState {
  settings: AppSettings
  providers: AIProvider[]
  folder: FolderSummary
  job: Job
  activeJob: Job | null
  jobStatus: Job["status"]
  cancelDelayMs: number
  pickResult: "selected" | "cancelled"
  modelCatalog: ModelCatalog
  modelCatalogError: { code: string; message: string } | null
  connectionResult: ProviderConnectionResult | null
  connectionError: { code: string; message: string } | null
}

export function createMockState(): MockApiState {
  return {
    settings: {
      theme: "system",
      music_folder: {
        selection_state: "none",
        folder_token: null,
        display_name: null,
        message: "No local music folder has been selected.",
      },
      version: "0.1.5-phase1.5",
    },
    providers: [],
    folder: {
      selection_state: "none",
      folder_token: null,
      display_name: null,
      message: "No local music folder has been selected.",
    },
    job: {
      id: "job-test-1",
      job_type: "foundation_demo",
      status: "queued",
      stage: "queued",
      stage_label: "Queued",
      operation: "Preparing the local foundation demo",
      progress_percent: 0,
      elapsed_seconds: 0,
      eta_remaining_seconds: null,
      message: "Simulated workflow activity queued",
      error_message: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      started_at: null,
      completed_at: null,
      last_event_sequence: 0,
    },
    activeJob: null,
    jobStatus: "queued",
    cancelDelayMs: 0,
    pickResult: "selected",
    modelCatalog: {
      provider_id: 1,
      provider_name: "Primary OpenAI",
      provider_type: "openai",
      endpoint_url: "https://api.openai.com/v1/models",
      models: ["gpt-test", "o3-test"],
      fetched_at: "2026-01-01T00:00:00Z",
      cache_ttl_seconds: 900,
      source: "provider",
      selected_model: "gpt-test",
      selected_model_available: true,
    },
    modelCatalogError: null,
    connectionResult: null,
    connectionError: null,
  }
}

function response(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function installApiMock(state = createMockState()) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    if (url === "/api/v1/health") {
      return response({ status: "ok", app: "MeowPower API", version: "0.1.5-phase1.5", phase: 1, database: "connected" })
    }
    if (url === "/api/v1/settings" && method === "GET") {
      return response(state.settings)
    }
    if (url === "/api/v1/settings" && method === "PATCH") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { theme: AppSettings["theme"] }
      state.settings = { ...state.settings, theme: payload.theme }
      return response(state.settings)
    }
    if (url === "/api/v1/settings/providers" && method === "GET") {
      return response(state.providers)
    }
    if (url === "/api/v1/settings/providers" && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        name: string
        provider_type: AIProvider["provider_type"]
        model_identifier: string
        api_key?: string
        api_key_profile_name?: string
      }
      const profile = payload.api_key
        ? {
            id: 1,
            label: payload.api_key_profile_name ?? "Primary credential",
            credential_status: "stored" as const,
            has_credential: true,
            is_active: true,
          }
        : null
      const provider: AIProvider = {
        id: 1,
        name: payload.name,
        provider_type: payload.provider_type,
        model_identifier: payload.model_identifier,
        endpoint_url: null,
        is_active: false,
        credential_status: payload.api_key ? "stored" : "missing",
        has_credential: Boolean(payload.api_key),
        active_credential_profile_id: profile?.id ?? null,
        active_credential_profile_name: profile?.label ?? null,
        credential_profiles: profile ? [profile] : [],
      }
      state.providers = [provider]
      return response(provider, 201)
    }
    const credentialCollectionMatch = url.match(
      /^\/api\/v1\/settings\/providers\/(\d+)\/credential-profiles$/,
    )
    if (credentialCollectionMatch && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        label: string
        api_key: string
        is_active?: boolean
      }
      const provider = state.providers.find(
        (item) => item.id === Number(credentialCollectionMatch[1]),
      )
      if (!provider) return response({ error: { message: "Not found" } }, 404)
      const profile = {
        id: Math.max(0, ...provider.credential_profiles.map((item) => item.id)) + 1,
        label: payload.label,
        credential_status: "stored" as const,
        has_credential: true,
        is_active: payload.is_active ?? true,
      }
      provider.credential_profiles.push(profile)
      if (profile.is_active) {
        provider.credential_profiles.forEach((item) => {
          item.is_active = item.id === profile.id
        })
        provider.active_credential_profile_id = profile.id
        provider.active_credential_profile_name = profile.label
        provider.credential_status = "stored"
        provider.has_credential = true
      }
      return response(profile, 201)
    }
    const credentialMatch = url.match(
      /^\/api\/v1\/settings\/providers\/(\d+)\/credential-profiles\/(\d+)$/,
    )
    if (credentialMatch && method === "PATCH") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        label?: string
        api_key?: string
        is_active?: boolean
      }
      const provider = state.providers.find(
        (item) => item.id === Number(credentialMatch[1]),
      )
      const profile = provider?.credential_profiles.find(
        (item) => item.id === Number(credentialMatch[2]),
      )
      if (!provider || !profile) return response({ error: { message: "Not found" } }, 404)
      if (payload.label) profile.label = payload.label
      if (payload.api_key) {
        profile.credential_status = "stored"
        profile.has_credential = true
      }
      if (payload.is_active) {
        provider.credential_profiles.forEach((item) => {
          item.is_active = item.id === profile.id
        })
        provider.active_credential_profile_id = profile.id
        provider.active_credential_profile_name = profile.label
      }
      return response(profile)
    }
    if (credentialMatch && method === "DELETE") {
      const provider = state.providers.find(
        (item) => item.id === Number(credentialMatch[1]),
      )
      if (!provider) return response({ error: { message: "Not found" } }, 404)
      provider.credential_profiles = provider.credential_profiles.filter(
        (item) => item.id !== Number(credentialMatch[2]),
      )
      if (provider.active_credential_profile_id === Number(credentialMatch[2])) {
        const replacement = provider.credential_profiles[0] ?? null
        provider.active_credential_profile_id = replacement?.id ?? null
        provider.active_credential_profile_name = replacement?.label ?? null
        provider.credential_status = replacement ? "stored" : "missing"
        provider.has_credential = Boolean(replacement)
      }
      return response(undefined, 204)
    }
    const modelsMatch = url.match(/^\/api\/v1\/settings\/providers\/(\d+)\/models(?:\?.*)?$/)
    if (modelsMatch && method === "GET") {
      if (state.modelCatalogError) {
        return response(
          { error: state.modelCatalogError },
          state.modelCatalogError.code === "provider_authentication_error" ? 502 : 500,
        )
      }
      return response(state.modelCatalog)
    }
    const connectionMatch = url.match(
      /^\/api\/v1\/settings\/providers\/(\d+)\/test-connection$/,
    )
    if (connectionMatch && method === "POST") {
      if (state.connectionError) {
        return response({ error: state.connectionError }, 502)
      }
      const provider = state.providers.find(
        (item) => item.id === Number(connectionMatch[1]),
      )
      const result =
        state.connectionResult ??
        ({
          status: "connected",
          provider_id: Number(connectionMatch[1]),
          provider_name: provider?.name ?? "Provider",
          provider_type: provider?.provider_type ?? "openai",
          endpoint_url: "https://api.openai.com/v1/models",
          credential_profile_name: provider?.active_credential_profile_name ?? null,
          model_count: state.modelCatalog.models.length,
          checked_at: "2026-01-01T00:00:00Z",
        } satisfies ProviderConnectionResult)
      return response(result)
    }
    const providerMatch = url.match(/^\/api\/v1\/settings\/providers\/(\d+)$/)
    if (providerMatch && method === "PATCH") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as Partial<AIProvider> & {
        remove_credential?: boolean
      }
      const provider = state.providers.find((item) => item.id === Number(providerMatch[1]))
      if (!provider) return response({ error: { message: "Not found" } }, 404)
      const { remove_credential: removeCredential, ...providerChanges } = payload
      Object.assign(provider, providerChanges)
      if (removeCredential) {
        provider.has_credential = false
        provider.credential_status = "missing"
      }
      return response(provider)
    }
    if (providerMatch && method === "DELETE") {
      state.providers = state.providers.filter((item) => item.id !== Number(providerMatch[1]))
      return response(undefined, 204)
    }
    if (url === "/api/system/music-folder" && method === "GET") {
      return response(state.folder)
    }
    if (url === "/api/system/pick-directory" && method === "POST") {
      const selected = state.pickResult === "selected"
      if (selected) {
        state.folder = {
          selection_state: "selected",
          folder_token: "opaque-token",
          display_name: "Authorized Music",
          message: "Music folder selected.",
        }
      }
      return response({
        selection_state: selected ? "selected" : "cancelled",
        folder_token: selected ? state.folder.folder_token : null,
        display_name: selected ? state.folder.display_name : null,
        message: selected ? state.folder.message : "Folder selection was cancelled.",
      })
    }
    if (url === "/api/v1/jobs/demo" && method === "POST") {
      return response(state.job, 201)
    }
    if (url === "/api/v1/jobs/active" && method === "GET") {
      return response({ job: state.activeJob })
    }
    if (url === `/api/v1/jobs/${state.job.id}` && method === "GET") {
      return response({ ...state.job, status: state.jobStatus })
    }
    if (url === `/api/v1/jobs/${state.job.id}/cancel` && method === "POST") {
      if (state.cancelDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, state.cancelDelayMs))
      }
      state.jobStatus = "cancelled"
      return response({
        ...state.job,
        status: "cancelled",
        last_event_sequence: state.job.last_event_sequence + 1,
      })
    }
    return response({ error: { code: "not_found", message: `Unhandled test URL: ${url}` } }, 404)
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, state }
}
