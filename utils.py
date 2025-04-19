"""
工具函数模块，包含各种通用工具函数。

此模块包含文件处理、格式化和PDF转JPG等通用功能的函数。
这些函数被从main.py中提取出来，以提高代码的模块化和可维护性。
"""

import os
import math

def format_file_size(size_bytes):
    """
    格式化文件大小，将字节数转换为人类可读的格式。

    Args:
        size_bytes (int): 文件大小（字节）

    Returns:
        str: 格式化后的文件大小，如"2.5 MB"
    """
    if size_bytes == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_names[i]}"


# 此函数已移动到services/pdf_service.py中
def ensure_jpg_for_pdf(pdf_path, jpg_dir):
    """
    确保PDF文件有对应的JPG文件，如果没有则生成。

    此函数已移动到services/pdf_service.py中，这里保留仅为兼容性。
    请使用PDFService.ensure_jpg_for_pdf代替。

    Args:
        pdf_path (str): PDF文件路径
        jpg_dir (str): JPG文件存储目录

    Returns:
        str: 生成的JPG文件路径，如果生成失败则返回None
    """
    # 导入PDFService并调用其方法
    from services.pdf_service import PDFService
    return PDFService.ensure_jpg_for_pdf(pdf_path, jpg_dir)


# 此函数已移动到services/pdf_service.py中
def ensure_jpg_in_zip(zipf, agenda_item_id, pdf_uuid, jpg_dir, original_pdf_name=None, pdf_path=None):
    """
    确保ZIP包中包含JPG文件，如果没有则生成。

    此函数已移动到services/pdf_service.py中，这里保留仅为兼容性。
    请使用PDFService.ensure_jpg_in_zip代替。

    Args:
        zipf: ZIP文件对象
        agenda_item_id (int): 议程项ID
        pdf_uuid (str): PDF文件UUID
        jpg_dir (str): JPG文件存储目录
        original_pdf_name (str, optional): 原PDF文件名
        pdf_path (str, optional): PDF文件路径

    Returns:
        bool: 是否成功添加JPG文件到ZIP包
    """
    # 导入PDFService并调用其方法
    from services.pdf_service import PDFService
    return PDFService.ensure_jpg_in_zip(zipf, agenda_item_id, pdf_uuid, jpg_dir, original_pdf_name, pdf_path)


# 此函数已移动到services/pdf_service.py中
async def convert_pdf_to_jpg_for_pad(pdf_path, output_dir, dpi=200):
    """
    将PDF文件转换为JPG长图，用于无线平板显示。
    将PDF的所有页面垂直拼接成一个长图，而不是每页一个JPG文件。

    此函数已移动到services/pdf_service.py中，这里保留仅为兼容性。
    请使用PDFService.convert_pdf_to_jpg_for_pad代替。

    Args:
        pdf_path (str): PDF文件的完整路径
        output_dir (str): 输出JPG文件的目录
        dpi (int, optional): 转换的DPI值，默认200

    Returns:
        str: 转换后的JPG长图文件路径，失败时返回None
    """
    # 导入PDFService并调用其方法
    from services.pdf_service import PDFService
    return await PDFService.convert_pdf_to_jpg_for_pad(pdf_path, output_dir, dpi)


# 此函数已移动到services/pdf_service.py中
def convert_pdf_to_jpg_for_pad_sync(pdf_path, output_dir, dpi=200):
    """
    同步版本的PDF转JPG函数，内部创建新的事件循环来执行异步操作。

    此函数已移动到services/pdf_service.py中，这里保留仅为兼容性。
    请使用PDFService.convert_pdf_to_jpg_for_pad_sync代替。

    Args:
        pdf_path (str): PDF文件的完整路径
        output_dir (str): 输出JPG文件的目录
        dpi (int, optional): 转换的DPI值，默认200

    Returns:
        str: 转换后的JPG长图文件路径，失败时返回None
    """
    # 导入PDFService并调用其方法
    from services.pdf_service import PDFService
    return PDFService.convert_pdf_to_jpg_for_pad_sync(pdf_path, output_dir, dpi)
