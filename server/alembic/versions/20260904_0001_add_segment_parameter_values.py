"""add segment_parameter_values table

Revision ID: 20260904_0001
Revises: 20260708_0001
Create Date: 2026-09-04

Adds the per-WIP recorded actual values for step parameters — the
step-parameter analogue of data_points in DATA-COLLECT. Recording is an
upsert: one current row per (parameter, unit/lot), updated in place.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260904_0001"
down_revision = "20260708_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "segment_parameter_values",
        sa.Column("id", sa.Uuid(), nullable=False, comment="Unique identifier for the entity"),
        sa.Column(
            "parameter_id",
            sa.Uuid(),
            sa.ForeignKey("segment_parameters.id"),
            nullable=False,
            comment="SegmentParameter (spec) this actual value belongs to",
        ),
        sa.Column("unit_id", sa.Uuid(), sa.ForeignKey("units.id"), nullable=True,
                  comment="WIP unit this value was recorded for (null if lot-based)"),
        sa.Column("lot_id", sa.Uuid(), sa.ForeignKey("lots.id"), nullable=True,
                  comment="WIP lot this value was recorded for (null if unit-based)"),
        sa.Column("value_numeric", sa.Float(), nullable=True,
                  comment="Recorded value when data_type='numeric'"),
        sa.Column("value_string", sa.Text(), nullable=True,
                  comment="Recorded value when data_type='string' or 'enum'"),
        sa.Column("value_boolean", sa.Boolean(), nullable=True,
                  comment="Recorded value when data_type='boolean'"),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  comment="Soft delete flag. False means the entity is logically deleted."),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  comment="Timestamp when the entity was created"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  comment="Timestamp when the entity was last updated"),
        sa.Column("created_at_utc", sa.DateTime(timezone=False), nullable=True,
                  comment="Timestamp when the entity was created (UTC)"),
        sa.Column("updated_at_utc", sa.DateTime(timezone=False), nullable=True,
                  comment="Timestamp when the entity was last updated (UTC)"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_segment_parameter_values_parameter_id",
        "segment_parameter_values",
        ["parameter_id"],
    )
    op.create_index(
        "ix_segment_parameter_values_unit_id",
        "segment_parameter_values",
        ["unit_id"],
    )
    op.create_index(
        "ix_segment_parameter_values_lot_id",
        "segment_parameter_values",
        ["lot_id"],
    )
    op.create_index(
        op.f("ix_segment_parameter_values_id"),
        "segment_parameter_values",
        ["id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_segment_parameter_values_id"),
        table_name="segment_parameter_values",
    )
    op.drop_index(
        "ix_segment_parameter_values_lot_id",
        table_name="segment_parameter_values",
    )
    op.drop_index(
        "ix_segment_parameter_values_unit_id",
        table_name="segment_parameter_values",
    )
    op.drop_index(
        "ix_segment_parameter_values_parameter_id",
        table_name="segment_parameter_values",
    )
    op.drop_table("segment_parameter_values")
