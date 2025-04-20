from sqlalchemy.orm import Session
from database import SessionLocal
import models

def list_meetings():
    """列出所有会议"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 查询所有会议
        meetings = db.query(models.Meeting).all()
        
        print(f"共找到 {len(meetings)} 个会议:")
        for meeting in meetings:
            print(f"ID: {meeting.id}, 标题: {meeting.title}, 状态: {meeting.status}")
            
    except Exception as e:
        print(f"发生错误: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    # 运行查询
    list_meetings()
