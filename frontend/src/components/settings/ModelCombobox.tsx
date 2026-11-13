import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Search, TerminalSquare } from "lucide-react"
import { MotionDiv } from "@/components/motion/primitives"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface ModelComboboxProps {
  id: string
  value: string
  onChange: (value: string) => void
  models: string[]
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  describedBy?: string
}

export function ModelCombobox({
  id,
  value,
  onChange,
  models,
  loading = false,
  disabled = false,
  placeholder = "Search or enter a model identifier",
  describedBy,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const normalizedDraft = draft.trim()
  const exactMatch = models.some(
    (model) => model.toLowerCase() === normalizedDraft.toLowerCase(),
  )
  const filteredModels = useMemo(() => {
    const query = normalizedDraft.toLowerCase()
    const filtered = query
      ? models.filter((model) => model.toLowerCase().includes(query))
      : models
    return filtered.slice(0, 100)
  }, [models, normalizedDraft])
  const manualOption = normalizedDraft && !exactMatch ? normalizedDraft : null
  const optionCount = filteredModels.length + (manualOption ? 1 : 0)
  const listboxId = `${id}-listbox`

  const selectModel = (model: string) => {
    setDraft(model)
    onChange(model)
    setOpen(false)
    setActiveIndex(0)
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && optionCount > 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-busy={loading}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          value={draft}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
              setOpen(false)
            }
          }}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            onChange(next)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.min(index + 1, Math.max(0, optionCount - 1)))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((index) => Math.max(0, index - 1))
            } else if (event.key === "Enter" && open && optionCount > 0) {
              event.preventDefault()
              const selected =
                activeIndex < filteredModels.length
                  ? filteredModels[activeIndex]
                  : manualOption ?? filteredModels[0]
              if (selected) selectModel(selected)
            } else if (event.key === "Escape") {
              setDraft(value)
              setOpen(false)
            }
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={placeholder}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Spinner />
          Loading genuine models from the provider…
        </div>
      )}

      {open && !disabled && (
        <MotionDiv
          id={listboxId}
          role="listbox"
          aria-label="Available models"
          initial={{ opacity: 0, y: -4, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          {optionCount === 0 ? (
            <div className="px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
              No discovered models are available. Type an identifier to use manual fallback.
            </div>
          ) : (
            filteredModels.map((model, index) => (
              <button
                key={model}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={value === model}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectModel(model)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                  activeIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <Check className={cn("size-3.5", value === model ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate font-mono">{model}</span>
              </button>
            ))
          )}
          {manualOption && (
            <button
              id={`${id}-option-${filteredModels.length}`}
              type="button"
              role="option"
              aria-selected={value === manualOption}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectModel(manualOption)}
              onMouseEnter={() => setActiveIndex(filteredModels.length)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                activeIndex === filteredModels.length
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted",
              )}
            >
              <TerminalSquare className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">
                Use <span className="font-mono">{manualOption}</span> manually
              </span>
            </button>
          )}
        </MotionDiv>
      )}

      <p className="sr-only" aria-live="polite">
        {optionCount} model{optionCount === 1 ? "" : "s"} available.
      </p>
    </div>
  )
}
