import { useState } from "react"
import { FolderOpen, Music2, Sparkles, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useMusicFolder } from "@/hooks/useMusicFolder"
import { useWorkflowStore } from "@/stores/workflow"

export function MusicSelection() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"automatic" | "local">("automatic")
  const { data: folder, pick, clear, isPicking } = useMusicFolder()

  const handlePick = async () => {
    try {
      const result = await pick.mutateAsync()
      if (result.selection_state === "selected") {
        setMode("local")
      } else {
        useWorkflowStore.getState().addNotification({
          tone: "info",
          title: "Folder selection cancelled",
          message: result.message,
        })
      }
    } catch (error) {
      useWorkflowStore.getState().addNotification({
        tone: "error",
        title: "Folder picker unavailable",
        message: error instanceof Error ? error.message : "The native folder picker failed.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Music2 />
          <span className="truncate">
            {mode === "automatic" ? "Automatic music" : folder?.display_name ?? "Select local folder"}
          </span>
          <Badge variant="outline" className="ml-auto">Phase 1 setup</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Background music</DialogTitle>
          <DialogDescription>
            Choose an automatic recommendation strategy for future processing, or point MeowPower at a
            local folder that you are authorized to use. Track scanning and mixing arrive in Phase 11.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("automatic")}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">Automatic recommendation</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                Future phase: match authorized tracks to mood, tempo, energy, and speech intensity.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("local")}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary">
              <FolderOpen className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Local music folder</span>
              <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                {folder?.selection_state === "selected"
                  ? `Selected: ${folder.display_name}`
                  : "No folder selected"}
              </span>
            </span>
          </button>
        </div>

        {mode === "local" && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <Label>Authorized local source</Label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0 text-xs text-muted-foreground">
                {folder?.selection_state === "selected"
                  ? folder.display_name
                  : "The native picker keeps the absolute path private to the backend."}
              </div>
              <Button size="sm" onClick={() => void handlePick()} disabled={isPicking}>
                {isPicking ? <Spinner /> : <FolderOpen />}
                Choose folder
              </Button>
            </div>
            {folder?.selection_state === "selected" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-destructive hover:text-destructive"
                onClick={() => void clear.mutateAsync()}
              >
                <Trash2 />
                Clear selection
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
