from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import Protocol


class DirectoryPickerError(RuntimeError):
    """Base class for classified native picker failures."""


class DirectoryPickerBusyError(DirectoryPickerError):
    """Raised when a native picker is already open."""


class NativeDialogUnavailableError(DirectoryPickerError):
    """Raised when Tkinter or a graphical desktop is unavailable."""


class InvalidDirectoryError(DirectoryPickerError):
    """Raised when the native selection is missing or inaccessible."""


class DirectoryPicker(Protocol):
    async def pick_directory(self) -> Path | None: ...


class NativeDirectoryPicker:
    """Runs tkinter on one dedicated GUI thread, outside the asyncio event loop."""

    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="meowpower-dialog")
        self._lock = Lock()
        self._dialog_open = False

    async def pick_directory(self) -> Path | None:
        with self._lock:
            if self._dialog_open:
                raise DirectoryPickerBusyError("A directory selection dialog is already open")
            self._dialog_open = True
        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(self._executor, self._pick_directory_blocking)
        finally:
            with self._lock:
                self._dialog_open = False

    @staticmethod
    def _pick_directory_blocking() -> Path | None:
        try:
            import tkinter
            from tkinter import filedialog
        except ImportError as exc:
            raise NativeDialogUnavailableError("Tkinter is not installed") from exc

        root = None
        try:
            try:
                root = tkinter.Tk()
                root.withdraw()
                root.attributes("-topmost", True)
                selected = filedialog.askdirectory(
                    parent=root,
                    title="Select an authorized music folder",
                    mustexist=True,
                )
            except tkinter.TclError as exc:
                raise NativeDialogUnavailableError("No graphical desktop is available") from exc
            if not selected:
                return None
            try:
                return Path(selected).expanduser().resolve(strict=True)
            except (OSError, RuntimeError) as exc:
                raise InvalidDirectoryError("The selected directory is not accessible") from exc
        finally:
            if root is not None:
                try:
                    root.destroy()
                except Exception:
                    pass

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
