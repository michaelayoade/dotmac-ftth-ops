"""
Tests for Workflow Engine - Unit Tests

Unit tests for workflow engine helper methods and parameter resolution.
"""

from unittest.mock import MagicMock

import pytest

from dotmac.platform.workflows.engine import WorkflowEngine, WorkflowEngineError

pytestmark = pytest.mark.unit


class TestWorkflowEngineParameterResolution:
    """Test parameter resolution and template syntax"""

    def test_resolve_simple_string(self):
        """Test resolving simple string without templates"""
        engine = WorkflowEngine(db_session=MagicMock())

        result = engine._resolve_params("simple string", {})
        assert result == "simple string"

    def test_resolve_context_reference(self):
        """Test resolving ${context.var} syntax"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"lead_id": "123", "customer_name": "Test Customer"}

        result = engine._resolve_params("${lead_id}", context)
        assert result == "123"

    def test_resolve_dict_with_templates(self):
        """Test resolving dictionary values with templates"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"customer_id": "cust-001", "amount": 100.50}

        params = {
            "customer_id": "${customer_id}",
            "fixed_value": "test",
            "amount": "${amount}",
        }

        result = engine._resolve_params(params, context)
        assert result["customer_id"] == "cust-001"
        assert result["fixed_value"] == "test"
        assert result["amount"] == 100.50

    def test_resolve_list_with_templates(self):
        """Test resolving list items with templates"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"id1": "abc", "id2": "def"}

        params = ["${id1}", "${id2}", "fixed"]
        result = engine._resolve_params(params, context)

        assert result == ["abc", "def", "fixed"]

    def test_resolve_nested_values(self):
        """Test resolving nested context values"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {
            "customer": {"id": "123", "name": "Test"},
            "order": {"amount": 500},
        }

        # Simplified - just test flat access for now
        result = engine._resolve_params("${customer}", context)
        assert result == {"id": "123", "name": "Test"}

    def test_get_nested_value(self):
        """Test getting nested dictionary values with dot notation"""
        engine = WorkflowEngine(db_session=MagicMock())

        obj = {
            "customer": {"id": "123", "details": {"email": "test@example.com"}},
            "amount": 100,
        }

        assert engine._get_nested_value(obj, "customer.id") == "123"
        assert engine._get_nested_value(obj, "amount") == 100
        assert engine._get_nested_value(obj, "customer.details.email") == "test@example.com"

    def test_get_nested_value_missing_key(self):
        """Test getting nested value with missing key returns None"""
        engine = WorkflowEngine(db_session=MagicMock())
        obj = {"customer": {"id": "123"}}

        result = engine._get_nested_value(obj, "customer.missing")
        assert result is None

    def test_resolve_nonexistent_context_var(self):
        """Test resolving nonexistent context variable returns None"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"existing": "value"}

        result = engine._resolve_params("${nonexistent}", context)
        assert result is None


class TestWorkflowEngineConditions:
    """Test condition evaluation"""

    def test_evaluate_eq_condition_true(self):
        """Test equality condition that is true"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"status": "active"}

        condition = {"operator": "eq", "left": "${status}", "right": "active"}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_eq_condition_false(self):
        """Test equality condition that is false"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"status": "inactive"}

        condition = {"operator": "eq", "left": "${status}", "right": "active"}
        result = engine._evaluate_condition(condition, context)

        assert result is False

    def test_evaluate_ne_condition(self):
        """Test not-equal condition"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"type": "premium"}

        condition = {"operator": "ne", "left": "${type}", "right": "basic"}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_gt_condition(self):
        """Test greater-than condition"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"amount": 150}

        condition = {"operator": "gt", "left": "${amount}", "right": 100}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_lt_condition(self):
        """Test less-than condition"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"count": 5}

        condition = {"operator": "lt", "left": "${count}", "right": 10}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_gte_condition(self):
        """Test greater-than-or-equal condition"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"score": 100}

        condition = {"operator": "gte", "left": "${score}", "right": 100}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_lte_condition(self):
        """Test less-than-or-equal condition"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"priority": 3}

        condition = {"operator": "lte", "left": "${priority}", "right": 5}
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_in_condition(self):
        """Test 'in' operator"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"status": "pending"}

        condition = {
            "operator": "in",
            "left": "${status}",
            "right": ["pending", "active", "complete"],
        }
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_not_in_condition(self):
        """Test 'not in' operator"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"status": "failed"}

        condition = {
            "operator": "not_in",
            "left": "${status}",
            "right": ["pending", "active"],
        }
        result = engine._evaluate_condition(condition, context)

        assert result is True

    def test_evaluate_unknown_operator_raises_error(self):
        """Test that unknown operator raises ValueError"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {}

        condition = {"operator": "unknown", "left": "a", "right": "b"}

        with pytest.raises(ValueError, match="Unknown operator"):
            engine._evaluate_condition(condition, context)


class TestWorkflowEngineTransformations:
    """Test data transformation steps"""

    def test_execute_map_transform(self):
        """Test map transformation"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {
            "input_name": "John Doe",
            "input_email": "john@example.com",
            "input_phone": "123-456-7890",
        }

        step_def = {
            "transform_type": "map",
            "mapping": {
                "name": "${input_name}",
                "email": "${input_email}",
                "contact": "${input_phone}",
            },
        }

        result = engine._execute_transform(step_def, context)

        assert result["name"] == "John Doe"
        assert result["email"] == "john@example.com"
        assert result["contact"] == "123-456-7890"

    def test_execute_condition_step(self):
        """Test condition execution step"""
        engine = WorkflowEngine(db_session=MagicMock())
        context = {"is_active": True}

        step_def = {"condition": {"operator": "eq", "left": "${is_active}", "right": True}}

        result = engine._execute_condition(step_def, context)
        assert result is True


class TestWorkflowEngineInitialization:
    """Test engine initialization"""

    def test_engine_creation(self):
        """Test creating workflow engine instance"""
        db_session = MagicMock()
        engine = WorkflowEngine(db_session)

        assert engine.db is db_session
        assert engine.event_publisher is None
        assert engine.service_registry is None

    def test_engine_with_optional_params(self):
        """Test creating engine with optional parameters"""
        db_session = MagicMock()
        event_publisher = MagicMock()
        service_registry = MagicMock()

        engine = WorkflowEngine(
            db_session,
            event_publisher=event_publisher,
            service_registry=service_registry,
        )

        assert engine.db is db_session
        assert engine.event_publisher is event_publisher
        assert engine.service_registry is service_registry


class TestWorkflowEngineErrors:
    """Test workflow engine error classes"""

    def test_workflow_engine_error(self):
        """Test WorkflowEngineError exception"""
        error = WorkflowEngineError("Test error")
        assert str(error) == "Test error"
        assert isinstance(error, Exception)

    def test_step_execution_error(self):
        """Test StepExecutionError exception"""
        from dotmac.platform.workflows.engine import StepExecutionError

        error = StepExecutionError("Step failed")
        assert str(error) == "Step failed"
        assert isinstance(error, WorkflowEngineError)
        assert isinstance(error, Exception)
