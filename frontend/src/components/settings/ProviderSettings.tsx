import { useEffect, useMemo, useState, type FormEvent } from "react"
import { MotionDiv } from "@/components/motion/primitives"
import {
  Activity,
  Check,
  CircleAlert,
  CloudCog,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react"

import { ModelCombobox } from "@/components/settings/ModelCombobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import {
  useProviders,
  type CredentialProfileInput,
  type ProviderInput,
} from "@/hooks/useProviders"
import { useProviderModels, useTestProviderConnection } from "@/hooks/useProviderModels"
import type { AIProvider, CredentialProfile, ProviderType } from "@/types/api"

const providerTypes: Array<{ value: ProviderType; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "google_gemini", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "nvidia_nim", label: "NVIDIA NIM" },
  { value: "openai_compatible", label: "OpenAI-compatible" },
  { value: "ollama", label: "Ollama" },
  { value: "local", label: "Other local provider" },
]

const providerLabels = Object.fromEntries(providerTypes.map((provider) => [provider.value, provider.label])) as Record<
  ProviderType,
  string
>

const endpointProviderTypes = new Set<ProviderType>([
  "openai_compatible",
  "ollama",
  "local",
])

function formatTimestamp(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message
  return fallback
}

interface ProviderSettingsProps {
  view?: "settings" | "models"
}

export function ProviderSettings({ view = "settings" }: ProviderSettingsProps) {
  const {
    data: providers = [],
    isLoading,
    isError,
    error: providersError,
    create,
    update,
    remove,
    createCredential,
    updateCredential,
    removeCredential,
  } = useProviders()
  const [showForm, setShowForm] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [providerType, setProviderType] = useState<ProviderType>("openai")
  const [endpointUrl, setEndpointUrl] = useState("")
  const [modelIdentifier, setModelIdentifier] = useState("")
  const [apiKeyProfileName, setApiKeyProfileName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedProviderId !== null && providers.some((provider) => provider.id === selectedProviderId)) {
      return
    }
    const preferred = providers.find((provider) => provider.is_active) ?? providers[0]
    setSelectedProviderId(preferred?.id ?? null)
  }, [providers, selectedProviderId])

  const activeProvider = providers.find((provider) => provider.is_active) ?? null
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? null

  const resetForm = () => {
    setName("")
    setProviderType("openai")
    setEndpointUrl("")
    setModelIdentifier("")
    setApiKeyProfileName("")
    setApiKey("")
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const input: ProviderInput = {
      name: name.trim(),
      provider_type: providerType,
      model_identifier: modelIdentifier.trim(),
    }
    if (endpointProviderTypes.has(providerType) && endpointUrl.trim()) {
      input.endpoint_url = endpointUrl.trim()
    }
    if (apiKey.trim()) {
      input.api_key = apiKey.trim()
      input.api_key_profile_name = apiKeyProfileName.trim() || "Primary credential"
    }
    try {
      const provider = await create.mutateAsync(input)
      setSelectedProviderId(provider.id)
      resetForm()
      setShowForm(false)
    } catch (reason) {
      setError(errorMessage(reason, "The provider could not be saved."))
    }
  }

  return (
    <div className="space-y-5">
      {view === "models" && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-accent/20">
          <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge>Phase 1.5</Badge>
                <Badge variant="outline">Automatic discovery</Badge>
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Active AI configuration</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Select a provider configuration and credential profile to load the genuine model catalog from its
                official model-list endpoint. Secrets remain in Windows Credential Manager.
              </p>
            </div>
            {activeProvider ? (
              <div className="grid min-w-64 gap-2 rounded-xl border border-border bg-background/80 p-4 text-sm shadow-sm">
                <div className="text-xs text-muted-foreground">Provider</div>
                <div className="font-semibold">{providerLabels[activeProvider.provider_type]}</div>
                <SeparatorLine />
                <div className="text-xs text-muted-foreground">Current model</div>
                <div className="truncate font-mono text-xs">{activeProvider.model_identifier}</div>
                <div className="text-xs text-muted-foreground">API key profile</div>
                <div className="truncate text-xs font-medium">
                  {activeProvider.active_credential_profile_name ?? "No active credential"}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No active provider configuration
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CloudCog className="size-4 text-primary" />
                AI provider configurations
              </CardTitle>
              <CardDescription className="mt-1">
                Configure an endpoint, switch named API key profiles, and assign a discovered model. Actual key
                material is stored only in the operating-system credential manager.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setShowForm((current) => !current)
                if (showForm) resetForm()
              }}
            >
              {showForm ? <X /> : <Plus />}
              {showForm ? "Close" : "Add provider"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
              <Label htmlFor="provider-selection" className="shrink-0 text-xs">
                Provider configuration
              </Label>
              <select
                id="provider-selection"
                value={selectedProviderId ?? ""}
                onChange={(event) => setSelectedProviderId(Number(event.target.value))}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {providerLabels[provider.provider_type]} — {provider.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">
                Selection loads its current model catalog automatically.
              </span>
            </div>
          )}

          {showForm && (
            <MotionDiv
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <form
                onSubmit={submit}
                className="space-y-4 rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider-name">Configuration name</Label>
                    <Input
                      id="provider-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="NVIDIA Personal"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-type">Provider type</Label>
                    <select
                      id="provider-type"
                      value={providerType}
                      onChange={(event) => {
                        setProviderType(event.target.value as ProviderType)
                        setEndpointUrl("")
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                    >
                      {providerTypes.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {endpointProviderTypes.has(providerType) && (
                  <div className="space-y-2">
                    <Label htmlFor="provider-endpoint">Endpoint URL</Label>
                    <Input
                      id="provider-endpoint"
                      value={endpointUrl}
                      onChange={(event) => setEndpointUrl(event.target.value)}
                      placeholder={
                        providerType === "ollama"
                          ? "http://127.0.0.1:11434"
                          : "https://models.example.com/v1"
                      }
                      inputMode="url"
                    />
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      Remote endpoints require HTTPS. HTTP is accepted for localhost only.
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider-key-profile">API key profile name</Label>
                    <Input
                      id="provider-key-profile"
                      value={apiKeyProfileName}
                      onChange={(event) => setApiKeyProfileName(event.target.value)}
                      placeholder="My NVIDIA Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-key">API key (optional for local providers)</Label>
                    <Input
                      id="provider-key"
                      type="password"
                      autoComplete="new-password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Stored securely, never displayed again"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-model">Model identifier</Label>
                  <Input
                    id="provider-model"
                    value={modelIdentifier}
                    onChange={(event) => setModelIdentifier(event.target.value)}
                    placeholder="Enter an exact model identifier"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Save the configuration first, then select it above to discover genuine models automatically.
                  </p>
                </div>

                {error && (
                  <p className="flex items-center gap-2 text-xs text-destructive" role="alert">
                    <CircleAlert className="size-3.5" />
                    {error}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? <Spinner /> : <Plus />}
                    Save configuration
                  </Button>
                </div>
              </form>
            </MotionDiv>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <Spinner />
              Loading provider configurations…
            </div>
          )}

          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              {errorMessage(providersError, "Provider configurations could not be loaded.")}
            </div>
          )}

          {!isLoading && !isError && providers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
              <KeyRound className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No AI providers configured</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a configuration when you are ready to use an authorized AI endpoint.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {providers.map((provider) => (
              <MotionDiv
                key={provider.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProviderCard
                  provider={provider}
                  selected={provider.id === selectedProviderId}
                  onSelect={() => setSelectedProviderId(provider.id)}
                  onUpdate={update.mutateAsync}
                  onDelete={remove.mutateAsync}
                  onCreateCredential={createCredential.mutateAsync}
                  onUpdateCredential={updateCredential.mutateAsync}
                  onDeleteCredential={removeCredential.mutateAsync}
                  updatePending={update.isPending}
                  removePending={remove.isPending}
                />
              </MotionDiv>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SeparatorLine() {
  return <div className="h-px bg-border" />
}

interface ProviderCardProps {
  provider: AIProvider
  selected: boolean
  onSelect: () => void
  onUpdate: (input: { id: number; input: Partial<ProviderInput> }) => Promise<AIProvider>
  onDelete: (id: number) => Promise<void>
  onCreateCredential: (input: {
    providerId: number
    input: CredentialProfileInput
  }) => Promise<CredentialProfile>
  onUpdateCredential: (input: {
    providerId: number
    profileId: number
    input: Partial<CredentialProfileInput>
  }) => Promise<CredentialProfile>
  onDeleteCredential: (input: {
    providerId: number
    profileId: number
  }) => Promise<void>
  updatePending: boolean
  removePending: boolean
}

function ProviderCard({
  provider,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onCreateCredential,
  onUpdateCredential,
  onDeleteCredential,
  updatePending,
  removePending,
}: ProviderCardProps) {
  const [expanded, setExpanded] = useState(selected)
  const [name, setName] = useState(provider.name)
  const [model, setModel] = useState(provider.model_identifier)
  const [endpoint, setEndpoint] = useState(provider.endpoint_url ?? "")
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(
    provider.active_credential_profile_id,
  )
  const [newProfileLabel, setNewProfileLabel] = useState("")
  const [newProfileKey, setNewProfileKey] = useState("")
  const [replaceProfileId, setReplaceProfileId] = useState<number | null>(null)
  const [replacementKey, setReplacementKey] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setExpanded(selected)
  }, [selected])

  useEffect(() => {
    setName(provider.name)
    setModel(provider.model_identifier)
    setEndpoint(provider.endpoint_url ?? "")
  }, [provider])

  useEffect(() => {
    setSelectedProfileId(provider.active_credential_profile_id)
  }, [provider.active_credential_profile_id])

  const models = useProviderModels(provider.id, selectedProfileId, selected)
  const connection = useTestProviderConnection()
  const catalog = models.data
  const activeProfile = provider.credential_profiles.find(
    (profile) => profile.id === selectedProfileId,
  )

  const save = async () => {
    setActionError(null)
    try {
      await onUpdate({
        id: provider.id,
        input: {
          name: name.trim(),
          model_identifier: model.trim(),
          endpoint_url: endpoint.trim() || null,
        },
      })
    } catch (reason) {
      setActionError(errorMessage(reason, "The provider configuration could not be saved."))
    }
  }

  const activateProfile = async (profile: CredentialProfile) => {
    setActionError(null)
    setSelectedProfileId(profile.id)
    try {
      await onUpdateCredential({
        providerId: provider.id,
        profileId: profile.id,
        input: { is_active: true },
      })
    } catch (reason) {
      setActionError(errorMessage(reason, "The credential profile could not be activated."))
    }
  }

  const addProfile = async (event: FormEvent) => {
    event.preventDefault()
    setActionError(null)
    try {
      const profile = await onCreateCredential({
        providerId: provider.id,
        input: {
          label: newProfileLabel.trim(),
          api_key: newProfileKey.trim(),
          is_active: true,
        },
      })
      setSelectedProfileId(profile.id)
      setNewProfileLabel("")
      setNewProfileKey("")
    } catch (reason) {
      setActionError(errorMessage(reason, "The API key profile could not be added."))
    }
  }

  const replaceProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (replaceProfileId === null) return
    setActionError(null)
    try {
      await onUpdateCredential({
        providerId: provider.id,
        profileId: replaceProfileId,
        input: { api_key: replacementKey.trim() },
      })
      setReplacementKey("")
      setReplaceProfileId(null)
    } catch (reason) {
      setActionError(errorMessage(reason, "The API key could not be replaced."))
    }
  }

  const removeProfile = async (profile: CredentialProfile) => {
    setActionError(null)
    try {
      await onDeleteCredential({ providerId: provider.id, profileId: profile.id })
    } catch (reason) {
      setActionError(errorMessage(reason, "The API key profile could not be removed."))
    }
  }

  const testConnection = async () => {
    setActionError(null)
    try {
      await connection.mutateAsync({
        providerId: provider.id,
        credentialProfileId: selectedProfileId,
      })
    } catch (reason) {
      setActionError(errorMessage(reason, "The provider connection test failed."))
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] ${
        selected ? "border-primary/40 shadow-[0_12px_34px_rgba(0,0,0,0.07)]" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{provider.name}</span>
            {provider.is_active && <Badge>Active provider</Badge>}
            <Badge variant="outline">{providerLabels[provider.provider_type]}</Badge>
            {selected && <Badge variant="outline">Selected</Badge>}
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <span className="text-[10px] uppercase tracking-wide">Current model</span>
              <div className="mt-0.5 truncate font-mono text-foreground">{provider.model_identifier}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide">API key profile</span>
              <div className="mt-0.5 truncate text-foreground">
                {provider.active_credential_profile_name ?? "No credential"}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide">Credential status</span>
              <div className="mt-0.5 flex items-center gap-1.5 capitalize text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                {provider.credential_status}
              </div>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {!provider.is_active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onUpdate({ id: provider.id, input: { is_active: true } })}
              disabled={updatePending}
            >
              <Check />
              Activate
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect()
              setExpanded(true)
            }}
            aria-expanded={expanded}
          >
            <Pencil />
            Configure models
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => void onDelete(provider.id)}
            disabled={removePending}
            aria-label={`Remove ${provider.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {expanded && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden border-t border-border"
        >
            <div className="space-y-5 bg-muted/20 p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`name-${provider.id}`}>Configuration name</Label>
                  <Input
                    id={`name-${provider.id}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`endpoint-${provider.id}`}>Endpoint URL</Label>
                  <Input
                    id={`endpoint-${provider.id}`}
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder={
                      provider.provider_type === "ollama"
                        ? "http://127.0.0.1:11434"
                        : "Official provider endpoint"
                    }
                    disabled={!endpointProviderTypes.has(provider.provider_type)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <KeyRound className="size-4 text-primary" />
                      API key profiles
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Switch named credentials without exposing or copying their secrets.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {provider.credential_profiles.length} saved
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  {provider.credential_profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span className="truncate">{profile.label}</span>
                          {profile.is_active && <Badge>Active</Badge>}
                        </div>
                        <div className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                          {profile.credential_status}
                          {profile.credential_status === "stored" ? " · masked" : ""}
                        </div>
                      </div>
                      {!profile.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void activateProfile(profile)}
                        >
                          Use
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReplaceProfileId(profile.id)
                          setReplacementKey("")
                        }}
                      >
                        Replace key
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void removeProfile(profile)}
                        aria-label={`Remove credential profile ${profile.label}`}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </div>
                  ))}
                  {provider.credential_profiles.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No API key profiles saved. Local providers may work without one.
                    </p>
                  )}
                </div>

                {replaceProfileId !== null && (
                  <form onSubmit={replaceProfile} className="mt-3 flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`replace-key-${provider.id}`}>Replacement API key</Label>
                      <Input
                        id={`replace-key-${provider.id}`}
                        type="password"
                        autoComplete="new-password"
                        value={replacementKey}
                        onChange={(event) => setReplacementKey(event.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" size="sm">
                      <Save />
                      Save replacement
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReplaceProfileId(null)}>
                      Cancel
                    </Button>
                  </form>
                )}

                <form onSubmit={addProfile} className="mt-3 grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`new-profile-label-${provider.id}`}>API key profile name</Label>
                    <Input
                      id={`new-profile-label-${provider.id}`}
                      value={newProfileLabel}
                      onChange={(event) => setNewProfileLabel(event.target.value)}
                      placeholder="Personal key"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`new-profile-key-${provider.id}`}>API key</Label>
                    <Input
                      id={`new-profile-key-${provider.id}`}
                      type="password"
                      autoComplete="new-password"
                      value={newProfileKey}
                      onChange={(event) => setNewProfileKey(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" size="sm">
                    <Plus />
                    Add API key
                  </Button>
                </form>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Zap className="size-4 text-primary" />
                      Model catalog
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {providerLabels[provider.provider_type]} · {activeProfile?.label ?? "No credential profile"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void models.refresh.mutateAsync()}
                      disabled={models.refresh.isPending || models.isFetching}
                    >
                      {models.refresh.isPending ? <Spinner /> : <RefreshCw />}
                      Refresh models
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void testConnection()}
                      disabled={connection.isPending}
                    >
                      {connection.isPending ? <Spinner /> : <Activity />}
                      Test connection
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-2">
                    <Label htmlFor={`model-${provider.id}`}>Selected model</Label>
                    <ModelCombobox
                      id={`model-${provider.id}`}
                      value={model}
                      onChange={setModel}
                      models={catalog?.models ?? []}
                      loading={models.isLoading || models.isFetching}
                      describedBy={`model-status-${provider.id}`}
                    />
                    <div id={`model-status-${provider.id}`} className="min-h-5 text-xs">
                      {models.isError ? (
                        <p className="flex items-center gap-1.5 text-destructive" role="alert">
                          <CircleAlert className="size-3.5" />
                          {errorMessage(models.error, "The model catalog could not be loaded.")}
                        </p>
                      ) : models.refresh.isError ? (
                        <p className="flex items-center gap-1.5 text-destructive" role="alert">
                          <CircleAlert className="size-3.5" />
                          Refresh failed. The previous catalog remains available.
                        </p>
                      ) : catalog ? (
                        <p className="text-muted-foreground">
                          {catalog.models.length === 0
                            ? "No models returned. Manual entry remains available."
                            : `${catalog.models.length} models loaded · ${catalog.source === "cache" ? "cached" : "live"} · ${formatTimestamp(catalog.fetched_at)}`}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Loading the current catalog…</p>
                      )}
                    </div>
                    {catalog && !catalog.selected_model_available && catalog.models.length > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        The current model is not present in the latest catalog. It remains selected for manual fallback.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Provider</div>
                      <div className="mt-1 font-medium">{providerLabels[provider.provider_type]}</div>
                    </div>
                    <SeparatorLine />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Selected model</div>
                      <div className="mt-1 break-all font-mono">{model || "Not selected"}</div>
                    </div>
                    <SeparatorLine />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Credential profile</div>
                      <div className="mt-1 font-medium">{activeProfile?.label ?? "None"}</div>
                    </div>
                    <SeparatorLine />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Connection</div>
                      <div className="mt-1 font-medium">
                        {connection.isPending
                          ? "Testing…"
                          : connection.data
                            ? `Connected · ${connection.data.model_count} models`
                            : "Not tested"}
                      </div>
                      {connection.data && (
                        <div className="mt-0.5 text-muted-foreground">
                          {formatTimestamp(connection.data.checked_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {actionError && (
                <p className="flex items-center gap-2 text-xs text-destructive" role="alert">
                  <CircleAlert className="size-3.5" />
                  {actionError}
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={updatePending}>
                  {updatePending ? <Spinner /> : <Save />}
                  Save configuration
                </Button>
              </div>
            </div>
        </MotionDiv>
      )}
    </div>
  )
}
