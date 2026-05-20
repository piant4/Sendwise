from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_db_init_defines_clients_metadata_jsonb() -> None:
    init_sql = (REPO_ROOT / "db" / "init.sql").read_text(encoding="utf-8")

    assert "metadata JSONB NOT NULL DEFAULT '{}'::jsonb" in init_sql


def test_clients_metadata_migration_is_idempotent() -> None:
    migration_sql = (
        REPO_ROOT / "db" / "migrations" / "20260520_clients_metadata_email_brand.sql"
    ).read_text(encoding="utf-8")

    assert "ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb" in migration_sql
