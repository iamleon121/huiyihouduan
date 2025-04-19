"""
PDF转换相关路由

此模块包含所有与PDF转换相关的路由，包括PDF转JPG、PDF合并等功能。
"""

import os
from fastapi import APIRouter, File, UploadFile, Form
from typing import List

# 导入PDF服务
from services.pdf_service import PDFService

# 获取项目根目录
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = current_dir
UPLOAD_DIR = os.path.join(project_root, "uploads")
# 注意：static/converted_images目录已移除，因为它对会议管理模块没有用处
# 临时使用uploads/temp目录代替
IMAGES_DIR = os.path.join(project_root, "uploads", "temp")

# 创建路由器
router = APIRouter(
    prefix="/api/v1/pdf",  # 使用不同的前缀避免与main.py中的路由冲突
    tags=["pdf_conversion"],
    responses={404: {"description": "Not found"}},
)

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    处理PDF文件上传

    将上传的PDF文件保存到'uploads'目录。只接受PDF格式的文件。

    Args:
        file (UploadFile): 上传的文件对象

    Returns:
        dict: 包含操作结果的字典，成功时返回info字段，失败时返回error字段

    Raises:
        无显式异常，但在文件保存失败时返回错误信息
    """
    # 使用PDFService上传PDF文件
    return await PDFService.upload_pdf(file)

@router.post("/convert-to-jpg")
async def convert_pdf_to_jpg(
    file: UploadFile = File(...),
    dpi: int = Form(200),
    format: str = Form("jpg"),
    merge: bool = Form(False)
):
    """
    将上传的PDF文件转换为JPG图片，使用PyMuPDF库实现，不依赖本地poppler环境

    Args:
        file (UploadFile): 上传的PDF文件
        dpi (int): 输出图片的DPI值，默认为200
        format (str): 输出图片的格式，默认为jpg
        merge (bool): 是否将所有页面合并为一个长图，默认为False

    Returns:
        JSONResponse: 包含转换结果的JSON响应
    """
    # 使用PDFService转换PDF文件为JPG
    return await PDFService.convert_pdf_to_jpg_files(file, dpi, format, merge)

@router.post("/upload-temp")
async def upload_temp_files(
    files: List[UploadFile] = File(...)
):
    """
    上传临时文件，不关联到特定会议或议程项
    文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件
    """
    # 使用PDFService上传临时文件
    return await PDFService.upload_temp_files(files)