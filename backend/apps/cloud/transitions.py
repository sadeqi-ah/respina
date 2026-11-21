"""Service status state machine: the single source of truth (plan §3.3).

    active ──suspend──▶ suspended
    suspended ──activate──▶ active

Pure Python, no database access. The PHP module mirrors this map; to add a status, follow
the recipe in docs/CONTRIBUTING.md (enum, this map, a CHECK-constraint migration, PHP enum).
"""

from collections.abc import Mapping

from apps.core.errors import InvalidStatusTransition

from .models import ServiceStatus

ALLOWED_TRANSITIONS: Mapping[str, frozenset[str]] = {
    ServiceStatus.ACTIVE: frozenset({ServiceStatus.SUSPENDED}),
    ServiceStatus.SUSPENDED: frozenset({ServiceStatus.ACTIVE}),
}


def assert_transition_allowed(current: str, target: str) -> None:
    """Return None if `current → target` is allowed, else raise InvalidStatusTransition.

    Moving to the status the service already has is not allowed (→ 409).
    """
    # .get(): a status the map doesn't know yields "nothing allowed" (409), not a KeyError (500).
    # A same-status move is never in the map, so it is rejected too.
    if target not in ALLOWED_TRANSITIONS.get(current, frozenset()):
        raise InvalidStatusTransition(f"Cannot change status from {current} to {target}.")
