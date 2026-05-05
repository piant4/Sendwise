from copy import deepcopy

from app.core.current_client import get_current_client_id
from app.schemas.blocked_sends import BlockedSend
from app.schemas.common import SendDecision


MOCK_CLIENT_ID = get_current_client_id()

_BLOCKED_SENDS: list[BlockedSend] = [
    BlockedSend(
        id="blocked_acme_001",
        client_id=MOCK_CLIENT_ID,
        campaign_id="campaign_acme_reactivation",
        contact_id="contact_acme_001",
        reason="Milestone 0.5 fake blocked send for UI contract testing.",
        decision=SendDecision.blocked,
        created_at="2026-05-05T12:10:00Z",
    )
]


class BlockedSendsRepository:
    """In-memory blocked sends data boundary for Milestone 0.5 stubs."""

    def list_blocked_sends(self, client_id: str | None = None) -> list[BlockedSend]:
        blocked_sends = _BLOCKED_SENDS
        if client_id is not None:
            blocked_sends = [
                blocked_send
                for blocked_send in blocked_sends
                if blocked_send.client_id == client_id
            ]

        return deepcopy(blocked_sends)
