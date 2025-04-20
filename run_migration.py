import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 导入数据库连接信息
from database import SQLALCHEMY_DATABASE_URL

# 创建数据库引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 添加package_path字段
def add_package_path_column():
    try:
        # 创建package_path字段
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN package_path VARCHAR"))
            conn.commit()
        print("成功添加package_path字段到meetings表")
        return True
    except Exception as e:
        print(f"添加字段失败: {str(e)}")
        return False

if __name__ == "__main__":
    # 执行迁移
    success = add_package_path_column()
    sys.exit(0 if success else 1)
