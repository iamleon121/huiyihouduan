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
        使用异步IO操作保存文件，避免阻塞事件循环。

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
            # 使用异步IO操作保存文件
            from services.async_utils import AsyncUtils

            # 读取文件内容
            content = await file.read()

            # 使用线程池异步写入文件
            async def write_file(path, data):
                def _write_file(path, data):
                    with open(path, "wb") as f:
                        f.write(data)
                await AsyncUtils.run_in_threadpool(_write_file, path, data)

            await write_file(file_location, content)
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
        使用异步IO和线程池处理文件和CPU密集型操作，避免阻塞事件循环。

        Args:
            file (UploadFile): 上传的PDF文件
            dpi (int): 输出图片的DPI值，默认为200
            format (str): 输出图片的格式，默认为jpg
            merge (bool): 是否将所有页面合并为一个长图，默认为False

        Returns:
            Dict[str, Any]: 包含转换结果的字典
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 检查文件类型
        if not file.filename.lower().endswith(".pdf"):
            return JSONResponse(status_code=400, content={"error": "只允许上传PDF文件"})

        # 创建唯一的文件夹名称，用于存储转换后的图片
        unique_id = str(uuid.uuid4())
        output_folder = os.path.join(IMAGES_DIR, unique_id)

        # 使用线程池创建目录
        await AsyncUtils.run_in_threadpool(lambda: os.makedirs(output_folder, exist_ok=True))

        # 保存上传的PDF文件到临时位置
        temp_pdf_path = os.path.join(tempfile.gettempdir(), f"{unique_id}.pdf")
        try:
            # 读取文件内容
            content = await file.read()

            # 使用线程池异步写入文件
            await AsyncUtils.run_in_threadpool(
                lambda: open(temp_pdf_path, "wb").write(content)
            )
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"保存PDF文件时出错: {str(e)}"})
        finally:
            await file.close()

        # 计算缩放因子，基于DPI
        zoom_factor = dpi / 72.0  # 72 DPI是PDF的默认分辨率

        # 存储转换结果
        image_results = []

        try:
            # 使用线程池打开PDF文件，这是CPU密集型操作
            async def open_pdf_in_threadpool():
                return await AsyncUtils.run_in_threadpool(lambda: fitz.open(temp_pdf_path))

            pdf_document = await open_pdf_in_threadpool()

            # 如果选择合并模式，将所有页面合并为一个长图
            if merge:
                # 创建一个列表来存储所有页面的图像
                page_images = []
                total_height = 0
                max_width = 0

                # 处理每一页，使用线程池处理CPU密集型操作
                async def process_page(page_num):
                    def _process_page(page_num):
                        page = pdf_document.load_page(page_num)
                        matrix = fitz.Matrix(zoom_factor, zoom_factor)
                        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                        img = Image.open(io.BytesIO(pixmap.tobytes()))
                        return img
                    return await AsyncUtils.run_in_threadpool(_process_page, page_num)

                # 并行处理所有页面，但限制并发数量为4，避免内存溢出
                tasks = [process_page(page_num) for page_num in range(len(pdf_document))]
                processed_images = await AsyncUtils.gather_with_concurrency(4, *tasks)

                for img in processed_images:
                    page_images.append(img)
                    total_height += img.height
                    max_width = max(max_width, img.width)

                # 使用线程池创建并保存合并图像
                async def create_and_save_merged_image():
                    def _create_and_save():
                        # 创建一个新的空白图像
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

                        return url_path, merged_path

                    return await AsyncUtils.run_in_threadpool(_create_and_save)

                url_path, merged_path = await create_and_save_merged_image()

                return {
                    "merged_jpg_url": url_path,
                    "merged_jpg_path": merged_path
                }
            else:
                # 单独处理每一页，使用并行处理提高性能
                async def process_page_to_file(page_num):
                    def _process_page_to_file(page_num):
                        page = pdf_document.load_page(page_num)
                        matrix = fitz.Matrix(zoom_factor, zoom_factor)
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

                        return {
                            "url": url_path,
                            "filename": image_filename,
                            "page": page_num + 1
                        }

                    return await AsyncUtils.run_in_threadpool(_process_page_to_file, page_num)

                # 并行处理所有页面，但限制并发数量为4
                tasks = [process_page_to_file(page_num) for page_num in range(len(pdf_document))]
                image_results = await AsyncUtils.gather_with_concurrency(4, *tasks)

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
            # 清理临时PDF文件，使用线程池异步删除
            try:
                if os.path.exists(temp_pdf_path):
                    await AsyncUtils.run_in_threadpool(lambda: os.remove(temp_pdf_path))
            except:
                pass

    @staticmethod
    async def upload_temp_files(files: List[UploadFile]) -> Dict[str, Any]:
        """
        上传临时文件，不关联到特定会议或议程项
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。

        Args:
            files (List[UploadFile]): 上传的文件列表

        Returns:
            Dict[str, Any]: 包含上传结果的字典
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 使用线程池创建临时文件存储目录
        await AsyncUtils.run_in_threadpool(lambda: os.makedirs(TEMP_DIR, exist_ok=True))

        uploaded_files = []

        # 不再检查现有临时文件，允许相同文件再次上传
        print("有临时文件: 0个")

        try:
            # 并行处理所有文件上传
            async def process_file(file):
                # 检查文件类型
                if not file.filename.lower().endswith(".pdf"):
                    await file.close()
                    return None  # 跳过非PDF文件

                # 不再检查文件是否已存在，允许相同文件再次上传
                # 生成唯一文件名
                file_uuid = str(uuid.uuid4())
                safe_filename = f"{file_uuid}_{file.filename}"
                file_path = os.path.join(TEMP_DIR, safe_filename)

                # 读取文件内容
                content = await file.read()

                # 使用线程池异步写入文件
                await AsyncUtils.run_in_threadpool(
                    lambda: open(file_path, "wb").write(content)
                )

                # 使用线程池获取文件大小
                file_size = await AsyncUtils.run_in_threadpool(lambda: os.path.getsize(file_path))

                # 关闭文件
                await file.close()

                # 添加到上传文件列表
                return {
                    "name": file.filename,
                    "path": file_path,
                    "size": file_size,
                    "url": f"/uploads/temp/{safe_filename}",
                    "display_name": file.filename,  # 使用原始文件名作为显示名称
                    "temp_id": file_uuid  # 临时ID，用于后续关联
                }

            # 并行处理所有文件，但限制并发数量为4
            tasks = [process_file(file) for file in files]
            results = await AsyncUtils.gather_with_concurrency(4, *tasks)

            # 过滤掉None结果（非PDF文件）
            uploaded_files = [result for result in results if result is not None]

            return {"status": "success", "uploaded_files": uploaded_files}

        except Exception as e:
            # 确保所有文件都关闭
            for file in files:
                try:
                    await file.close()
                except:
                    pass
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    @staticmethod
    async def convert_pdf_to_jpg_for_pad(pdf_path: str, output_dir: str, width: int = None) -> Optional[str]:
        """
        将PDF文件转换为JPG长图，用于无线平板显示。
        注意：此方法已被修改为不执行实际的转换，只返回PDF文件路径。
        这是为了减少文件大小，因为JPG文件通常比PDF文件大得多。

        Args:
            pdf_path (str): PDF文件的完整路径
            output_dir (str): 输出JPG文件的目录（不再使用）
            width (int, optional): 输出图片的宽度（不再使用）

        Returns:
            Optional[str]: 原始PDF文件路径，失败时返回None
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        try:
            # 检查PDF文件是否存在
            pdf_exists = await AsyncUtils.run_in_threadpool(
                lambda: os.path.exists(pdf_path) and pdf_path.lower().endswith(".pdf")
            )

            if not pdf_exists:
                print(f"警告: PDF文件不存在或不是PDF格式: {pdf_path}")
                return None

            # 确保输出目录存在（为了兼容性）
            await AsyncUtils.run_in_threadpool(lambda: os.makedirs(output_dir, exist_ok=True))

            # 提取文件名信息（为了兼容性）
            async def get_file_info():
                def _get_file_info():
                    pdf_filename = os.path.basename(pdf_path)
                    pdf_basename = os.path.splitext(pdf_filename)[0]
                    jpg_filename = f"{pdf_basename}.jpg"
                    return jpg_filename
                return await AsyncUtils.run_in_threadpool(_get_file_info)

            jpg_filename = await get_file_info()

            # 创建一个空的占位JPG文件，以保持目录结构一致
            placeholder_path = os.path.join(output_dir, jpg_filename)

            # 检查占位文件是否已存在
            placeholder_exists = await AsyncUtils.run_in_threadpool(
                lambda: os.path.exists(placeholder_path)
            )

            if not placeholder_exists:
                # 创建一个1x1像素的空白JPG文件作为占位符
                await AsyncUtils.run_in_threadpool(
                    lambda: Image.new('RGB', (1, 1), color='white').save(placeholder_path, "JPEG")
                )
                print(f"创建了占位JPG文件: {placeholder_path}")

            print(f"跳过PDF转JPG，直接使用PDF文件: {pdf_path}")

            # 返回原始PDF文件路径，而不是JPG文件路径
            # 这样可以在后续处理中直接使用PDF文件
            return pdf_path

        except Exception as e:
            import traceback
            print(f"处理PDF文件时出错: {str(e)}")
            print(traceback.format_exc())
            return None

    @staticmethod
    def convert_pdf_to_jpg_for_pad_sync(pdf_path: str, output_dir: str, width: int = None) -> Optional[str]:
        """
        同步版本的PDF转JPG函数，使用AsyncUtils来执行异步操作。
        注意：此方法已被修改为不执行实际的转换，只返回PDF文件路径。

        Args:
            pdf_path (str): PDF文件的完整路径
            output_dir (str): 输出JPG文件的目录（不再使用）
            width (int, optional): 输出图片的宽度（不再使用）

        Returns:
            Optional[str]: 原始PDF文件路径，失败时返回None
        """
        try:
            # 使用AsyncUtils来运行异步函数
            from services.async_utils import AsyncUtils
            return AsyncUtils.run_sync(PDFService.convert_pdf_to_jpg_for_pad, pdf_path, output_dir, width)
        except Exception:
            import traceback
            print(f"同步处理PDF文件时出错: {pdf_path}")
            print(traceback.format_exc())
            return None

    @staticmethod
    async def get_pdf_page_count(pdf_path: str) -> Optional[int]:
        """
        获取PDF文件的总页数
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。

        Args:
            pdf_path (str): PDF文件路径

        Returns:
            Optional[int]: PDF文件的总页数，如果获取失败则返回None
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        try:
            # 使用线程池检查文件是否存在和扩展名
            check_result = await AsyncUtils.run_in_threadpool(
                lambda: os.path.exists(pdf_path) and pdf_path.lower().endswith(".pdf")
            )

            if not check_result:
                return None

            # 使用线程池打开PDF文件并获取页数
            async def get_page_count():
                def _get_page_count():
                    with fitz.open(pdf_path) as pdf_document:
                        return len(pdf_document)
                return await AsyncUtils.run_in_threadpool(_get_page_count)

            page_count = await get_page_count()
            return page_count

        except Exception as e:
            print(f"获取PDF页数失败: {pdf_path}, 错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

    @staticmethod
    def get_pdf_page_count_sync(pdf_path: str) -> Optional[int]:
        """
        同步版本的获取PDF页数函数，使用AsyncUtils来执行异步操作。

        Args:
            pdf_path (str): PDF文件的完整路径

        Returns:
            Optional[int]: PDF文件的总页数，如果获取失败则返回None
        """
        try:
            # 使用AsyncUtils来运行异步函数
            from services.async_utils import AsyncUtils
            return AsyncUtils.run_sync(PDFService.get_pdf_page_count, pdf_path)
        except Exception as e:
            print(f"同步获取PDF页数失败: {pdf_path}, 错误: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

    @staticmethod
    async def ensure_jpg_for_pdf(pdf_path: str, jpg_dir: str, width: int = None) -> Optional[str]:
        """
        确保PDF文件有对应的JPG文件，如果没有则生成。
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。

        Args:
            pdf_path (str): PDF文件路径
            jpg_dir (str): JPG文件存储目录
            width (int, optional): 输出图片的宽度，如果为None则使用系统默认设置，可选值：960, 1440, 1920

        Returns:
            Optional[str]: 生成的JPG文件路径，如果生成失败则返回None
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 如果未指定宽度，从系统设置获取默认值
        if width is None:
            # 创建数据库会话
            from database import SessionLocal
            import crud

            db = SessionLocal()
            try:
                # 获取默认分辨率设置，如果不存在则使用1920作为默认值
                default_width_str = crud.get_system_setting(db, "default_pdf_jpg_width", "1920")
                width = int(default_width_str)
            finally:
                db.close()

        # 验证宽度参数，确保只能是960, 1440或1920
        valid_widths = [960, 1440, 1920]
        if width not in valid_widths:
            print(f"警告: 无效的宽度值 {width}，将使用默认值1920")
            width = 1920

        # 使用线程池检查文件是否存在和扩展名
        check_result = await AsyncUtils.run_in_threadpool(
            lambda: os.path.exists(pdf_path) and pdf_path.lower().endswith(".pdf")
        )

        if not check_result:
            return None

        # 使用线程池确保JPG目录存在
        await AsyncUtils.run_in_threadpool(lambda: os.makedirs(jpg_dir, exist_ok=True))

        # 使用线程池检查是否已有JPG文件
        async def check_existing_jpg():
            def _check_existing_jpg():
                for filename in os.listdir(jpg_dir):
                    if filename.endswith(".jpg"):
                        return os.path.join(jpg_dir, filename)
                return None
            return await AsyncUtils.run_in_threadpool(_check_existing_jpg)

        existing_jpg = await check_existing_jpg()
        if existing_jpg:
            return existing_jpg

        # 如果没有JPG文件，生成新的
        return await PDFService.convert_pdf_to_jpg_for_pad(pdf_path, jpg_dir, width)

    @staticmethod
    async def ensure_jpg_in_zip(zipf, agenda_item_id: int, pdf_uuid: str, jpg_dir: str,
                         original_pdf_name: Optional[str] = None, pdf_path: Optional[str] = None, width: int = None) -> bool:
        """
        确保ZIP包中包含JPG文件，如果没有则生成。
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。

        Args:
            zipf: ZIP文件对象
            agenda_item_id (int): 议程项ID
            pdf_uuid (str): PDF文件UUID
            jpg_dir (str): JPG文件存储目录
            original_pdf_name (str, optional): 原PDF文件名
            pdf_path (str, optional): PDF文件路径
            width (int, optional): 输出图片的宽度，如果为None则使用系统默认设置，可选值：960, 1440, 1920

        Returns:
            bool: 是否成功添加JPG文件到ZIP包
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 如果未指定宽度，从系统设置获取默认值
        if width is None:
            # 创建数据库会话
            from database import SessionLocal
            import crud

            db = SessionLocal()
            try:
                # 获取默认分辨率设置，如果不存在则使用1920作为默认值
                default_width_str = crud.get_system_setting(db, "default_pdf_jpg_width", "1920")
                width = int(default_width_str)
            finally:
                db.close()

        # 验证宽度参数，确保只能是960, 1440或1920
        valid_widths = [960, 1440, 1920]
        if width not in valid_widths:
            print(f"警告: 无效的宽度值 {width}，将使用默认值1920")
            width = 1920

        # 如果提供PDF路径，先确保有JPG文件
        jpg_path = None
        if pdf_path:
            # 使用线程池检查文件是否存在
            pdf_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(pdf_path))
            if pdf_exists:
                jpg_path = await PDFService.ensure_jpg_for_pdf(pdf_path, jpg_dir, width)

        # 如果没有找到JPG文件，检查目录中是否有JPG文件
        if not jpg_path:
            # 使用线程池检查目录是否存在
            dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(jpg_dir))
            if dir_exists:
                # 使用线程池查找JPG文件
                async def find_jpg_file():
                    def _find_jpg_file():
                        for filename in os.listdir(jpg_dir):
                            if filename.endswith('.jpg'):
                                return os.path.join(jpg_dir, filename)
                        return None
                    return await AsyncUtils.run_in_threadpool(_find_jpg_file)

                jpg_path = await find_jpg_file()

        # 如果找到了JPG文件，添加到ZIP包中
        if jpg_path:
            # 使用线程池检查文件是否存在
            jpg_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(jpg_path))
            if jpg_exists:
                # 使用线程池处理文件路径和添加到ZIP
                async def add_to_zip():
                    def _add_to_zip():
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
                    return await AsyncUtils.run_in_threadpool(_add_to_zip)

                return await add_to_zip()

        return False
