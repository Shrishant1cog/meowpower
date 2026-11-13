import { ProviderSettings } from "@/components/settings/ProviderSettings"

export function ModelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-primary/25 bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
            Phase 1.5
          </span>
          <span className="text-xs text-muted-foreground">Provider model discovery</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">AI Models</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Discover the models genuinely available from authorized providers, switch named credential profiles, and
          keep the active model configuration explicit. Model execution and production AI stages remain outside this
          enhancement.
        </p>
      </div>
      <ProviderSettings view="models" />
    </div>
  )
}
