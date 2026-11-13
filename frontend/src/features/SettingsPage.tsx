import { SettingsPanel } from "@/components/settings/SettingsPanel"

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage local appearance, secure AI credentials, and provider model assignments.
        </p>
      </div>
      <SettingsPanel />
    </div>
  )
}
