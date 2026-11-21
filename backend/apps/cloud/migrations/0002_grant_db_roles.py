"""Least-privilege grants for the Go and PHP roles (plan §3.2, ADR-005).

Roles are created by docker/postgres/init/01-roles.sh. Each grant is skipped when its role
does not exist, so tests and plain databases still migrate.
"""

from django.db import migrations


def _guarded(role: str, statements: list[str]) -> str:
    body = "\n".join(f"    {s};" for s in statements)
    return (
        "DO $$\nBEGIN\n"
        f"  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN\n"
        f"{body}\n"
        "  END IF;\nEND $$;"
    )


LOG_SEQUENCE = "pg_get_serial_sequence('service_status_logs', 'id')"

GRANTS = [
    _guarded("health_ro", ["GRANT SELECT (id, status) ON services TO health_ro"]),
    _guarded(
        "php_module",
        [
            "GRANT SELECT ON customers, services TO php_module",
            "GRANT UPDATE (status, updated_at) ON services TO php_module",
            "GRANT INSERT ON service_status_logs TO php_module",
            f"EXECUTE format('GRANT USAGE ON SEQUENCE %s TO php_module', {LOG_SEQUENCE})",
        ],
    ),
]

REVOKES = [
    _guarded("health_ro", ["REVOKE ALL ON services FROM health_ro"]),
    _guarded(
        "php_module",
        [
            "REVOKE ALL ON customers, services, service_status_logs FROM php_module",
            f"EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM php_module', {LOG_SEQUENCE})",
        ],
    ),
]


class Migration(migrations.Migration):
    dependencies = [
        ("cloud", "0001_initial"),
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=GRANTS, reverse_sql=REVOKES),
    ]
