"""Database-level ON DELETE actions for the foreign keys (plan §3.2, ADR-005).

Django 5.2 performs CASCADE / SET_NULL in Python and creates its foreign keys with no ON DELETE
clause. Other writers (the PHP module, psql, future tools) then hit FK violations instead of the
documented behaviour. This migration recreates the three affected constraints with the action
in the database. Django's own deletes are unchanged: it still collects and deletes in Python
first, so the database action only matters for writers that bypass the ORM.

Note: a later AlterField on one of these fields makes Django recreate the constraint without
the clause. apps/cloud/tests/test_db_constraints.py fails if that happens.
"""

from django.db import migrations

# (table, column, referenced table, ON DELETE action)
FOREIGN_KEYS = [
    ("service_status_logs", "service_id", "services", "CASCADE"),
    ("service_status_logs", "changed_by_id", "accounts_user", "SET NULL"),
    ("customers", "user_id", "accounts_user", "SET NULL"),
]


def _recreate(table: str, column: str, ref_table: str, on_delete: str | None) -> str:
    """SQL that swaps the single FK on table.column for one with the given ON DELETE action."""
    action = f" ON DELETE {on_delete}" if on_delete else ""
    return f"""
DO $$
DECLARE fk_name text;
BEGIN
  SELECT con.conname INTO STRICT fk_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND con.conrelid = '{table}'::regclass
    AND array_length(con.conkey, 1) = 1
    AND att.attname = '{column}';

  EXECUTE format('ALTER TABLE {table} DROP CONSTRAINT %I', fk_name);
  EXECUTE format(
    'ALTER TABLE {table} ADD CONSTRAINT %I FOREIGN KEY ({column}) REFERENCES {ref_table} (id)'
    '{action} DEFERRABLE INITIALLY DEFERRED',
    fk_name
  );
END $$;"""


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("customers", "0001_initial"),
        ("cloud", "0002_grant_db_roles"),
    ]

    operations = [
        migrations.RunSQL(
            sql=_recreate(table, column, ref, action),
            reverse_sql=_recreate(table, column, ref, None),
        )
        for table, column, ref, action in FOREIGN_KEYS
    ]
