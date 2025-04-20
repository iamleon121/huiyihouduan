"""
数据库迁移脚本：添加会议议程项标题唯一约束
"""

import os
import sys
from sqlalchemy import text

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入数据库模型
from database import engine, SessionLocal
import models

def add_unique_constraint():
    """
    添加唯一约束，确保同一会议下议程项标题唯一
    """
    print("开始添加唯一约束...")

    # 创建数据库会话
    db = SessionLocal()

    try:
        # 首先检查是否有重复的议程项标题
        print("检查是否有重复的议程项标题...")

        # 获取所有会议
        meetings = db.query(models.Meeting).all()
        print(f"找到 {len(meetings)} 个会议")

        has_duplicates = False

        # 遍历每个会议，检查是否有重复的议程项标题
        for meeting in meetings:
            print(f"\n检查会议: {meeting.id} - {meeting.title}")

            # 获取会议的所有议程项
            agenda_items = db.query(models.AgendaItem).filter(
                models.AgendaItem.meeting_id == meeting.id
            ).all()

            # 收集标题
            titles = [item.title for item in agenda_items]

            # 检查重复标题
            duplicate_titles = [title for title in titles if titles.count(title) > 1]
            if duplicate_titles:
                has_duplicates = True
                print(f"  警告: 会议 {meeting.id} 存在重复的议程项标题: {', '.join(set(duplicate_titles))}")

                # 为重复的标题添加后缀
                title_count = {}
                for item in agenda_items:
                    if item.title in duplicate_titles:
                        if item.title not in title_count:
                            title_count[item.title] = 1
                        else:
                            title_count[item.title] += 1
                            # 添加后缀
                            item.title = f"{item.title} ({title_count[item.title]})"
                            print(f"    修改议程项标题: {item.title}")

        # 如果有重复标题，提交更改
        if has_duplicates:
            print("\n修复重复标题...")
            db.commit()
            print("重复标题已修复")
        else:
            print("\n没有发现重复标题")

        # 添加唯一约束
        print("\n添加唯一约束...")

        # 准备添加唯一约束

        # 使用 SQLite 的方式添加唯一约束

        # 检查表是否存在并获取表结构
        with engine.begin() as conn:
            # 检查表是否存在
            result = conn.execute(text("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='agenda_items';
            """))
            if not result.fetchone():
                print("表 agenda_items 不存在，跳过添加约束")
                return

            # 获取表结构
            result = conn.execute(text("""
                PRAGMA table_info(agenda_items);
            """))
            columns = [row[1] for row in result.fetchall()]
            print(f"当前表结构: {columns}")

        # 根据表结构动态生成SQL语句
        with engine.begin() as conn:
            # 检查是否有id列
            has_id = 'id' in columns
            has_position = 'position' in columns

            # 生成列定义
            column_defs = []
            for col in columns:
                # 获取列类型
                result = conn.execute(text(f"""
                    SELECT type FROM pragma_table_info('agenda_items') WHERE name='{col}';
                """))
                col_type = result.fetchone()[0]

                # 添加列定义
                if col == 'id' and has_id:
                    column_defs.append(f"{col} {col_type} PRIMARY KEY")
                elif col == 'meeting_id' and has_position:
                    column_defs.append(f"{col} {col_type} NOT NULL")
                elif col == 'position' and has_position:
                    column_defs.append(f"{col} {col_type} NOT NULL")
                else:
                    column_defs.append(f"{col} {col_type}")

            # 添加主键和外键约束
            if has_position:
                column_defs.append("PRIMARY KEY (meeting_id, position)")
            column_defs.append("FOREIGN KEY(meeting_id) REFERENCES meetings (id)")
            column_defs.append("UNIQUE (meeting_id, title)")

            # 先删除可能存在的临时表
            try:
                conn.execute(text("""
                    DROP TABLE IF EXISTS agenda_items_temp;
                """))
                print("删除现有临时表成功")
            except Exception as e:
                print(f"删除临时表时发生错误: {str(e)}")

            # 创建临时表
            create_table_sql = f"""
                CREATE TABLE agenda_items_temp (
                    {', '.join(column_defs)}
                );
            """
            print(f"\n创建临时表SQL:\n{create_table_sql}")
            conn.execute(text(create_table_sql))

            # 生成复制数据的SQL
            copy_data_sql = f"""
                INSERT INTO agenda_items_temp
                SELECT {', '.join(columns)}
                FROM agenda_items;
            """
            print(f"\n复制数据SQLs:\n{copy_data_sql}")
            conn.execute(text(copy_data_sql))

            # 删除原表
            conn.execute(text("""
                DROP TABLE agenda_items;
            """))

            # 重命名临时表
            conn.execute(text("""
                ALTER TABLE agenda_items_temp RENAME TO agenda_items;
            """))

        print("唯一约束添加成功")

    except Exception as e:
        # 尝试回滚事务
        try:
            db.rollback()
        except:
            pass

        print(f"添加唯一约束时发生错误: {str(e)}")

        # 尝试清理临时表
        try:
            with engine.begin() as conn:
                conn.execute(text("""
                    DROP TABLE IF EXISTS agenda_items_temp;
                """))
                print("清理临时表成功")
        except Exception as cleanup_error:
            print(f"清理临时表时发生错误: {str(cleanup_error)}")

        raise
    finally:
        try:
            db.close()
        except:
            pass

if __name__ == "__main__":
    # 确认是否继续
    confirm = input("此操作将修改数据库结构，添加唯一约束，请确认是否继续 (y/n): ")
    if confirm.lower() != 'y':
        print("操作已取消")
        sys.exit(0)

    # 执行迁移
    add_unique_constraint()
    print("迁移完成")
