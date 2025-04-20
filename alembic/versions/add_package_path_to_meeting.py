"""add package_path to meeting

Revision ID: add_package_path
Revises: 
Create Date: 2023-12-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_package_path'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # 添加package_path字段到meetings表
    op.add_column('meetings', sa.Column('package_path', sa.String(), nullable=True))


def downgrade():
    # 删除package_path字段
    op.drop_column('meetings', 'package_path')
