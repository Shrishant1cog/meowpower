from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.settings import FolderSummary
from app.schemas.system import DirectoryPickResponse
from app.services.folder_service import FolderService

router = APIRouter(tags=["system"])


@router.post("/system/pick-directory", response_model=DirectoryPickResponse)
async def pick_directory(request: Request) -> DirectoryPickResponse:
    async with request.app.state.session_factory() as session:
        service = FolderService(session, request.app.state.directory_picker)
        response = await service.pick_directory()
        await session.commit()
        return response


@router.get("/system/music-folder", response_model=FolderSummary)
async def get_music_folder(request: Request) -> FolderSummary:
    async with request.app.state.session_factory() as session:
        response = await FolderService(
            session, request.app.state.directory_picker
        ).get_summary()
        await session.commit()
        return response


@router.delete("/system/music-folder", response_model=FolderSummary)
async def clear_music_folder(request: Request) -> FolderSummary:
    async with request.app.state.session_factory() as session:
        response = await FolderService(
            session, request.app.state.directory_picker
        ).clear()
        await session.commit()
        return response
