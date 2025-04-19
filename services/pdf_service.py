"""
PDF服务模块，包含PDF处理相关的业务逻辑

此模块提供PDF文件处理的服务，包括PDF转JPG、上传临时PDF文件等功能。
"""
import os
import tempfile
import uuid
import shutil
import io
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
import fitz  # PyMuPDF

# 获取项目根目录
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

# 上传目录
UPLOAD_DIR = os.path.join(project_root, "uploads")
# 临时使用uploads/temp目录
TEMP_DIR = os.path.join(UPLOAD_DIR, "temp")
IMAGES_DIR = TEMP_DIR

class PDFService:
    """PDF服务类，处理PDF相关的业务逻辑"""

    @staticmethod
    async def upload_pdf(file: UploadFile) -> Dict[str, Any]:
        """
        处理PDF文件上传

        将上传的PDF文件保存到'uploads'目录。只接受PDF格式的文件。

        Args:
            file (UploadFile): 上传的文件对象

        Returns:
            Dict[str, Any]: 包含操作结果的字典，成功时返回info字段，失败时返回error字段
        """
        # 检查文件扩展名
        if not file.filename.lower().endswith(".pdf"):
            return {"error": "只允许上传 PDF 文件。"}

        file_location = os.path.join(UPLOAD_DIR, file.filename)
        try:
            with open(file_location, "wb+") as file_object:
                shutil.copyfileobj(file.file, file_object)
        except Exception as e:
            return {"error": f"保存文件时出错: {e}"}
        finally:
            # 确保文件指针关闭
            await file.close()

        return {"info": f"文件 '{file.filename}' 已成功保存到 '{file_location}'"}

    @staticmethod
    async def convert_pdf_to_jpg_files(
        file: UploadFile,
        dpi: int = 200,
        format: str = "jpg",
        merge: bool = False
    ) -> Dict[str, Any]:
        """
        将上传的PDF文件转换为JPG图片，使用PyMuPDF库实现，不依赖本地poppler环境

        Args:
            file (UploadFile): 上传的PDF文件
            dpi (int): 输出图片的DPI值，默认为200
            format (str): 输出图片的格式，默认为jpg
            merge (bool): 是否将所有页面合并为一个长图，默认为False

        Returns:
            Dict[str, Any]: 包含转换结果的字典
        """
        # 检查文件类型
        if not file.filename.lower().endswith(".pdf"):
            return JSONResponse(status_code=400, content={"error": "只允许上传PDF文件"})

        # 创建唯一的文件夹名称，用于存储转换后的图片
        unique_id = str(uuid.uuid4())
        output_folder = os.path.join(IMAGES_DIR, unique_id)
        os.makedirs(output_folder, exist_ok=True)

        # 保存上传的PDF文件到临时位置
        temp_pdf_path = os.path.join(tempfile.gettempdir(), f"{unique_id}.pdf")
        try:
            with open(temp_pdf_path, "wb+") as pdf_file:
                shutil.copyfileobj(file.file, pdf_file)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"保存PDF文件时出错: {str(e)}"})
        finally:
            await file.close()

        # 计算缩放因子，基于DPI
        zoom_factor = dpi / 72.0  # 72 DPI是PDF的默认分辨率

        # 存储转换结果
        image_results = []

        try:
            # 打开PDF文件
            pdf_document = fitz.open(temp_pdf_path)

            # 如果选择合并模式，将所有页面合并为一个长图
            if merge:
                # 创建一个列表来存储所有页面的图像
                page_images = []
                total_height = 0
                max_width = 0

                # 处理每一页
                for page_num in range(len(pdf_document)):
                    page = pdf_document.load_page(page_num)
                    matrix = fitz.Matrix(zoom_factor, zoom_factor)
                    pixmap = page.get_pixmap(matrix=matrix, alpha=False)

                    # 将pixmap转换为PIL Image
                    img = Image.open(io.BytesIO(pixmap.tobytes()))
                    page_images.append(img)

                    # 更新总高度和最大宽度
                    total_height += img.height
                    max_width = max(max_width, img.width)

                # 创建一个新的空白图像，高度是所有页面的总和
                merged_image = Image.new('RGB', (max_width, total_height), (255, 255, 255))

                # 将每一页粘贴到新图像上
                y_offset = 0
                for img in page_images:
                    merged_image.paste(img, (0, y_offset))
                    y_offset += img.height

                # 保存合并后的图像
                merged_filename = "merged.jpg"
                merged_path = os.path.join(output_folder, merged_filename)
                merged_image.save(merged_path, "JPEG")

                # 获取相对路径，用于URL
                rel_path = os.path.relpath(merged_path, project_root)
                url_path = f"/{rel_path.replace(os.sep, '/')}"  # 使用正斜杠作为URL路径分隔符

                return {
                    "merged_jpg_url": url_path,
                    "merged_jpg_path": merged_path
                }
            else:
                # 原来的逻辑：单独处理每一页
                for page_num in range(len(pdf_document)):
                    page = pdf_document.load_page(page_num)

                    # 创建一个矩阵来应用缩放
                    matrix = fitz.Matrix(zoom_factor, zoom_factor)

                    # 渲染页面为像素图
                    pixmap = page.get_pixmap(matrix=matrix, alpha=False)

                    # 构建输出文件路径
                    image_filename = f"page_{page_num + 1}.{format.lower()}"
                    image_path = os.path.join(output_folder, image_filename)

                    # 保存图像
                    if format.lower() == "jpg":
                        pixmap.save(image_path, "jpeg")
                    else:
                        pixmap.save(image_path)

                    # 获取相对路径，用于URL
                    rel_path = os.path.relpath(image_path, project_root)
                    url_path = f"/{rel_path.replace(os.sep, '/')}"

                    image_results.append({
                        "url": url_path,
                        "filename": image_filename,
                        "page": page_num + 1
                    })

                return {"jpg_files": image_results}

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            return JSONResponse(
                status_code=500,
                content={
                    "error": f"PDF转换失败: {str(e)}",
                    "details": error_details
                }
            )
        finally:
            # 清理临时PDF文件
            try:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)
            except:
                pass

    @staticmethod
    async def upload_temp_files(files: List[UploadFile]) -> Dict[str, Any]:
        """
        上传临时文件，不关联到特定会议或议程项
        文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件

        Args:
            files (List[UploadFile]): 上传的文件列表

        Returns:
            Dict[str, Any]: 包含上传结果的字典
        """
        # 创建临时文件存储目录
        os.makedirs(TEMP_DIR, exist_ok=True)

        uploaded_files = []

        # 获取现有临时文件列表，用于去重
        existing_files = {}
        for filename in os.listdir(TEMP_DIR):
            if filename.endswith(".pdf"):
                # 提取原始文件名（去除UUID前缀）
                original_name = "_".join(filename.split("_")[1:]) if "_" in filename else filename
                existing_files[original_name] = {
                    "full_path": os.path.join(TEMP_DIR, filename),
                    "filename": filename,
                    "uuid": filename.split("_")[0] if "_" in filename else ""
                }

        print(f"现有临时文件: {len(existing_files)}个")

        try:
            for file in files:
                # 检查文件类型
                if not file.filename.lower().endswith(".pdf"):
                    continue  # 跳过非PDF文件

                # 检查文件是否已存在
                if file.filename in existing_files:
                    print(f"文件已存在: {file.filename}，复用现有文件")
                    existing_file = existing_files[file.filename]
                    file_path = existing_file["full_path"]
                    file_uuid = existing_file["uuid"]
                    safe_filename = existing_file["filename"]

                    # 获取文件大小
                    file_size = os.path.getsize(file_path)

                    # 添加到上传文件列表（复用现有文件）
                    uploaded_files.append({
                        "name": file.filename,
                        "path": file_path,
                        "size": file_size,
                        "url": f"/uploads/temp/{safe_filename}",
                        "display_name": file.filename,  # 使用原始文件名作为显示名称
                        "temp_id": file_uuid,  # 使用现有文件的UUID
                        "reused": True  # 标记为复用的文件
                    })
                else:
                    # 生成唯一文件名
                    file_uuid = str(uuid.uuid4())
                    safe_filename = f"{file_uuid}_{file.filename}"
                    file_path = os.path.join(TEMP_DIR, safe_filename)

                    # 保存文件
                    with open(file_path, "wb+") as file_object:
                        shutil.copyfileobj(file.file, file_object)

                    # 获取文件大小
                    file_size = os.path.getsize(file_path)

                    # 添加到上传文件列表
                    uploaded_files.append({
                        "name": file.filename,
                        "path": file_path,
                        "size": file_size,
                        "url": f"/uploads/temp/{safe_filename}",
                        "display_name": file.filename,  # 使用原始文件名作为显示名称
                        "temp_id": file_uuid  # 临时ID，用于后续关联
                    })

                # 关闭文件
                await file.close()

            return {"status": "success", "uploaded_files": uploaded_files}

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    @staticmethod
    async def convert_pdf_to_jpg_for_pad(pdf_path: str, output_dir: str, dpi: int = 200) -> Optional[str]:
        """
        将PDF文件转换为JPG长图，用于无线平板显示。
        将PDF的所有页面垂直拼接成一个长图，而不是每页一个JPG文件。

        Args:
            pdf_path (str): PDF文件的完整路径
            output_dir (str): 输出JPG文件的目录
            dpi (int, optional): 转换的DPI值，默认200

        Returns:
            Optional[str]: 转换后的JPG长图文件路径，失败时返回None
        """
        print(f"[PDF转JPG] 开始转换为长图: {pdf_path}")

        try:
            # 确保输出目录存在
            os.makedirs(output_dir, exist_ok=True)

            # 从PDF路径中提取文件名（不含扩展名）
            pdf_filename = os.path.basename(pdf_path)
            pdf_basename = os.path.splitext(pdf_filename)[0]

            # 创建与PDF同名的JPG文件名
            jpg_filename = f"{pdf_basename}.jpg"

            # 打开PDF文件
            pdf_document = fitz.open(pdf_path)

            # 存储所有页面的PIL图像对象
            pil_images = []
            total_height = 0
            width = 1920  # 统一宽度为1920像素

            # 首先转换所有页面并计算总高度
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)

                # 计算缩放比例以获得1920像素宽度
                rect = page.rect
                page_width = rect.width
                scale_factor = 1920 / page_width

                # 创建一个矩阵来应用缩放
                matrix = fitz.Matrix(scale_factor, scale_factor)

                # 渲染页面为像素图
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)

                # 将pixmap转换为PIL图像
                img_data = pixmap.tobytes("jpeg")
                img = Image.open(io.BytesIO(img_data))
                pil_images.append(img)

                # 累加高度
                total_height += img.height

            # 创建一个新的空白图像，高度是所有页面高度的总和
            merged_image = Image.new('RGB', (width, total_height))

            # 将所有页面垂直拼接
            y_offset = 0
            for img in pil_images:
                merged_image.paste(img, (0, y_offset))
                y_offset += img.height

            # 保存合并后的长图，使用与PDF同名的文件名
            merged_path = os.path.join(output_dir, jpg_filename)
            merged_image.save(merged_path, "JPEG")

            # 关闭PDF文档
            pdf_document.close()

            print(f"[PDF转JPG] 转换完成: {pdf_path} -> 合并为长图 {merged_path}")
            return merged_path

        except Exception as e:
            print(f"[PDF转JPG] 转换失败: {pdf_path}, 错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

    @staticmethod
    def convert_pdf_to_jpg_for_pad_sync(pdf_path: str, output_dir: str, dpi: int = 200) -> Optional[str]:
        """
        同步版本的PDF转JPG函数，内部创建新的事件循环来执行异步操作。

        Args:
            pdf_path (str): PDF文件的完整路径
            output_dir (str): 输出JPG文件的目录
            dpi (int, optional): 转换的DPI值，默认200

        Returns:
            Optional[str]: 转换后的JPG长图文件路径，失败时返回None
        """
        try:
            # 创建一个新的事件循环
            loop = asyncio.new_event_loop()
            # 在新的事件循环中运行异步函数
            result = loop.run_until_complete(PDFService.convert_pdf_to_jpg_for_pad(pdf_path, output_dir, dpi))
            # 关闭事件循环
            loop.close()
            return result
        except Exception as e:
            print(f"[PDF转JPG同步调用] 出错: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

    @staticmethod
    def ensure_jpg_for_pdf(pdf_path: str, jpg_dir: str) -> Optional[str]:
        """
        确保PDF文件有对应的JPG文件，如果没有则生成。

        Args:
            pdf_path (str): PDF文件路径
            jpg_dir (str): JPG文件存储目录

        Returns:
            Optional[str]: 生成的JPG文件路径，如果生成失败则返回None
        """
        if not os.path.exists(pdf_path) or not pdf_path.lower().endswith(".pdf"):
            return None

        # 确保JPG目录存在
        os.makedirs(jpg_dir, exist_ok=True)

        # 检查是否已有JPG文件
        for filename in os.listdir(jpg_dir):
            if filename.endswith(".jpg"):
                return os.path.join(jpg_dir, filename)

        # 如果没有JPG文件，生成新的
        return PDFService.convert_pdf_to_jpg_for_pad_sync(pdf_path, jpg_dir)

    @staticmethod
    def ensure_jpg_in_zip(zipf, agenda_item_id: int, pdf_uuid: str, jpg_dir: str,
                         original_pdf_name: Optional[str] = None, pdf_path: Optional[str] = None) -> bool:
        """
        确保ZIP包中包含JPG文件，如果没有则生成。

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
        # 如果提供PDF路径，先确保有JPG文件
        jpg_path = None
        if pdf_path and os.path.exists(pdf_path):
            jpg_path = PDFService.ensure_jpg_for_pdf(pdf_path, jpg_dir)

        # 如果没有找到JPG文件，检查目录中是否有JPG文件
        if not jpg_path and os.path.exists(jpg_dir):
            for filename in os.listdir(jpg_dir):
                if filename.endswith('.jpg'):
                    jpg_path = os.path.join(jpg_dir, filename)
                    break

        # 如果找到了JPG文件，添加到ZIP包中
        if jpg_path and os.path.exists(jpg_path):
            filename = os.path.basename(jpg_path)

            # 确定在ZIP中的路径
            if original_pdf_name:
                # 使用原PDF的基本名称（不包含扩展名）
                pdf_basename = os.path.splitext(original_pdf_name)[0]
                if filename == "merged.jpg":
                    # 为merged.jpg添加有意义的名称
                    zip_jpg_path = f"agenda_{agenda_item_id}/{pdf_basename}.jpg"
                else:
                    # 保留其他JPG的名称
                    zip_jpg_path = f"agenda_{agenda_item_id}/{filename.split('_')[-1] if '_' in filename else filename}"
            else:
                # 如果找不到原始PDF名称，使用UUID和JPG文件名
                zip_jpg_path = f"agenda_{agenda_item_id}/{pdf_uuid}_{filename}"

            # 添加JPG文件到ZIP
            zipf.write(jpg_path, zip_jpg_path)
            return True

        return False
