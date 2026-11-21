"""Pure unit tests for the state machine (no database)."""

import pytest

from apps.cloud.models import ServiceStatus
from apps.cloud.transitions import ALLOWED_TRANSITIONS, assert_transition_allowed
from apps.core.errors import InvalidStatusTransition

ACTIVE, SUSPENDED = ServiceStatus.ACTIVE, ServiceStatus.SUSPENDED


@pytest.mark.parametrize(("current", "target"), [(ACTIVE, SUSPENDED), (SUSPENDED, ACTIVE)])
def test_allowed_transitions_pass(current, target):
    assert assert_transition_allowed(current, target) is None


@pytest.mark.parametrize("status", [ACTIVE, SUSPENDED])
def test_same_status_is_rejected(status):
    with pytest.raises(InvalidStatusTransition):
        assert_transition_allowed(status, status)


def test_rejection_message_mentions_the_status():
    with pytest.raises(InvalidStatusTransition) as excinfo:
        assert_transition_allowed(ACTIVE, ACTIVE)
    assert "active" in excinfo.value.message


def test_plain_strings_work_like_enum_members():
    """Values read from the DB are plain strings, not enum members."""
    assert_transition_allowed("active", "suspended")
    with pytest.raises(InvalidStatusTransition):
        assert_transition_allowed("active", "active")


@pytest.mark.parametrize(("current", "target"), [("terminated", ACTIVE), (ACTIVE, "terminated")])
def test_unknown_statuses_are_rejected_not_crashing(current, target):
    with pytest.raises(InvalidStatusTransition):
        assert_transition_allowed(current, target)


def test_every_status_has_an_entry():
    """Adding a ServiceStatus without updating the map must fail loudly."""
    assert set(ALLOWED_TRANSITIONS) == set(ServiceStatus.values)
    for targets in ALLOWED_TRANSITIONS.values():
        assert targets <= set(ServiceStatus.values)
