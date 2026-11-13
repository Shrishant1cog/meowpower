from __future__ import annotations

import asyncio
import sys
import threading
import types
from pathlib import Path

import pytest

from app.integrations.directory_picker import (
    DirectoryPickerBusyError,
    InvalidDirectoryError,
    NativeDialogUnavailableError,
    NativeDirectoryPicker,
)


@pytest.mark.asyncio
async def test_native_picker_runs_on_dedicated_non_event_loop_thread(monkeypatch):
    event_loop_thread = threading.get_ident()
    dialog_thread: int | None = None

    def blocking_picker() -> Path | None:
        nonlocal dialog_thread
        dialog_thread = threading.get_ident()
        return None

    monkeypatch.setattr(
        NativeDirectoryPicker,
        "_pick_directory_blocking",
        staticmethod(blocking_picker),
    )
    picker = NativeDirectoryPicker()
    try:
        assert await picker.pick_directory() is None
    finally:
        picker.close()

    assert dialog_thread is not None
    assert dialog_thread != event_loop_thread


@pytest.mark.asyncio
async def test_native_picker_rejects_competing_dialog_without_blocking_event_loop(monkeypatch):
    release = threading.Event()
    started = threading.Event()

    def blocking_picker() -> Path | None:
        started.set()
        release.wait(timeout=2)
        return None

    monkeypatch.setattr(
        NativeDirectoryPicker,
        "_pick_directory_blocking",
        staticmethod(blocking_picker),
    )
    picker = NativeDirectoryPicker()
    first = asyncio.create_task(picker.pick_directory())
    try:
        assert await asyncio.to_thread(started.wait, 1)
        ticker_ran = False

        async def ticker() -> None:
            nonlocal ticker_ran
            await asyncio.sleep(0.01)
            ticker_ran = True

        await ticker()
        assert ticker_ran is True
        with pytest.raises(DirectoryPickerBusyError):
            await picker.pick_directory()
    finally:
        release.set()
        assert await first is None
        picker.close()


def _install_fake_tkinter(monkeypatch, selected: str) -> list[object]:
    created_roots: list[object] = []

    class FakeRoot:
        def withdraw(self) -> None:
            return None

        def attributes(self, *_args: object) -> None:
            return None

        def destroy(self) -> None:
            self.destroyed = True

    class FakeTk(FakeRoot):
        def __init__(self) -> None:
            self.destroyed = False
            created_roots.append(self)

    filedialog = types.ModuleType("tkinter.filedialog")
    filedialog.askdirectory = lambda **_kwargs: selected  # type: ignore[attr-defined]
    tkinter = types.ModuleType("tkinter")
    tkinter.Tk = FakeTk  # type: ignore[attr-defined]
    tkinter.TclError = RuntimeError  # type: ignore[attr-defined]
    tkinter.filedialog = filedialog  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "tkinter", tkinter)
    monkeypatch.setitem(sys.modules, "tkinter.filedialog", filedialog)
    return created_roots


def test_native_picker_canonicalizes_selection_and_destroys_tk_root(
    monkeypatch,
    tmp_path,
):
    selected = tmp_path / "Authorized" / ".."
    selected = selected / "Authorized"
    selected.mkdir(parents=True)
    roots = _install_fake_tkinter(monkeypatch, str(selected))

    result = NativeDirectoryPicker._pick_directory_blocking()
    assert result == selected.resolve()
    assert len(roots) == 1
    assert roots[0].destroyed is True


def test_native_picker_cancellation_returns_none(monkeypatch):
    roots = _install_fake_tkinter(monkeypatch, "")
    assert NativeDirectoryPicker._pick_directory_blocking() is None
    assert roots[0].destroyed is True


def test_native_picker_rejects_nonexistent_selection(monkeypatch, tmp_path):
    _install_fake_tkinter(monkeypatch, str(tmp_path / "does-not-exist"))
    with pytest.raises(InvalidDirectoryError):
        NativeDirectoryPicker._pick_directory_blocking()


def test_native_picker_handles_missing_tkinter(monkeypatch):
    monkeypatch.setitem(sys.modules, "tkinter", None)
    with pytest.raises(NativeDialogUnavailableError):
        NativeDirectoryPicker._pick_directory_blocking()


def test_native_picker_handles_headless_tcl_error(monkeypatch):
    tkinter = pytest.importorskip("tkinter")

    def headless_root():
        raise tkinter.TclError("no display name and no $DISPLAY environment variable")

    monkeypatch.setattr(tkinter, "Tk", headless_root)
    with pytest.raises(NativeDialogUnavailableError):
        NativeDirectoryPicker._pick_directory_blocking()


@pytest.mark.asyncio
async def test_folder_api_rejects_invalid_directory_without_leaking_path(
    client,
    directory_picker,
    tmp_path,
):
    missing = tmp_path / "private" / "missing-folder"
    directory_picker.result = missing
    response = await client.post("/api/system/pick-directory")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_directory"
    assert str(missing) not in response.text


@pytest.mark.asyncio
async def test_folder_api_can_select_after_settings_row_already_exists(
    client,
    directory_picker,
    tmp_path,
):
    settings = await client.get("/api/v1/settings")
    assert settings.status_code == 200

    selected = tmp_path / "Existing Settings Music"
    selected.mkdir()
    directory_picker.result = selected

    response = await client.post("/api/system/pick-directory")
    assert response.status_code == 200
    assert response.json()["selection_state"] == "selected"
    assert response.json()["display_name"] == "Existing Settings Music"

    summary = await client.get("/api/system/music-folder")
    assert summary.status_code == 200
    assert summary.json()["folder_token"] == response.json()["folder_token"]
    assert summary.json()["display_name"] == "Existing Settings Music"


@pytest.mark.asyncio
async def test_folder_api_preserves_previous_selection_after_cancel_or_invalid_path(
    client,
    directory_picker,
    tmp_path,
):
    selected = tmp_path / "Authorized Music"
    selected.mkdir()
    directory_picker.result = selected
    created = await client.post("/api/system/pick-directory")
    assert created.status_code == 200
    original_token = created.json()["folder_token"]

    directory_picker.result = None
    cancelled = await client.post("/api/system/pick-directory")
    assert cancelled.status_code == 200
    assert cancelled.json()["selection_state"] == "cancelled"

    directory_picker.result = tmp_path / "missing"
    invalid = await client.post("/api/system/pick-directory")
    assert invalid.status_code == 400

    summary = await client.get("/api/system/music-folder")
    assert summary.json()["folder_token"] == original_token
    assert summary.json()["display_name"] == "Authorized Music"
