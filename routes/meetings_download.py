from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
import os
import io
import time

from database import get_db
import crud
from services.meeting_service import MeetingService
from node_manager import get_available_nodes, select_node

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings_download"])

@router.get("/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str, db: Session = Depends(get_db)):
    """
    下载会议的JPG文件包，如果有可用节点则重定向到节点

    Args:
        meeting_id: 会议ID

    Returns:
        RedirectResponse: 重定向到分布式节点
        或
        StreamingResponse: ZIP文件流响应（如果没有可用节点）
    """
    # 查询指定会议
    meeting = crud.get_meeting(db, meeting_id=meeting_id)

    # 如果会议不存在，返回404错误
    if not meeting:
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不存在")

    # 如果会议不是进行中状态，返回404错误
    if meeting.status != "进行中":
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不是进行中状态")

    # 检查会议是否有压缩包
    if not meeting.package_path:
        # 如果没有压缩包，尝试生成
        success = await MeetingService.generate_meeting_package(db, meeting_id)
        if not success:
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

        # 重新获取会议信息，因为包路径可能已更新
        db.refresh(meeting)

        # 再次检查是否有压缩包
        if not meeting.package_path:
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

    # 获取可用的分布式节点
    print(f"[下载API] 开始获取可用节点...")
    available_nodes = await get_available_nodes()
    print(f"[下载API] 可用节点数量: {len(available_nodes)}, 节点列表: {available_nodes}")

    if available_nodes:
        # 选择一个分布式节点
        selected_node = select_node(available_nodes)
        print(f"[下载API] 选择的节点: {selected_node}")

        # 构建重定向URL
        node_url = f"http://{selected_node}/api/v1/meetings/{meeting_id}/download-package"
        print(f"[下载API] 重定向URL: {node_url}")

        # 记录重定向信息
        print(f"[下载重定向] 会议 {meeting_id} 的下载请求重定向到节点: {selected_node}")

        # 返回重定向响应，使用状态码302确保客户端跟随重定向
        print(f"[下载API] 返回重定向响应: {node_url}")
        return RedirectResponse(url=node_url, status_code=302)
    else:
        # 如果没有可用节点，使用本地文件
        print(f"[下载本地] 没有可用节点，使用本地文件提供会议 {meeting_id} 的下载")
        return await download_local_package(meeting_id, db)

@router.get("/{meeting_id}/download-package-direct")
async def download_meeting_package_direct(meeting_id: str, db: Session = Depends(get_db)):
    """
    直接下载会议包，不重定向（供分布式节点使用）

    Args:
        meeting_id: 会议ID

    Returns:
        StreamingResponse: ZIP文件流响应
    """
    return await download_local_package(meeting_id, db)

async def download_local_package(meeting_id: str, db: Session):
    """从本地文件系统下载会议包"""
    # 查询指定会议
    meeting = crud.get_meeting(db, meeting_id=meeting_id)

    # 如果会议不存在，返回404错误
    if not meeting:
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不存在")

    # 检查会议是否有压缩包
    if not meeting.package_path or not os.path.exists(meeting.package_path):
        # 如果没有压缩包，尝试生成
        success = await MeetingService.generate_meeting_package(db, meeting_id)
        if not success:
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

        # 重新获取会议信息，因为包路径可能已更新
        db.refresh(meeting)

        # 再次检查是否有压缩包
        if not meeting.package_path or not os.path.exists(meeting.package_path):
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

    # 使用MeetingService下载会议文件包
    zip_buffer = await MeetingService.download_meeting_package(db=db, meeting_id=meeting_id)

    # 准备文件名 - 使用ASCII字符确保兼容性
    # 仅使用会议ID作为文件名，避免中文字符编码问题
    zip_filename = f"meeting_{meeting_id}_jpgs.zip"

    # 准备响应
    headers = {
        'Content-Disposition': f'attachment; filename="{zip_filename}"'
    }

    print(f"[本地下载] 返回会议 {meeting_id} 的压缩包")

    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
