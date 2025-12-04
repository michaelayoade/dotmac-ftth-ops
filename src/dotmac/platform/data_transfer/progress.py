"""Simplified progress tracking using standard Python libraries."""

from __future__ import annotations

import asyncio
import json
import pickle
from asyncio import Task
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import TracebackType
from typing import Any
from uuid import uuid4

from .core import (
    ProgressCallback,
    ProgressError,
    ProgressInfo,
    TransferStatus,
)


class CheckpointData:
    """Data for resumable operations."""

    def __init__(
        self,
        operation_id: str,
        progress: ProgressInfo,
        state: dict[str, Any],
        timestamp: datetime | None = None,
    ):
        self.operation_id = operation_id
        self.progress = progress
        self.state = state
        self.timestamp = timestamp or datetime.now(UTC)


class ProgressStore:
    """Base class for progress storage."""

    async def save(self, operation_id: str, progress: ProgressInfo) -> None:
        """Save progress information."""
        raise NotImplementedError

    async def load(self, operation_id: str) -> ProgressInfo | None:
        """Load progress information."""
        raise NotImplementedError

    async def delete(self, operation_id: str) -> None:
        """Delete progress information."""
        raise NotImplementedError

    async def list_operations(self) -> list[str]:
        """List all operation IDs."""
        raise NotImplementedError


class FileProgressStore(ProgressStore):
    """File-based progress storage using JSON."""

    def __init__(self, base_path: Path | None = None) -> None:
        self.base_path = base_path or Path.home() / ".dotmac" / "data_transfer" / "progress"
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, operation_id: str) -> Path:
        """Get file path for operation."""
        return self.base_path / f"{operation_id}.json"

    async def save(self, operation_id: str, progress: ProgressInfo) -> None:
        """Save progress to JSON file."""
        try:
            file_path = self._get_file_path(operation_id)
            with open(file_path, "w") as f:
                json.dump(progress.model_dump(), f, default=str)
        except Exception as e:
            raise ProgressError(f"Failed to save progress: {e}") from e

    async def load(self, operation_id: str) -> ProgressInfo | None:
        """Load progress from JSON file."""
        try:
            file_path = self._get_file_path(operation_id)
            if not file_path.exists():
                return None

            with open(file_path) as f:
                data = json.load(f)

            # Convert string dates back to datetime
            for date_field in ["start_time", "last_update", "estimated_completion"]:
                if data.get(date_field):
                    data[date_field] = datetime.fromisoformat(data[date_field])

            return ProgressInfo(**data)
        except Exception as e:
            raise ProgressError(f"Failed to load progress: {e}") from e

    async def delete(self, operation_id: str) -> None:
        """Delete progress file."""
        try:
            file_path = self._get_file_path(operation_id)
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            raise ProgressError(f"Failed to delete progress: {e}") from e

    async def list_operations(self) -> list[str]:
        """List all operation IDs."""
        try:
            return [f.stem for f in self.base_path.glob("*.json")]
        except Exception as e:
            raise ProgressError(f"Failed to list operations: {e}") from e


class CheckpointStore:
    """Store for operation checkpoints."""

    def __init__(self, base_path: Path | None = None) -> None:
        self.base_path = base_path or Path.home() / ".dotmac" / "data_transfer" / "checkpoints"
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, operation_id: str) -> Path:
        """Get checkpoint file path."""
        return self.base_path / f"{operation_id}.checkpoint"

    async def save_checkpoint(self, checkpoint: CheckpointData) -> None:
        """Save checkpoint to file."""
        try:
            file_path = self._get_file_path(checkpoint.operation_id)
            with open(file_path, "wb") as f:
                pickle.dump(checkpoint, f)
        except Exception as e:
            raise ProgressError(f"Failed to save checkpoint: {e}") from e

    async def load_checkpoint(self, operation_id: str) -> CheckpointData | None:
        """Load checkpoint from file."""
        try:
            file_path = self._get_file_path(operation_id)
            if not file_path.exists():
                return None

            with open(file_path, "rb") as f:
                data = pickle.load(f)  # nosec B301 - Internal progress files, trusted

            if isinstance(data, CheckpointData):
                return data

            raise ProgressError("Invalid checkpoint data")
        except Exception as e:
            raise ProgressError(f"Failed to load checkpoint: {e}") from e

    async def delete_checkpoint(self, operation_id: str) -> None:
        """Delete checkpoint file."""
        try:
            file_path = self._get_file_path(operation_id)
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            raise ProgressError(f"Failed to delete checkpoint: {e}") from e


class ProgressTracker:
    """Track progress of data transfer operations."""

    def __init__(
        self,
        operation_id: str | None = None,
        store: ProgressStore | None = None,
        checkpoint_store: CheckpointStore | None = None,
        callback: ProgressCallback | None = None,
    ):
        self.operation_id = operation_id or str(uuid4())
        self.store = store or FileProgressStore()
        self.checkpoint_store = checkpoint_store or CheckpointStore()
        self._progress = ProgressInfo(operation_id=self.operation_id)
        self._callbacks: list[ProgressCallback] = []
        if callback:
            self._callbacks.append(callback)
        self._update_task: Task[None] | None = None

    def add_callback(self, callback: ProgressCallback) -> None:
        """Add a progress callback."""
        self._callbacks.append(callback)

    def update(
        self,
        processed: int = 0,
        failed: int = 0,
        bytes_processed: int = 0,
        current_batch: int | None = None,
    ) -> None:
        """Update progress metrics."""
        self._progress.processed_records += processed
        self._progress.failed_records += failed
        self._progress.bytes_processed += bytes_processed
        if current_batch is not None:
            self._progress.current_batch = current_batch

        self._progress.last_update = datetime.now(UTC)
        self._estimate_completion()
        self._notify_callbacks()

    def _estimate_completion(self) -> None:
        """Estimate completion time."""
        if not self._progress.total_records or self._progress.processed_records == 0:
            return

        elapsed = self._progress.elapsed_time.total_seconds()
        if elapsed == 0:
            return

        rate = self._progress.processed_records / elapsed
        remaining = self._progress.total_records - self._progress.processed_records
        eta_seconds = remaining / rate

        self._progress.estimated_completion = datetime.now(UTC) + timedelta(seconds=eta_seconds)

    def _notify_callbacks(self) -> None:
        """Notify all callbacks of progress update."""
        for callback in self._callbacks:
            try:
                callback(self._progress)
            except Exception:
                pass

    async def initialize(
        self,
        total_records: int | None = None,
        total_bytes: int | None = None,
    ) -> None:
        """Initialize progress tracking."""
        self._progress.status = TransferStatus.RUNNING
        if total_records:
            self._progress.total_records = total_records
        if total_bytes:
            self._progress.bytes_total = total_bytes

        await self.save()
        self._start_auto_save()

    async def save(self) -> None:
        """Save current progress."""
        await self.store.save(self.operation_id, self._progress)

    async def load(self) -> bool:
        """Load progress from storage."""
        progress = await self.store.load(self.operation_id)
        if progress:
            self._progress = progress
            return True
        return False

    async def complete(self) -> None:
        """Mark operation as complete."""
        self._progress.status = TransferStatus.COMPLETED
        self._progress.last_update = datetime.now(UTC)
        await self.save()
        self._stop_auto_save()
        self._notify_callbacks()

    async def fail(self, error_message: str) -> None:
        """Mark operation as failed."""
        self._progress.status = TransferStatus.FAILED
        self._progress.error_message = error_message
        self._progress.last_update = datetime.now(UTC)
        await self.save()
        self._stop_auto_save()
        self._notify_callbacks()

    async def pause(self) -> None:
        """Pause the operation."""
        self._progress.status = TransferStatus.PAUSED
        await self.save()
        self._stop_auto_save()

    async def resume(self) -> None:
        """Resume the operation."""
        self._progress.status = TransferStatus.RUNNING
        await self.save()
        self._start_auto_save()

    async def cancel(self) -> None:
        """Cancel the operation."""
        self._progress.status = TransferStatus.CANCELLED
        await self.save()
        self._stop_auto_save()
        await self.cleanup()

    async def cleanup(self) -> None:
        """Clean up progress data."""
        await self.store.delete(self.operation_id)
        await self.checkpoint_store.delete_checkpoint(self.operation_id)

    async def save_checkpoint(self, state: dict[str, Any]) -> None:
        """Save a checkpoint for resumable operations."""
        checkpoint = CheckpointData(
            operation_id=self.operation_id,
            progress=self._progress,
            state=state,
        )
        await self.checkpoint_store.save_checkpoint(checkpoint)

    async def load_checkpoint(self) -> CheckpointData | None:
        """Load checkpoint data."""
        return await self.checkpoint_store.load_checkpoint(self.operation_id)

    async def restore_from_checkpoint(self, checkpoint: CheckpointData) -> bool:
        """Restore from checkpoint."""
        if checkpoint and checkpoint.operation_id == self.operation_id:
            self._progress = checkpoint.progress
            return True
        return False

    async def restore_from_latest_checkpoint(self) -> bool:
        """Restore from the latest checkpoint."""
        checkpoint = await self.load_checkpoint()
        if checkpoint:
            return await self.restore_from_checkpoint(checkpoint)
        return False

    def _start_auto_save(self) -> None:
        """Start automatic progress saving."""
        if not self._update_task:
            self._update_task = asyncio.create_task(self._auto_save_loop())

    def _stop_auto_save(self) -> None:
        """Stop automatic progress saving."""
        if self._update_task:
            self._update_task.cancel()
            self._update_task = None

    async def _auto_save_loop(self) -> None:
        """Periodically save progress."""
        try:
            while True:
                await asyncio.sleep(5)  # Save every 5 seconds
                await self.save()
        except asyncio.CancelledError:
            pass


class ResumableOperation:
    """Context manager for resumable operations."""

    def __init__(
        self,
        operation_id: str | None = None,
        tracker: ProgressTracker | None = None,
    ):
        self.operation_id = operation_id or str(uuid4())
        self.tracker = tracker or ProgressTracker(self.operation_id)

    async def __aenter__(self) -> ProgressTracker:
        """Enter context and try to resume."""
        if await self.tracker.load():
            await self.tracker.resume()
        else:
            await self.tracker.initialize()
        return self.tracker

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Exit context and handle errors."""
        if exc_type:
            await self.tracker.fail(str(exc_val))
        elif self.tracker._progress.status == TransferStatus.RUNNING:
            await self.tracker.complete()


def create_progress_tracker(
    operation_id: str | None = None,
    callback: ProgressCallback | None = None,
) -> ProgressTracker:
    """Create a progress tracker."""
    return ProgressTracker(operation_id=operation_id, callback=callback)


async def cleanup_old_operations(
    store: ProgressStore | None = None,
    max_age_days: int = 7,
) -> int:
    """Clean up old operation data."""
    store = store or FileProgressStore()
    count = 0

    try:
        operations = await store.list_operations()
        cutoff = datetime.now(UTC) - timedelta(days=max_age_days)

        for op_id in operations:
            progress = await store.load(op_id)
            if progress and progress.last_update < cutoff:
                await store.delete(op_id)
                count += 1

        return count
    except Exception:
        return 0
