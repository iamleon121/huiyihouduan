import asyncio
import sys
from sqlalchemy.orm import Session
from database import SessionLocal
from services.meeting_service import MeetingService

# 测试会议ID
MEETING_ID = "a69f2e2d-a741-43d8-85cb-5b289b0e0ce2"  # 实际的会议ID

async def test_generate_package():
    """测试为会议预生成ZIP包"""
    # 创建数据库会话
    db = SessionLocal()

    try:
        print(f"开始为会议 {MEETING_ID} 预生成ZIP包")

        # 调用生成ZIP包的方法
        success = await MeetingService.generate_meeting_package(db, MEETING_ID)

        if success:
            print("ZIP包生成成功！")
            return 0
        else:
            print("ZIP包生成失败！")
            return 1
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_generate_package())
    sys.exit(exit_code)
