# Workers

Milestone 0 does not implement Celery or production background workers.

This directory reserves space for a minimal Python worker in later milestones. Future workers may sync listmonk stats, normalize events, run simple retries, and update KPIs, but they must not bypass the backend or Deliverability Guard.
