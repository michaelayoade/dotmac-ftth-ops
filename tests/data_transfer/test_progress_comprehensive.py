"""Comprehensive tests for data transfer progress tracking."""

import asyncio
import json
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest

from dotmac.platform.data_transfer.core import (
    ProgressError,
    ProgressInfo,
    TransferStatus,
)
from dotmac.platform.data_transfer.progress import (
    CheckpointData,
    CheckpointStore,
    FileProgressStore,
    ProgressStore,
    ProgressTracker,
    ResumableOperation,
    cleanup_old_operations,
    create_progress_tracker,
)


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def progress_info():
    """Create a sample progress info."""
    return ProgressInfo(
        operation_id="test-op-123",
        total_records=1000,
        processed_records=250,
        failed_records=5,
        current_batch=3,
        bytes_processed=1024,
        bytes_total=4096,
        status=TransferStatus.RUNNING,
    )


@pytest.fixture
def checkpoint_data(progress_info):
    """Create sample checkpoint data."""
    return CheckpointData(
        operation_id="test-op-123",
        progress=progress_info,
        state={"last_processed_id": 250, "file_offset": 1024},
    )


@pytest.mark.unit
class TestCheckpointData:
    """Test CheckpointData functionality."""

    def test_checkpoint_data_creation(self, progress_info):
        """Test creating checkpoint data."""
        state = {"batch": 5, "offset": 1024}
        checkpoint = CheckpointData("op-123", progress_info, state)

        assert checkpoint.operation_id == "op-123"
        assert checkpoint.progress == progress_info
        assert checkpoint.state == state
        assert isinstance(checkpoint.timestamp, datetime)

    def test_checkpoint_data_with_timestamp(self, progress_info):
        """Test creating checkpoint data with custom timestamp."""
        timestamp = datetime.now(UTC)
        state = {"key": "value"}
        checkpoint = CheckpointData("op-123", progress_info, state, timestamp)

        assert checkpoint.timestamp == timestamp


@pytest.mark.unit
class TestProgressStore:
    """Test ProgressStore base class."""

    @pytest.mark.asyncio
    async def test_progress_store_abstract_methods(self):
        """Test that ProgressStore is abstract."""
        store = ProgressStore()

        with pytest.raises(NotImplementedError):
            await store.save("op-123", Mock())

        with pytest.raises(NotImplementedError):
            await store.load("op-123")

        with pytest.raises(NotImplementedError):
            await store.delete("op-123")

        with pytest.raises(NotImplementedError):
            await store.list_operations()


@pytest.mark.unit
class TestFileProgressStore:
    """Test FileProgressStore functionality."""

    def test_file_progress_store_init(self, temp_dir):
        """Test FileProgressStore initialization."""
        store = FileProgressStore(temp_dir / "progress")
        assert store.base_path == temp_dir / "progress"
        assert store.base_path.exists()

    def test_file_progress_store_default_path(self):
        """Test FileProgressStore with default path."""
        store = FileProgressStore()
        expected_path = Path.home() / ".dotmac" / "data_transfer" / "progress"
        assert store.base_path == expected_path

    def test_get_file_path(self, temp_dir):
        """Test getting file path for operation."""
        store = FileProgressStore(temp_dir / "progress")
        file_path = store._get_file_path("test-op-123")
        assert file_path == temp_dir / "progress" / "test-op-123.json"

    @pytest.mark.asyncio
    async def test_save_progress(self, temp_dir, progress_info):
        """Test saving progress to file."""
        store = FileProgressStore(temp_dir / "progress")
        await store.save("test-op-123", progress_info)

        file_path = store._get_file_path("test-op-123")
        assert file_path.exists()

        with open(file_path) as f:
            data = json.load(f)

        assert data["operation_id"] == "test-op-123"
        assert data["total_records"] == 1000
        assert data["processed_records"] == 250

    @pytest.mark.asyncio
    async def test_load_progress(self, temp_dir, progress_info):
        """Test loading progress from file."""
        store = FileProgressStore(temp_dir / "progress")
        await store.save("test-op-123", progress_info)

        loaded_progress = await store.load("test-op-123")
        assert loaded_progress is not None
        assert loaded_progress.operation_id == "test-op-123"
        assert loaded_progress.total_records == 1000
        assert loaded_progress.processed_records == 250

    @pytest.mark.asyncio
    async def test_load_nonexistent_progress(self, temp_dir):
        """Test loading non-existent progress."""
        store = FileProgressStore(temp_dir / "progress")
        progress = await store.load("nonexistent")
        assert progress is None

    @pytest.mark.asyncio
    async def test_delete_progress(self, temp_dir, progress_info):
        """Test deleting progress file."""
        store = FileProgressStore(temp_dir / "progress")
        await store.save("test-op-123", progress_info)

        file_path = store._get_file_path("test-op-123")
        assert file_path.exists()

        await store.delete("test-op-123")
        assert not file_path.exists()

    @pytest.mark.asyncio
    async def test_delete_nonexistent_progress(self, temp_dir):
        """Test deleting non-existent progress."""
        store = FileProgressStore(temp_dir / "progress")
        # Should not raise an error
        await store.delete("nonexistent")

    @pytest.mark.asyncio
    async def test_list_operations(self, temp_dir, progress_info):
        """Test listing operations."""
        store = FileProgressStore(temp_dir / "progress")

        # Save multiple operations
        await store.save("op-1", progress_info)
        await store.save("op-2", progress_info)
        await store.save("op-3", progress_info)

        operations = await store.list_operations()
        assert len(operations) == 3
        assert "op-1" in operations
        assert "op-2" in operations
        assert "op-3" in operations

    @pytest.mark.asyncio
    async def test_save_error_handling(self, temp_dir):
        """Test error handling during save."""
        store = FileProgressStore(temp_dir / "progress")

        # Create an invalid progress object that can't be serialized
        invalid_progress = Mock()
        invalid_progress.model_dump.side_effect = Exception("Serialization error")

        with pytest.raises(ProgressError):
            await store.save("test-op", invalid_progress)

    @pytest.mark.asyncio
    async def test_load_error_handling(self, temp_dir):
        """Test error handling during load."""
        store = FileProgressStore(temp_dir / "progress")

        # Create invalid JSON file
        file_path = store._get_file_path("invalid-op")
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w") as f:
            f.write("invalid json {")

        with pytest.raises(ProgressError):
            await store.load("invalid-op")


@pytest.mark.unit
class TestCheckpointStore:
    """Test CheckpointStore functionality."""

    def test_checkpoint_store_init(self, temp_dir):
        """Test CheckpointStore initialization."""
        store = CheckpointStore(temp_dir / "checkpoints")
        assert store.base_path == temp_dir / "checkpoints"
        assert store.base_path.exists()

    def test_checkpoint_store_default_path(self):
        """Test CheckpointStore with default path."""
        store = CheckpointStore()
        expected_path = Path.home() / ".dotmac" / "data_transfer" / "checkpoints"
        assert store.base_path == expected_path

    def test_get_file_path(self, temp_dir):
        """Test getting checkpoint file path."""
        store = CheckpointStore(temp_dir / "checkpoints")
        file_path = store._get_file_path("test-op-123")
        assert file_path == temp_dir / "checkpoints" / "test-op-123.checkpoint"

    @pytest.mark.asyncio
    async def test_save_checkpoint(self, temp_dir, checkpoint_data):
        """Test saving checkpoint to file."""
        store = CheckpointStore(temp_dir / "checkpoints")
        await store.save_checkpoint(checkpoint_data)

        file_path = store._get_file_path("test-op-123")
        assert file_path.exists()

    @pytest.mark.asyncio
    async def test_load_checkpoint(self, temp_dir, checkpoint_data):
        """Test loading checkpoint from file."""
        store = CheckpointStore(temp_dir / "checkpoints")
        await store.save_checkpoint(checkpoint_data)

        loaded_checkpoint = await store.load_checkpoint("test-op-123")
        assert loaded_checkpoint is not None
        assert loaded_checkpoint.operation_id == "test-op-123"
        assert loaded_checkpoint.state == {"last_processed_id": 250, "file_offset": 1024}

    @pytest.mark.asyncio
    async def test_load_nonexistent_checkpoint(self, temp_dir):
        """Test loading non-existent checkpoint."""
        store = CheckpointStore(temp_dir / "checkpoints")
        checkpoint = await store.load_checkpoint("nonexistent")
        assert checkpoint is None

    @pytest.mark.asyncio
    async def test_delete_checkpoint(self, temp_dir, checkpoint_data):
        """Test deleting checkpoint file."""
        store = CheckpointStore(temp_dir / "checkpoints")
        await store.save_checkpoint(checkpoint_data)

        file_path = store._get_file_path("test-op-123")
        assert file_path.exists()

        await store.delete_checkpoint("test-op-123")
        assert not file_path.exists()

    @pytest.mark.asyncio
    async def test_save_checkpoint_error_handling(self, temp_dir):
        """Test error handling during checkpoint save."""
        store = CheckpointStore(temp_dir / "checkpoints")

        # Create a checkpoint that can't be pickled
        invalid_checkpoint = Mock()
        # Make it unpicklable by adding a lambda
        invalid_checkpoint.operation_id = "test"
        invalid_checkpoint._unpicklable = lambda x: x

        with pytest.raises(ProgressError):
            await store.save_checkpoint(invalid_checkpoint)

    @pytest.mark.asyncio
    async def test_load_checkpoint_error_handling(self, temp_dir):
        """Test error handling during checkpoint load."""
        store = CheckpointStore(temp_dir / "checkpoints")

        # Create invalid pickle file
        file_path = store._get_file_path("invalid-op")
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w") as f:
            f.write("invalid pickle data")

        with pytest.raises(ProgressError):
            await store.load_checkpoint("invalid-op")


@pytest.mark.unit
class TestProgressTracker:
    """Test ProgressTracker functionality."""

    def test_progress_tracker_init(self):
        """Test ProgressTracker initialization."""
        tracker = ProgressTracker()
        assert tracker.operation_id is not None
        assert isinstance(tracker.store, FileProgressStore)
        assert isinstance(tracker.checkpoint_store, CheckpointStore)
        assert tracker._progress.operation_id == tracker.operation_id

    def test_progress_tracker_with_custom_id(self):
        """Test ProgressTracker with custom operation ID."""
        tracker = ProgressTracker(operation_id="custom-op-123")
        assert tracker.operation_id == "custom-op-123"
        assert tracker._progress.operation_id == "custom-op-123"

    def test_progress_tracker_with_callback(self):
        """Test ProgressTracker with callback."""
        callback = Mock()
        tracker = ProgressTracker(callback=callback)
        assert callback in tracker._callbacks

    def test_add_callback(self):
        """Test adding progress callback."""
        tracker = ProgressTracker()
        callback = Mock()
        tracker.add_callback(callback)
        assert callback in tracker._callbacks

    def test_update_progress(self):
        """Test updating progress metrics."""
        tracker = ProgressTracker()
        callback = Mock()
        tracker.add_callback(callback)

        tracker.update(processed=10, failed=2, bytes_processed=1024, current_batch=5)

        assert tracker._progress.processed_records == 10
        assert tracker._progress.failed_records == 2
        assert tracker._progress.bytes_processed == 1024
        assert tracker._progress.current_batch == 5
        callback.assert_called_once()

    def test_estimate_completion_no_data(self):
        """Test completion estimation with no data."""
        tracker = ProgressTracker()
        tracker._estimate_completion()
        assert tracker._progress.estimated_completion is None

    def test_estimate_completion_with_data(self):
        """Test completion estimation with data."""
        tracker = ProgressTracker()
        tracker._progress.total_records = 1000
        tracker._progress.processed_records = 250
        # Set start time to 4 seconds ago
        tracker._progress.start_time = datetime.now(UTC) - timedelta(seconds=4)
        tracker._progress.last_update = datetime.now(UTC)

        tracker._estimate_completion()
        assert tracker._progress.estimated_completion is not None

    def test_notify_callbacks_error_handling(self):
        """Test callback error handling."""
        tracker = ProgressTracker()

        # Add a callback that raises an exception
        failing_callback = Mock(side_effect=Exception("Callback error"))
        working_callback = Mock()

        tracker.add_callback(failing_callback)
        tracker.add_callback(working_callback)

        # Should not raise exception
        tracker._notify_callbacks()

        failing_callback.assert_called_once()
        working_callback.assert_called_once()

    @pytest.mark.asyncio
    async def test_initialize(self, temp_dir):
        """Test initializing progress tracker."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(store=store)

        await tracker.initialize(total_records=1000, total_bytes=4096)

        assert tracker._progress.status == TransferStatus.RUNNING
        assert tracker._progress.total_records == 1000
        assert tracker._progress.bytes_total == 4096
        assert tracker._update_task is not None

    @pytest.mark.asyncio
    async def test_save_and_load(self, temp_dir):
        """Test saving and loading progress."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)

        tracker.update(processed=100, failed=5)
        await tracker.save()

        # Create new tracker with same ID
        new_tracker = ProgressTracker(operation_id="test-op", store=store)
        loaded = await new_tracker.load()

        assert loaded is True
        assert new_tracker._progress.processed_records == 100
        assert new_tracker._progress.failed_records == 5

    @pytest.mark.asyncio
    async def test_load_nonexistent(self, temp_dir):
        """Test loading non-existent progress."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="nonexistent", store=store)

        loaded = await tracker.load()
        assert loaded is False

    @pytest.mark.asyncio
    async def test_complete(self, temp_dir):
        """Test completing operation."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(store=store)
        callback = Mock()
        tracker.add_callback(callback)

        await tracker.initialize()
        await tracker.complete()

        assert tracker._progress.status == TransferStatus.COMPLETED
        assert tracker._update_task is None
        callback.assert_called()

    @pytest.mark.asyncio
    async def test_fail(self, temp_dir):
        """Test failing operation."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(store=store)
        callback = Mock()
        tracker.add_callback(callback)

        await tracker.initialize()
        await tracker.fail("Something went wrong")

        assert tracker._progress.status == TransferStatus.FAILED
        assert tracker._progress.error_message == "Something went wrong"
        assert tracker._update_task is None
        callback.assert_called()

    @pytest.mark.asyncio
    async def test_pause_and_resume(self, temp_dir):
        """Test pausing and resuming operation."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(store=store)

        await tracker.initialize()
        await tracker.pause()

        assert tracker._progress.status == TransferStatus.PAUSED
        assert tracker._update_task is None

        await tracker.resume()
        assert tracker._progress.status == TransferStatus.RUNNING
        assert tracker._update_task is not None

    @pytest.mark.asyncio
    async def test_cancel(self, temp_dir):
        """Test cancelling operation."""
        store = FileProgressStore(temp_dir / "progress")
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")
        tracker = ProgressTracker(store=store, checkpoint_store=checkpoint_store)

        await tracker.initialize()
        await tracker.cancel()

        assert tracker._progress.status == TransferStatus.CANCELLED
        assert tracker._update_task is None

    @pytest.mark.asyncio
    async def test_cleanup(self, temp_dir):
        """Test cleanup operation."""
        store = FileProgressStore(temp_dir / "progress")
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")
        tracker = ProgressTracker(
            operation_id="test-op", store=store, checkpoint_store=checkpoint_store
        )

        # Save some data first
        await tracker.save()
        checkpoint_data = CheckpointData("test-op", tracker._progress, {"key": "value"})
        await tracker.checkpoint_store.save_checkpoint(checkpoint_data)

        # Verify files exist
        progress_file = store._get_file_path("test-op")
        checkpoint_file = checkpoint_store._get_file_path("test-op")
        assert progress_file.exists()
        assert checkpoint_file.exists()

        # Cleanup
        await tracker.cleanup()
        assert not progress_file.exists()
        assert not checkpoint_file.exists()

    @pytest.mark.asyncio
    async def test_save_and_load_checkpoint(self, temp_dir):
        """Test saving and loading checkpoints."""
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")
        tracker = ProgressTracker(operation_id="test-op", checkpoint_store=checkpoint_store)

        state = {"batch": 5, "offset": 1024}
        await tracker.save_checkpoint(state)

        loaded_checkpoint = await tracker.load_checkpoint()
        assert loaded_checkpoint is not None
        assert loaded_checkpoint.operation_id == "test-op"
        assert loaded_checkpoint.state == state

    @pytest.mark.asyncio
    async def test_restore_from_checkpoint(self, temp_dir, checkpoint_data):
        """Test restoring from checkpoint."""
        tracker = ProgressTracker(operation_id="test-op-123")

        success = await tracker.restore_from_checkpoint(checkpoint_data)
        assert success is True
        assert tracker._progress.processed_records == 250

        # Test with wrong operation ID
        wrong_checkpoint = CheckpointData("wrong-op", checkpoint_data.progress, {})
        success = await tracker.restore_from_checkpoint(wrong_checkpoint)
        assert success is False

    @pytest.mark.asyncio
    async def test_restore_from_latest_checkpoint(self, temp_dir, checkpoint_data):
        """Test restoring from latest checkpoint."""
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")
        tracker = ProgressTracker(operation_id="test-op-123", checkpoint_store=checkpoint_store)

        # Save checkpoint
        await checkpoint_store.save_checkpoint(checkpoint_data)

        # Restore from latest
        success = await tracker.restore_from_latest_checkpoint()
        assert success is True
        assert tracker._progress.processed_records == 250

    @pytest.mark.asyncio
    async def test_restore_from_latest_checkpoint_none(self, temp_dir):
        """Test restoring when no checkpoint exists."""
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")
        tracker = ProgressTracker(operation_id="nonexistent", checkpoint_store=checkpoint_store)

        success = await tracker.restore_from_latest_checkpoint()
        assert success is False

    @pytest.mark.asyncio
    async def test_auto_save_loop(self, temp_dir):
        """Test auto-save functionality."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)

        # Start auto-save
        tracker._start_auto_save()
        assert tracker._update_task is not None

        # Wait a bit and update progress
        tracker.update(processed=10)
        await asyncio.sleep(0.1)

        # Stop auto-save
        tracker._stop_auto_save()
        assert tracker._update_task is None

    @pytest.mark.asyncio
    async def test_auto_save_cancellation(self, temp_dir):
        """Test auto-save cancellation handling."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)

        tracker._start_auto_save()
        task = tracker._update_task
        assert task is not None

        # Cancel the task
        task.cancel()
        await asyncio.sleep(0.1)  # Let the task handle cancellation

        # Task should be done but not failed
        assert task.done()
        assert task.cancelled()


@pytest.mark.unit
class TestResumableOperation:
    """Test ResumableOperation context manager."""

    def test_resumable_operation_init(self):
        """Test ResumableOperation initialization."""
        operation = ResumableOperation()
        assert operation.operation_id is not None
        assert isinstance(operation.tracker, ProgressTracker)

    def test_resumable_operation_with_custom_id(self):
        """Test ResumableOperation with custom ID."""
        operation = ResumableOperation(operation_id="custom-op")
        assert operation.operation_id == "custom-op"

    def test_resumable_operation_with_tracker(self):
        """Test ResumableOperation with custom tracker."""
        tracker = Mock()
        operation = ResumableOperation(tracker=tracker)
        assert operation.tracker == tracker

    @pytest.mark.asyncio
    async def test_resumable_operation_context_new(self, temp_dir):
        """Test ResumableOperation context for new operation."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)
        tracker.load = AsyncMock(return_value=False)
        tracker.initialize = AsyncMock()
        tracker.complete = AsyncMock()
        # Mock the progress status to be RUNNING after initialization
        tracker._progress.status = TransferStatus.RUNNING

        operation = ResumableOperation(tracker=tracker)

        async with operation as t:
            assert t == tracker
            tracker.initialize.assert_called_once()

        # Complete should be called when exiting context with RUNNING status
        tracker.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_resumable_operation_context_resume(self, temp_dir):
        """Test ResumableOperation context for resuming operation."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)
        tracker.load = AsyncMock(return_value=True)
        tracker.resume = AsyncMock()
        tracker.complete = AsyncMock()
        # Mock the progress status to be RUNNING after resuming
        tracker._progress.status = TransferStatus.RUNNING

        operation = ResumableOperation(tracker=tracker)

        async with operation as t:
            assert t == tracker
            tracker.resume.assert_called_once()

        # Complete should be called when exiting context with RUNNING status
        tracker.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_resumable_operation_context_error(self, temp_dir):
        """Test ResumableOperation context with error."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)
        tracker.load = AsyncMock(return_value=False)
        tracker.initialize = AsyncMock()
        tracker.fail = AsyncMock()

        operation = ResumableOperation(tracker=tracker)

        with pytest.raises(ValueError):
            async with operation:
                raise ValueError("Test error")

        tracker.fail.assert_called_once_with("Test error")

    @pytest.mark.asyncio
    async def test_resumable_operation_context_running_status(self, temp_dir):
        """Test ResumableOperation with running status completion."""
        store = FileProgressStore(temp_dir / "progress")
        tracker = ProgressTracker(operation_id="test-op", store=store)
        tracker.load = AsyncMock(return_value=False)
        tracker.initialize = AsyncMock()
        tracker.complete = AsyncMock()
        tracker._progress.status = TransferStatus.RUNNING

        operation = ResumableOperation(tracker=tracker)

        async with operation:
            pass

        tracker.complete.assert_called_once()


@pytest.mark.unit
class TestUtilityFunctions:
    """Test utility functions."""

    def test_create_progress_tracker(self):
        """Test creating progress tracker."""
        callback = Mock()
        tracker = create_progress_tracker(operation_id="test-op", callback=callback)

        assert isinstance(tracker, ProgressTracker)
        assert tracker.operation_id == "test-op"
        assert callback in tracker._callbacks

    def test_create_progress_tracker_defaults(self):
        """Test creating progress tracker with defaults."""
        tracker = create_progress_tracker()

        assert isinstance(tracker, ProgressTracker)
        assert tracker.operation_id is not None

    @pytest.mark.asyncio
    async def test_cleanup_old_operations(self, temp_dir):
        """Test cleaning up old operations."""
        store = FileProgressStore(temp_dir / "progress")

        # Create old and new progress
        old_progress = ProgressInfo(operation_id="old-op")
        old_progress.last_update = datetime.now(UTC) - timedelta(days=10)

        new_progress = ProgressInfo(operation_id="new-op")
        new_progress.last_update = datetime.now(UTC)

        await store.save("old-op", old_progress)
        await store.save("new-op", new_progress)

        # Cleanup operations older than 7 days
        count = await cleanup_old_operations(store, max_age_days=7)

        assert count == 1

        # Verify only new operation remains
        operations = await store.list_operations()
        assert "new-op" in operations
        assert "old-op" not in operations

    @pytest.mark.asyncio
    async def test_cleanup_old_operations_default_store(self):
        """Test cleanup with default store."""
        # Should not raise an error
        count = await cleanup_old_operations()
        assert isinstance(count, int)

    @pytest.mark.asyncio
    async def test_cleanup_old_operations_error_handling(self, temp_dir):
        """Test cleanup error handling."""
        # Create a store that will fail
        store = Mock()
        store.list_operations = AsyncMock(side_effect=Exception("Store error"))

        count = await cleanup_old_operations(store)
        assert count == 0


@pytest.mark.unit
class TestIntegration:
    """Integration tests for progress tracking."""

    @pytest.mark.asyncio
    async def test_full_operation_lifecycle(self, temp_dir):
        """Test complete operation lifecycle."""
        store = FileProgressStore(temp_dir / "progress")
        checkpoint_store = CheckpointStore(temp_dir / "checkpoints")

        # Create tracker and initialize
        tracker = ProgressTracker(
            operation_id="integration-test",
            store=store,
            checkpoint_store=checkpoint_store,
        )

        await tracker.initialize(total_records=100)

        # Simulate processing
        for i in range(10):
            tracker.update(processed=10)
            if i == 5:
                # Save checkpoint mid-process
                await tracker.save_checkpoint({"last_batch": i})

        await tracker.complete()

        # Verify final state
        assert tracker._progress.processed_records == 100
        assert tracker._progress.status == TransferStatus.COMPLETED

        # Verify checkpoint exists
        checkpoint = await tracker.load_checkpoint()
        assert checkpoint is not None
        assert checkpoint.state["last_batch"] == 5

    @pytest.mark.asyncio
    async def test_resumable_operation_full_cycle(self, temp_dir):
        """Test full resumable operation cycle."""
        store = FileProgressStore(temp_dir / "progress")

        operation_id = "resumable-test"

        # First run - partial completion
        tracker1 = ProgressTracker(operation_id=operation_id, store=store)
        async with ResumableOperation(operation_id=operation_id, tracker=tracker1):
            tracker1.update(processed=50)
            await tracker1.pause()

        # Second run - resume and complete
        tracker2 = ProgressTracker(operation_id=operation_id, store=store)
        async with ResumableOperation(operation_id=operation_id, tracker=tracker2):
            # Should have resumed with previous progress
            assert tracker2._progress.processed_records >= 50
            tracker2.update(processed=50)

        # Verify completion
        assert tracker2._progress.processed_records >= 100
        assert tracker2._progress.status == TransferStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, temp_dir):
        """Test concurrent operation tracking."""
        store = FileProgressStore(temp_dir / "progress")

        # Create multiple concurrent operations
        operations = []
        for i in range(5):
            tracker = ProgressTracker(operation_id=f"concurrent-{i}", store=store)
            operations.append(tracker)

        # Initialize all operations
        for tracker in operations:
            await tracker.initialize(total_records=100)

        # Update progress concurrently
        update_tasks = []
        for i, tracker in enumerate(operations):

            async def update_progress(t, op_id):
                for _j in range(10):
                    t.update(processed=10)
                    await asyncio.sleep(0.01)  # Small delay
                await t.complete()

            task = asyncio.create_task(update_progress(tracker, i))
            update_tasks.append(task)

        await asyncio.gather(*update_tasks)

        # Verify all operations completed
        for tracker in operations:
            assert tracker._progress.processed_records == 100
            assert tracker._progress.status == TransferStatus.COMPLETED

        # Verify separate progress files
        operation_ids = await store.list_operations()
        assert len(operation_ids) == 5
        for i in range(5):
            assert f"concurrent-{i}" in operation_ids
