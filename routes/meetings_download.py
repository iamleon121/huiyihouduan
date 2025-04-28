from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
import os
import io
import time

from database import get_db
import crud
from services.meeting_service import MeetingService
from node_manager import get_available_nodes

router = APIRouter(prefix="/api/v1/meetings", tags=["meetings_download"])

@router.get("/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str, db: Session = Depends(get_db)):
    """
    下载会议的JPG文件包

    Args:
        meeting_id: 会议ID

    Returns:
        StreamingResponse: ZIP文件流响应
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

    # 获取可用的分布式节点（仅用于日志记录）
    print(f"[下载API] 开始获取可用节点...")
    available_nodes = await get_available_nodes()
    print(f"[下载API] 可用节点数量: {len(available_nodes)}, 节点列表: {available_nodes}")

    # 记录节点信息（仅用于日志记录）
    # 构建节点信息提示
    nodes_info = f"[下载端点信息] 会议 {meeting_id} 可通过以下端点下载:"

    # 添加主控服务器信息
    host = "localhost:8000"  # 默认值，实际运行时可能不同
    nodes_info += f"\n - {host} (http://{host}/api/v1/meetings/{meeting_id}/download-package)"

    # 添加分布式节点信息
    if available_nodes:
        for node in available_nodes:
            nodes_info += f"\n - {node} (http://{node}/api/v1/meetings/{meeting_id}/download-package)"

    # 添加查看详细信息的提示
    nodes_info += f"\n[提示] 查看所有下载端点: /api/v1/meetings/{meeting_id}/download-nodes-info"

    # 打印节点信息
    print(nodes_info)

    # 直接从本地提供文件下载，不进行重定向
    print(f"[下载本地] 使用本地文件提供会议 {meeting_id} 的下载")
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


@router.get("/{meeting_id}/download-nodes-info")
async def get_download_nodes_info(meeting_id: str, request: Request, db: Session = Depends(get_db)):
    """
    获取可用于下载指定会议文件的所有端点信息

    此API用于获取可用于下载指定会议文件的所有端点信息，包括主控服务器和分布式节点。
    返回简化的端点列表，每个端点只包含IP和下载URL。

    Args:
        meeting_id: 会议ID

    Returns:
        JSONResponse: 包含所有下载端点信息的JSON响应
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
    available_nodes = await get_available_nodes()

    # 获取主控服务器地址（从请求中提取）
    host = request.headers.get("host", "localhost")

    # 准备响应数据 - 简化的下载端点列表
    download_endpoints = []

    # 添加主控服务器下载端点
    download_endpoints.append({
        "ip": host,
        "download_url": f"http://{host}/api/v1/meetings/{meeting_id}/download-package"
    })

    # 添加可用节点信息
    for node in available_nodes:
        download_endpoints.append({
            "ip": node,
            "download_url": f"http://{node}/api/v1/meetings/{meeting_id}/download-package"
        })

    # 返回JSON响应
    return JSONResponse(content=download_endpoints)
