from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType


_REFRESH_TARGETS: dict[str, tuple[tuple[str, str, str], ...]] = {
    "test_clerk_auth.py": (
        ("app", "app.main", "app"),
        ("get_settings", "app.core.config", "get_settings"),
        ("get_jwks_client", "app.core.auth", "get_jwks_client"),
        (
            "_build_auth_user_repository",
            "app.repositories.auth_users",
            "_build_auth_user_repository",
        ),
    ),
    "test_client_repository.py": (
        ("PostgresClientRepository", "app.repositories.clients", "PostgresClientRepository"),
        ("Settings", "app.core.config", "Settings"),
    ),
    "test_contact_repository.py": (
        ("PostgresContactRepository", "app.repositories.contacts", "PostgresContactRepository"),
        ("Settings", "app.core.config", "Settings"),
    ),
}


def _load_source_module(module_name: str) -> ModuleType | None:
    if module_name in sys.modules:
        return sys.modules[module_name]

    try:
        return importlib.import_module(module_name)
    except Exception:
        return None


def _test_module_is_stale(
    *,
    test_module: ModuleType,
    refresh_targets: tuple[tuple[str, str, str], ...],
) -> bool:
    for global_name, source_module_name, attribute_name in refresh_targets:
        source_module = _load_source_module(source_module_name)
        if source_module is None or not hasattr(source_module, attribute_name):
            continue
        if test_module.__dict__.get(global_name) is not getattr(
            source_module,
            attribute_name,
        ):
            return True
    return False


def pytest_runtest_setup(item: object) -> None:
    test_module = getattr(item, "module", None)
    module_file = Path(getattr(test_module, "__file__", ""))
    refresh_targets = _REFRESH_TARGETS.get(module_file.name)
    if refresh_targets is None or test_module is None:
        return

    if _test_module_is_stale(
        test_module=test_module,
        refresh_targets=refresh_targets,
    ):
        importlib.reload(test_module)
