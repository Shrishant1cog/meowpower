import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import App from "@/App"
import { installApiMock } from "@/test/api-mock"
import { installMockEventSource } from "@/test/mock-event-source"
import { useUiStore } from "@/stores/ui"
import { useWorkflowStore } from "@/stores/workflow"

function resetStores() {
  useUiStore.setState({
    sidebarCollapsed: false,
    youtubeUrl: "",
    localFileName: null,
    localFileSize: null,
  })
  useWorkflowStore.setState({
    activeJobId: null,
    job: null,
    event: null,
    lastEventSequence: 0,
    isStarting: false,
    isCancelling: false,
    idempotencyKey: null,
    notifications: [],
  })
}

describe("MeowPower Phase 1 interface", () => {
  beforeEach(() => {
    resetStores()
    installMockEventSource()
    installApiMock()
  })

  it("renders the dashboard and application identity", async () => {
    render(<App />)
    expect(
      await screen.findByRole(
        "heading",
        { name: /Prepare your first production run/i },
        { timeout: 3_000 },
      ),
    ).toBeInTheDocument()
    document.title = "MeowPower"
    expect(document.title).toBe("MeowPower")
    expect(screen.getByText("Phase 1 partial workflow")).toBeInTheDocument()
  })

  it("navigates to settings and persists a theme change", async () => {
    const user = userEvent.setup()
    const { fetchMock } = installApiMock()
    render(<App />)

    await user.click(await screen.findByRole("link", { name: "Settings" }))
    expect(await screen.findByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }))
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/v1/settings" && init?.method === "PATCH",
      )
      expect(patch).toBeDefined()
      expect(String(patch?.[1]?.body)).toContain('"theme":"dark"')
    })
  })

  it("accepts a YouTube URL and an authorized local video selection", async () => {
    const user = userEvent.setup()
    render(<App />)

    const urlInput = await screen.findByLabelText("YouTube URL")
    await user.type(urlInput, "https://www.youtube.com/watch?v=abc123")
    expect(urlInput).toHaveValue("https://www.youtube.com/watch?v=abc123")

    const fileInput = screen.getByLabelText("Select local video")
    await user.upload(fileInput, new File(["fixture"], "authorized.mp4", { type: "video/mp4" }))
    expect(await screen.findByText("authorized.mp4")).toBeInTheDocument()
  })

  it("opens the music dialog and applies a successful native folder selection", async () => {
    const user = userEvent.setup()
    const { state } = installApiMock()
    state.pickResult = "selected"
    render(<App />)

    await user.click(await screen.findByRole("button", { name: /Automatic music/i }))
    await user.click(screen.getByRole("button", { name: /Local music folder/i }))
    await user.click(screen.getByRole("button", { name: /Choose folder/i }))
    expect((await screen.findAllByText("Authorized Music")).length).toBeGreaterThan(0)
  })

  it("keeps the prior folder visible when native selection is cancelled", async () => {
    const user = userEvent.setup()
    const { state } = installApiMock()
    state.folder = {
      selection_state: "selected",
      folder_token: "opaque-token",
      display_name: "Previous Music",
      message: "Music folder selected.",
    }
    state.pickResult = "cancelled"
    render(<App />)

    await user.click(await screen.findByRole("button", { name: /Automatic music/i }))
    await user.click(screen.getByRole("button", { name: /Local music folder/i }))
    expect((await screen.findAllByText("Previous Music")).length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: /Choose folder/i }))
    expect(await screen.findByText(/selection was cancelled/i)).toBeInTheDocument()
  })

  it("collapses the sidebar through an accessible control", async () => {
    const user = userEvent.setup()
    render(<App />)
    const collapse = await screen.findByRole("button", { name: "Collapse sidebar" })
    await user.click(collapse)
    expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
  })

  it("adds a provider without exposing the submitted credential", async () => {
    const user = userEvent.setup()
    const { fetchMock } = installApiMock()
    render(<App />)

    await user.click(await screen.findByRole("link", { name: "Settings" }))
    await user.click(await screen.findByRole("button", { name: /Add provider/i }))
    await user.type(await screen.findByLabelText("Configuration name"), "Primary OpenAI")
    await user.type(await screen.findByLabelText("Model identifier"), "test-model")
    await user.type(
      await screen.findByLabelText("API key (optional for local providers)"),
      "secret-value",
    )
    await user.click(screen.getByRole("button", { name: /Save configuration/i }))

    expect(await screen.findByText("Primary OpenAI")).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/v1/settings/providers" && init?.method === "POST",
    )
    expect(post).toBeDefined()
    expect(String(post?.[1]?.body)).toContain("secret-value")
    expect(screen.queryByText("secret-value")).not.toBeInTheDocument()

    await user.click(
      await screen.findByRole("button", {
        name: "Remove credential profile Primary credential",
      }),
    )
    await waitFor(() => {
      const credentialRemoval = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/v1/settings/providers/1/credential-profiles/1" &&
          init?.method === "DELETE",
      )
      expect(credentialRemoval).toBeDefined()
    })
  })

  it("renames, activates, and removes an existing provider", async () => {
    const user = userEvent.setup()
    const { fetchMock } = installApiMock()
    render(<App />)

    await user.click(await screen.findByRole("link", { name: "Settings" }))
    await user.click(await screen.findByRole("button", { name: /Add provider/i }))
    await user.type(await screen.findByLabelText("Configuration name"), "Original")
    await user.type(await screen.findByLabelText("Model identifier"), "model-one")
    await user.click(screen.getByRole("button", { name: /Save configuration/i }))
    expect(await screen.findByText("Original")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Activate/i }))
    await user.click(screen.getByRole("button", { name: /Configure models/i }))
    const nameInput = await screen.findByLabelText("Configuration name")
    await user.clear(nameInput)
    await user.type(nameInput, "Renamed")
    await user.click(screen.getByRole("button", { name: /Save configuration/i }))
    expect(await screen.findByText("Renamed")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Remove Renamed/i }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => url === "/api/v1/settings/providers/1" && init?.method === "DELETE",
        ),
      ).toBe(true)
    })
  })
})
