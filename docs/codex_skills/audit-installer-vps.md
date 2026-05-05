# Audit Installer VPS

## Purpose

Audit VPS, Docker, install, reverse proxy, container, mount, and env boundary issues before patching.

## When To Use

Use for issues involving:

- frontend container
- backend container
- postgres container
- listmonk container
- mailpit dev container
- worker container if present
- reverse proxy
- `.env`
- Docker Compose path
- volumes/mounts
- ports
- install scripts
- health checks

## Hard Rules

- Distinguish host path vs container path.
- Do not assume shell `HOME`.
- Validate the compose file actually used.
- Validate the env file actually used.
- Validate mounts.
- Validate public ports.
- PostgreSQL must not be public.
- Mailpit must not be production.
- listmonk admin must not be public without protection.
- Do not patch install or Docker config before the actual boundary is proven.
- Do not change product logic while auditing infra.

## Procedure

1. Identify the host, working directory, compose file, env file, and command actually used.
2. Compare expected services against the active Compose configuration.
3. Inspect container names, images, ports, mounts, env values, and health status.
4. Verify whether the failing path is host-side or container-side.
5. Check whether the reverse proxy points to the correct container and port.
6. Confirm PostgreSQL exposure, Mailpit environment, and listmonk admin protection.
7. Stop at the first concrete infra/config divergence.

## Sendwise Boundaries

- Frontend should call FastAPI, not listmonk or PostgreSQL.
- Backend should call Business PostgreSQL and listmonk.
- listmonk should call SMTP/provider or Mailpit only in dev/staging.
- PostgreSQL should be reachable by backend containers, not public internet.
- Mailpit should exist only in dev/staging Compose.
- Worker container, if present, must not become a second business brain.

## Output Format

```txt
Host context:
Compose file actually used:
Env file actually used:
Services inspected:
Ports inspected:
Mounts inspected:
First divergence:
Evidence:
Security boundary review:
Fix status: not attempted
Next required skill: extract-root-cause
```

## Stop Conditions

Stop when:

- the first host/container/config divergence is found
- the active compose/env files cannot be identified
- required host or container access is unavailable
- continuing would require changing install, Compose, env, or runtime config
