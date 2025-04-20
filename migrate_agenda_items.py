"""
数据库迁移脚本：将议程项从使用ID作为主键迁移到使用(meeting_id, position)作为复合主键
"""

import os
import sys
import json
import shutil
from sqlalchemy import text  # 用于执行SQL语句

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入数据库模型
from database import engine, SessionLocal
import models

def migrate_agenda_items():
    """
    迁移议程项数据
    1. 创建新的议程项表结构
    2. 将旧表中的数据迁移到新表中
    3. 重命名文件夹
    """
    print("开始迁移议程项数据...")

    # 创建数据库会话
    db = SessionLocal()

    try:
        # 首先检查表结构
        with engine.begin() as conn:
            # 检查表是否存在
            result = conn.execute(text("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='agenda_items';
            """))
            if not result.fetchone():
                print("表 agenda_items 不存在，跳过迁移")
                return

            # 获取表结构
            result = conn.execute(text("""
                PRAGMA table_info(agenda_items);
            """))
            columns = [row[1] for row in result.fetchall()]
            print(f"当前表结构: {columns}")

            # 检查是否已经有position列
            if 'position' in columns:
                print("表已经有position列，跳过表结构迁移")
            else:
                print("创建新的表结构...")

                # 创建临时表
                conn.execute(text("""
                    CREATE TABLE agenda_items_temp (
                        meeting_id VARCHAR NOT NULL,
                        position INTEGER NOT NULL,
                        title VARCHAR,
                        files JSON,
                        reporter VARCHAR,
                        duration_minutes INTEGER,
                        pages JSON,
                        PRIMARY KEY (meeting_id, position),
                        FOREIGN KEY(meeting_id) REFERENCES meetings (id)
                    );
                """))

                # 获取所有会议
                meetings = db.query(models.Meeting).all()
                print(f"找到 {len(meetings)} 个会议")

                # 遍历每个会议
                for meeting in meetings:
                    print(f"\n处理会议: {meeting.id} - {meeting.title}")

                    # 获取会议的所有议程项
                    agenda_items = db.query(models.AgendaItem).filter(
                        models.AgendaItem.meeting_id == meeting.id
                    ).all()

                    print(f"  找到 {len(agenda_items)} 个议程项")

                    # 将数据插入到临时表
                    for position, item in enumerate(agenda_items, start=1):
                        print(f"  处理议程项 {item.id} -> 位置 {position}")

                        # 插入数据
                        conn.execute(text(f"""
                            INSERT INTO agenda_items_temp (meeting_id, position, title, files, reporter, duration_minutes, pages)
                            VALUES ('{meeting.id}', {position}, '{item.title.replace("'", "''")}', '{json.dumps(item.files) if item.files else "null"}', '{item.reporter if item.reporter else ""}', {item.duration_minutes if item.duration_minutes else "null"}, '{json.dumps(item.pages) if item.pages else "null"}');
                        """))

                # 删除原表
                conn.execute(text("""
                    DROP TABLE agenda_items;
                """))

                # 重命名临时表
                conn.execute(text("""
                    ALTER TABLE agenda_items_temp RENAME TO agenda_items;
                """))

                print("表结构迁移完成")

        # 获取所有会议
        meetings = db.query(models.Meeting).all()
        print(f"找到 {len(meetings)} 个会议")

        # 遍历每个会议处理文件夹
        for meeting in meetings:
            print(f"\n处理会议文件夹: {meeting.id} - {meeting.title}")

            # 获取会议的所有议程项
            agenda_items = db.query(models.AgendaItem).filter(
                models.AgendaItem.meeting_id == meeting.id
            ).all()

            print(f"  找到 {len(agenda_items)} 个议程项")

            # 遍历议程项处理文件夹
            for position, item in enumerate(agenda_items, start=1):
                print(f"  处理议程项文件夹 -> 位置 {position}")

                # 重命名文件夹
                uploads_dir = os.path.join("uploads", meeting.id)
                old_folder = os.path.join(uploads_dir, f"agenda_{item.id}")
                new_folder = os.path.join(uploads_dir, f"agenda_{position}")

                if os.path.exists(old_folder):
                    if os.path.exists(new_folder):
                        print(f"    警告: 目标文件夹已存在，合并文件: {new_folder}")
                        # 合并文件夹内容
                        for root, dirs, files in os.walk(old_folder):
                            for file in files:
                                src_path = os.path.join(root, file)
                                # 计算相对路径
                                rel_path = os.path.relpath(src_path, old_folder)
                                dst_path = os.path.join(new_folder, rel_path)

                                # 确保目标目录存在
                                os.makedirs(os.path.dirname(dst_path), exist_ok=True)

                                # 复制文件
                                if not os.path.exists(dst_path):
                                    shutil.copy2(src_path, dst_path)
                                    print(f"      复制文件: {rel_path}")

                        # 删除旧文件夹
                        shutil.rmtree(old_folder)
                        print(f"      删除旧文件夹: {old_folder}")
                    else:
                        # 直接重命名文件夹
                        print(f"    重命名文件夹: {old_folder} -> {new_folder}")
                        shutil.move(old_folder, new_folder)
                else:
                    print(f"    警告: 议程项文件夹不存在: {old_folder}")

            # 提交更改
            db.commit()
            print(f"  会议 {meeting.id} 的议程项迁移完成")

        print("\n所有议程项迁移完成")

    except Exception as e:
        db.rollback()
        print(f"迁移过程中发生错误: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    # 确认是否继续
    confirm = input("此操作将修改数据库结构并重命名文件夹，请确认是否继续 (y/n): ")
    if confirm.lower() != 'y':
        print("操作已取消")
        sys.exit(0)

    # 执行迁移
    migrate_agenda_items()
    print("迁移完成")
