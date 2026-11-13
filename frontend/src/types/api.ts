export type Theme = "light" | "dark" | "system"

export interface FolderSummary {
  selection_state: "selected" | "cancelled" | "none"
  folder_token: string | null
  display_name: string | null
  message: string | null
}

export interface AppSettings {
  theme: Theme
  music_folder: FolderSummary
  version: string
}

export type ProviderType =
  | "openai"
  | "google_gemini"
  | "anthropic"
  | "nvidia_nim"
  | "openai_compatible"
  | "ollama"
  | "local"

export type CredentialStatus = "missing" | "stored" | "unavailable"

export interface CredentialProfile {
  id: number
  label: string
  credential_status: CredentialStatus
  has_credential: boolean
  is_active: boolean
}

export interface AIProvider {
  id: number
  name: string
  provider_type: ProviderType
  model_identifier: string
  endpoint_url: string | null
  is_active: boolean
  credential_status: CredentialStatus
  has_credential: boolean
  active_credential_profile_id: number | null
  active_credential_profile_name: string | null
  credential_profiles: CredentialProfile[]
}

export interface ModelCatalog {
  provider_id: number
  provider_name: string
  provider_type: ProviderType
  endpoint_url: string
  models: string[]
  fetched_at: string
  cache_ttl_seconds: number
  source: "cache" | "provider"
  selected_model: string
  selected_model_available: boolean
}

export interface ProviderConnectionResult {
  status: "connected"
  provider_id: number
  provider_name: string
  provider_type: ProviderType
  endpoint_url: string
  credential_profile_name: string | null
  model_count: number
  checked_at: string
}

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "recoverable"

export interface Job {
  id: string
  job_type: string
  status: JobStatus
  stage: string
  stage_label: string
  operation: string
  progress_percent: number
  elapsed_seconds: number
  eta_remaining_seconds: number | null
  message: string
  error_message: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  last_event_sequence: number
}

export interface JobEventPayload {
  job_id: string
  status: JobStatus
  stage: string
  stage_label: string
  progress_percent: number
  elapsed_seconds: number
  eta_remaining_seconds: number | null
  message: string
  updated_at: string
  operation: string | null
  error_message: string | null
  sequence: number
}

export interface ActiveJobResponse {
  job: Job | null
}

export interface DirectoryPickResponse {
  selection_state: "selected" | "cancelled"
  folder_token: string | null
  display_name: string | null
  message: string
}

export interface HealthResponse {
  status: string
  app: string
  version: string
  phase: number
  database: string
}
