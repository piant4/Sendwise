from dataclasses import dataclass


@dataclass(frozen=True)
class ListmonkClient:
    """Placeholder listmonk API client.

    listmonk is called only by the backend after authorization. This class must
    not be used by the UI or by optional future integration layers directly.
    Milestone 0 intentionally performs no real HTTP requests.
    """

    base_url: str
    username: str | None = None

    def health(self) -> dict[str, str]:
        return {"status": "stub", "service": "listmonk"}

    def create_campaign(self, *_args: object, **_kwargs: object) -> dict[str, str]:
        return {"status": "stub", "operation": "create_campaign"}

    def authorize_send(self, *_args: object, **_kwargs: object) -> dict[str, str]:
        return {"status": "stub", "operation": "authorize_send"}
