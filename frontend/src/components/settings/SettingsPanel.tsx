import { Database, HardDrive, Moon, Sun } from "lucide-react"

import { ProviderSettings } from "@/components/settings/ProviderSettings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useSettings } from "@/hooks/useSettings"
import type { Theme } from "@/types/api"

export function SettingsPanel() {
  const { data: settings, setTheme, isUpdating } = useSettings()

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <ProviderSettings />
      </div>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme preference is persisted in the local SQLite database.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as Theme[]).map((theme) => (
                <Button
                  key={theme}
                  variant={settings?.theme === theme ? "default" : "outline"}
                  size="sm"
                  onClick={() => void setTheme(theme)}
                  disabled={isUpdating}
                  className="capitalize"
                >
                  {theme === "light" && <Sun />}
                  {theme === "dark" && <Moon />}
                  {theme}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local storage</CardTitle>
            <CardDescription>Phase 1 keeps application data inside the project directory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <Database className="size-4 text-primary" />
              <div>
                <div className="text-xs font-medium">SQLite database</div>
                <div className="text-[11px] text-muted-foreground">storage/database/meowpower.db</div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <HardDrive className="size-4 text-primary" />
              <div>
                <div className="text-xs font-medium">Local-first policy</div>
                <div className="text-[11px] text-muted-foreground">No telemetry or automatic cloud upload</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
