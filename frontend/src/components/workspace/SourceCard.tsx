import { useRef } from "react"
import { Clipboard, FileVideo2, Link2, Upload, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useUiStore } from "@/stores/ui"

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SourceCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const youtubeUrl = useUiStore((state) => state.youtubeUrl)
  const localFileName = useUiStore((state) => state.localFileName)
  const localFileSize = useUiStore((state) => state.localFileSize)
  const setYoutubeUrl = useUiStore((state) => state.setYoutubeUrl)
  const setLocalFile = useUiStore((state) => state.setLocalFile)
  const clearSource = useUiStore((state) => state.clearSource)
  const looksLikeYouTube = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/i.test(
    youtubeUrl.trim(),
  )

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setYoutubeUrl(text.trim())
    } catch {
      document.getElementById("meowpower-youtube-url")?.focus()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" />
              Source material
            </CardTitle>
            <CardDescription className="mt-1">
              Add an authorized YouTube link or select a local video. Processing begins in later phases.
            </CardDescription>
          </div>
          <Badge variant="outline">Phase 1 input</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="meowpower-youtube-url" className="text-xs font-medium">
            YouTube URL
          </label>
          <div className="flex gap-2">
            <Input
              id="meowpower-youtube-url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              inputMode="url"
              aria-invalid={youtubeUrl.length > 0 && !looksLikeYouTube}
            />
            <Button variant="outline" size="icon" onClick={() => void paste()} aria-label="Paste URL">
              <Clipboard />
            </Button>
          </div>
          {youtubeUrl.length > 0 && !looksLikeYouTube && (
            <p className="text-xs text-destructive">Enter a valid YouTube watch or Shorts URL.</p>
          )}
        </div>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="bg-card px-2">or</span>
          </div>
        </div>

        <div>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="sr-only"
            aria-label="Select local video"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setLocalFile(file ? { name: file.name, size: file.size } : null)
            }}
          />
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            Select local video
          </Button>
        </div>

        {(youtubeUrl || localFileName) && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {localFileName ? <FileVideo2 className="size-4 shrink-0" /> : <Link2 className="size-4 shrink-0" />}
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">
                    {localFileName ?? youtubeUrl}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {localFileName
                      ? `${formatFileSize(localFileSize ?? 0)} · selected locally`
                      : looksLikeYouTube
                        ? "YouTube link ready for metadata retrieval"
                        : "Input needs attention"}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={clearSource} aria-label="Clear source">
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
