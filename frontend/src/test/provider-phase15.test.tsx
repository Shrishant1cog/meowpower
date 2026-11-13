import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import App from "@/App"
import { createMockState, installApiMock, type MockApiState } from "@/test/api-mock"
import { installMockEventSource } from "@/test/mock-event-source"
import type { AIProvider } from "@/types/api"

function providerFixture(): AIProvider {
  return {
    id: 1,
    name: "Primary OpenAI",
    provider_type: "openai",
    model_identifier: "gpt-test",
    endpoint_url: null,
    is_active: true,
    credential_status: "stored",
    has_credential: true,
    active_credential_profile_id: 1,
    active_credential_profile_name: "Primary credential",
    credential_profiles: [
      {
        id: 1,
        label: "Primary credential",
        credential_status: "stored",
        has_credential: true,
        is_active: true,
      },
    ],
  }
}

function phase15State(): MockApiState {
  const state = createMockState()
  state.providers = [providerFixture()]
  return state
}

async function openModelsPage() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(
    await screen.findByRole("link", { name: /^AI Models/ }),
  )
  expect(await screen.findByRole("heading", { level: 2, name: "AI Models" })).toBeInTheDocument()
  return user
}

describe("Phase 1.5 provider discovery and credential profiles", () => {
  beforeEach(() => {
    installMockEventSource()
  })

  it("loads the genuine model catalog after selecting a saved provider", async () => {
    const state = phase15State()
    const { fetchMock } = installApiMock(state)
    const user = await openModelsPage()

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith("/api/v1/settings/providers/1/models?"),
        ),
      ).toBe(true)
    })
    expect(await screen.findByText(/2 models loaded · live/)).toBeInTheDocument()

    const combobox = await screen.findByRole("combobox", { name: "Selected model" })
    await user.clear(combobox)
    await user.type(combobox, "custom-model")
    const manualOption = await screen.findByRole("option", {
      name: /Use custom-model manually/i,
    })
    await user.click(manualOption)
    expect(combobox).toHaveValue("custom-model")
  })

  it("adds and switches named credential profiles without exposing secrets", async () => {
    const state = phase15State()
    const { fetchMock } = installApiMock(state)
    const user = await openModelsPage()

    const labelInput = await screen.findByLabelText("API key profile name")
    const keyInput = screen.getByLabelText("API key", { selector: "input" })
    await user.type(labelInput, "Secondary key")
    await user.type(keyInput, "secondary-secret")
    await user.click(screen.getByRole("button", { name: "Add API key" }))

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/v1/settings/providers/1/credential-profiles" &&
          init?.method === "POST",
      )
      expect(request).toBeDefined()
      expect(String(request?.[1]?.body)).toContain("secondary-secret")
      expect(String(request?.[1]?.body)).toContain("Secondary key")
    })
    expect(screen.queryByText("secondary-secret")).not.toBeInTheDocument()
    expect((await screen.findAllByText("Secondary key")).length).toBeGreaterThan(0)

    const useButton = await screen.findByRole("button", { name: "Use" })
    await user.click(useButton)

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/v1/settings/providers/1/credential-profiles/1" &&
          init?.method === "PATCH",
      )
      expect(request).toBeDefined()
      expect(String(request?.[1]?.body)).toContain('"is_active":true')
    })
  })

  it("supports explicit refresh and genuine connection testing", async () => {
    const state = phase15State()
    const { fetchMock } = installApiMock(state)
    const user = await openModelsPage()

    await user.click(await screen.findByRole("button", { name: "Refresh models" }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url]) =>
            String(url).startsWith("/api/v1/settings/providers/1/models?") &&
            new URLSearchParams(String(url).split("?")[1]).get("refresh") === "true",
        ),
      ).toBe(true)
    })

    await user.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/api/v1/settings/providers/1/test-connection" &&
          init?.method === "POST",
      )
      expect(request).toBeDefined()
    })
    expect(await screen.findByText("Connected · 2 models")).toBeInTheDocument()
  })

  it("shows sanitized discovery failures while manual model entry remains available", async () => {
    const state = phase15State()
    state.modelCatalogError = {
      code: "provider_authentication_error",
      message: "The provider rejected the selected credential.",
    }
    installApiMock(state)
    await openModelsPage()

    expect(
      await screen.findByText("The provider rejected the selected credential."),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Selected model" })).toBeEnabled()
  })

  it("explains an empty catalog and retains manual fallback", async () => {
    const state = phase15State()
    state.modelCatalog.models = []
    state.modelCatalog.selected_model_available = false
    installApiMock(state)
    await openModelsPage()

    expect(
      await screen.findByText("No models returned. Manual entry remains available."),
    ).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Selected model" })).toBeEnabled()
  })
})
