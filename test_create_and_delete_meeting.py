import asyncio
import sys
import json
import requests
import uuid
from sqlalchemy.orm import Session
from database import SessionLocal
import models

async def test_create_and_delete_meeting():
    """测试创建会议，开始会议，然后删除会议 """
    # 创建数据库会话
    db = SessionLocal()

    try:
        # 创建会议
        meeting_id = str(uuid.uuid4())
        meeting_title = f"测试会议 {meeting_id[:8]}"

        # 调用API创建会议
        create_url = "http://localhost:8000/api/v1/meetings/"
        create_data = {
            "id": meeting_id,
            "title": meeting_title,
            "intro": "这是一个测试会议",
            "time": "2023-12-01T12:00:00",
            "status": "未开始"
        }
        headers = {"Content-Type": "application/json"}

        print(f"调用API创建会议: {create_url}")
        create_response = requests.post(create_url, data=json.dumps(create_data), headers=headers)

        if create_response.status_code != 201:
            print(f"会议创建失败！状态码: {create_response.status_code}")
            print(f"错误信息: {create_response.text}")
            return 1

        # 获取创建的会议ID
        meeting_data = create_response.json()
        meeting_id = meeting_data["id"]
        print(f"会议创建成功！ID: {meeting_id}")

        # 开始会议
        start_url = f"http://localhost:8000/api/v1/meetings/{meeting_id}/status"
        start_data = {"status": "进行中"}

        print(f"调用API开始会议: {start_url}")
        start_response = requests.put(start_url, data=json.dumps(start_data), headers=headers)

        if start_response.status_code != 200:
            print(f"会议开始失败！状态码: {start_response.status_code}")
            print(f"错误信息: {start_response.text}")
            return 1

        print("会议开始成功！")

        # 检查ZIP包是否生成
        print("检查ZIP包是否生成...")

        # 删除会议
        delete_url = f"http://localhost:8000/api/v1/meetings/{meeting_id}"

        print(f"调用API删除会议: {delete_url}")
        delete_response = requests.delete(delete_url)

        if delete_response.status_code != 204:
            print(f"会议删除失败！状态码: {delete_response.status_code}")
            print(f"错误信息: {delete_response.text}")
            return 1

        print("会议删除成功！")

        # 检查会议是否已删除
        check_url = f"http://localhost:8000/api/v1/meetings/{meeting_id}"
        check_response = requests.get(check_url)

        if check_response.status_code == 404:
            print("会议已成功删除，无法再次访问")
        else:
            print(f"警告: 会议可能未完全删除，状态码: {check_response.status_code}")

        return 0
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_create_and_delete_meeting())
    sys.exit(exit_code)
