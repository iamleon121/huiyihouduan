from fastapi import FastAPI, UploadFile, File, Request, Form, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates # Although not strictly needed for just serving index.html, it's common for more complex frontends
import shutil
import os
import uuid
import fitz  # PyMuPDF
import tempfile
from typing import List, Optional
import time
from sqlalchemy.orm import Session

# Import database, models, schemas, crud
import models, schemas, crud
from database import SessionLocal, engine, create_db_tables

# Ensure the uploads directory exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Ensure the converted images directory exists
IMAGES_DIR = "static/converted_images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

# Create database tables on startup (already done by calling create_db_tables directly)
# models.Base.metadata.create_all(bind=engine) # Alternative way

app = FastAPI()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Optional: Add startup event (alternative way to create tables)
# @app.on_event("startup")
# async def startup_event():
#     create_db_tables()


# Mount the static directory to serve static files (like index.html, css, js)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount the uploads directory to serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Optional: Setup Jinja2 templates if you plan more complex HTML rendering later
# templates = Jinja2Templates(directory="static")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    # Serve the index.html file directly
    # For more complex scenarios, you might use templates:
    # return templates.TemplateResponse("index.html", {"request": request})
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: index.html not found</h1>", status_code=404)

@app.get("/pdf2jpg", response_class=HTMLResponse)
async def pdf_to_jpg_page(request: Request):
    """提供PDF转JPG的页面"""
    try:
        with open("static/pdf2jpg.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: pdf2jpg.html not found</h1>", status_code=404)

@app.get("/huiyi", response_class=HTMLResponse)
async def serve_huiyi_page(request: Request):
    """提供会议系统主页面 - 重定向到新的会议管理页面"""
    # 重定向到新的会议管理页面
    return HTMLResponse(
        content='<html><head><meta http-equiv="refresh" content="0;URL=\'static/huiyi-meeting.html\'"></head></html>',
        status_code=200
    )

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    处理 PDF 文件上传。将上传的文件保存到 'uploads' 目录。
    """
    # Basic check for PDF extension
    if not file.filename.lower().endswith(".pdf"):
        return {"error": "只允许上传 PDF 文件。"}

    file_location = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
    except Exception as e:
        return {"error": f"保存文件时出错: {e}"}
    finally:
        # Ensure the file pointer is closed
        await file.close()

    return {"info": f"文件 '{file.filename}' 已成功保存到 '{file_location}'"}

@app.post("/convert-pdf-to-jpg")
async def convert_pdf_to_jpg(
    file: UploadFile = File(...),
    dpi: int = Form(200),
    format: str = Form("jpg"),
    merge: bool = Form(False)
):
    """
    将上传的PDF文件转换为JPG图片，使用PyMuPDF库实现，不依赖本地poppler环境
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

        # 使用PyMuPDF(fitz)转换PDF为图片
        pdf_document = fitz.open(temp_pdf_path)
        image_results = []

        # 计算缩放因子，基于DPI (默认72dpi)
        zoom_factor = dpi / 72

        # 如果需要合并所有页面
        if merge and len(pdf_document) > 1:
            from PIL import Image
            import io

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

            # 保存合并后的图像
            merged_filename = f"merged.{format.lower()}"
            merged_path = os.path.join(output_folder, merged_filename)

            if format.lower() == "jpg":
                merged_image.save(merged_path, "JPEG")
            else:
                merged_image.save(merged_path, format.upper())

            # 获取相对路径，用于URL
            rel_path = os.path.relpath(merged_path, "static")
            url_path = f"/static/{rel_path.replace(os.sep, '/')}"

            image_results.append({
                "url": url_path,
                "filename": merged_filename,
                "page": "all",
                "merged": True
            })
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
                rel_path = os.path.relpath(image_path, "static")
                url_path = f"/static/{rel_path.replace(os.sep, '/')}"

                image_results.append({
                    "url": url_path,
                    "filename": image_filename,
                    "page": page_num + 1
                })

        # 关闭PDF文档
        pdf_document.close()

        return {"images": image_results, "total_pages": len(image_results)}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"转换过程中出错: {str(e)}"})

    finally:
        # 清理临时文件
        await file.close()
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)


# --- Meeting API Endpoints ---

@app.post("/api/meetings/", response_model=schemas.Meeting)
def create_new_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    """创建新会议及其议程项"""
    db_meeting = crud.get_meeting(db, meeting_id=meeting.id)
    if db_meeting:
        raise HTTPException(status_code=400, detail="Meeting ID already registered")

    # 处理临时文件
    process_temp_files_in_meeting(meeting)

    return crud.create_meeting(db=db, meeting=meeting)


def process_temp_files_in_meeting(meeting_data):
    """处理会议中的临时文件，将它们从临时目录移动到正式目录"""
    try:
        print(f"\n\n开始处理新会议 {meeting_data.id} 的临时文件")

        # 创建会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_data.id)
        os.makedirs(meeting_dir, exist_ok=True)
        print(f"创建会议目录: {meeting_dir}")

        # 处理议程项中的临时文件
        if not meeting_data.part:
            print("没有议程项需要处理")
            return

        for i, agenda_item in enumerate(meeting_data.part):
            print(f"\n处理议程项 {i+1}")

            if not agenda_item.files:
                print("该议程项没有文件")
                continue

            print(f"议程项文件数量: {len(agenda_item.files)}")
            print(f"文件类型: {type(agenda_item.files)}")

            # 安全地过滤出临时文件信息
            temp_files = []
            for f in agenda_item.files:
                try:
                    if isinstance(f, dict) and 'temp_id' in f:
                        temp_files.append(f)
                except Exception as e:
                    print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

            if not temp_files:
                print("没有临时文件需要处理")
                continue

            print(f"找到 {len(temp_files)} 个临时文件")

            # 创建议程项目录
            agenda_folder_name = f"agenda_{i+1}"
            agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
            os.makedirs(agenda_dir, exist_ok=True)
            print(f"创建议程项目录: {agenda_dir}")

            # 处理每个临时文件
            processed_files = []
            for file_info in temp_files:
                try:
                    print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                    # 获取临时文件路径
                    temp_path = file_info.get('path')
                    if not temp_path:
                        print("文件路径为空")
                        continue

                    print(f"临时文件路径: {temp_path}")

                    if not os.path.exists(temp_path):
                        print(f"文件不存在: {temp_path}")
                        continue

                    # 生成新的文件名和路径
                    filename = os.path.basename(temp_path)
                    new_path = os.path.join(agenda_dir, filename)
                    print(f"新文件路径: {new_path}")

                    # 复制文件而不是移动，以避免权限问题
                    shutil.copy2(temp_path, new_path)
                    print("文件复制成功")

                    # 尝试删除原文件，如果失败也不影响继续
                    try:
                        os.remove(temp_path)
                        print("原文件删除成功")
                    except Exception as e:
                        print(f"删除原文件失败: {e}")

                    # 更新文件信息
                    file_info['path'] = new_path
                    file_info['url'] = f"/uploads/{meeting_data.id}/{agenda_folder_name}/{filename}"
                    processed_files.append(file_info)
                    print("文件信息更新成功")

                except Exception as e:
                    print(f"处理临时文件时出错: {e}")
                    import traceback
                    traceback.print_exc()
                    continue

            # 更新议程项的文件列表
            agenda_item.files = processed_files
            print(f"议程项文件列表更新成功，共 {len(agenda_item.files)} 个文件")

    except Exception as e:
        print(f"\n\n处理临时文件时发生全局错误: {e}")
        import traceback
        traceback.print_exc()
        # 不抛出异常，允许程序继续执行
        # 即使文件处理失败，也应该允许会议信息保存

@app.get("/api/meetings/", response_model=List[schemas.Meeting])
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取会议列表"""
    meetings = crud.get_meetings(db, skip=skip, limit=limit)
    # Manually set agenda_items to empty list as get_meetings doesn't load them
    # Or adjust the schema/query if needed
    for m in meetings:
        m.agenda_items = [] # Ensure the response matches the schema
    return meetings

@app.get("/api/meetings/{meeting_id}", response_model=schemas.Meeting)
def read_meeting_details(meeting_id: str, db: Session = Depends(get_db)):
    """获取单个会议的详细信息（包括议程项）"""
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@app.put("/api/meetings/{meeting_id}/status", response_model=schemas.Meeting)
def update_meeting_status_endpoint(meeting_id: str, status_update: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议状态"""
    if status_update.status is None:
         raise HTTPException(status_code=400, detail="Status field is required")
    db_meeting = crud.update_meeting_status(db=db, meeting_id=meeting_id, status=status_update.status)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@app.put("/api/meetings/{meeting_id}", response_model=schemas.Meeting)
def update_existing_meeting(meeting_id: str, meeting: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议信息，包括其议程项（采用删除旧项，添加新项的策略）"""
    # 处理临时文件
    if meeting.agenda_items:
        process_temp_files_in_meeting_update(meeting_id, meeting)

    db_meeting = crud.update_meeting(db=db, meeting_id=meeting_id, meeting_update=meeting)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    # Need to reload agenda items if the response model expects them
    db.refresh(db_meeting, attribute_names=['agenda_items'])
    return db_meeting


def process_temp_files_in_meeting_update(meeting_id, meeting_data):
    """处理会议更新中的临时文件"""
    try:
        print(f"\n\n开始处理会议 {meeting_id} 的临时文件")

        # 创建会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        print(f"创建会议目录: {meeting_dir}")

        # 处理议程项中的临时文件
        if not meeting_data.agenda_items:
            print("没有议程项需要处理")
            return

        for i, agenda_item in enumerate(meeting_data.agenda_items):
            print(f"\n处理议程项 {i+1}, ID: {agenda_item.id}")

            if not agenda_item.files:
                print("该议程项没有文件")
                continue

            print(f"议程项文件数量: {len(agenda_item.files)}")
            print(f"文件类型: {type(agenda_item.files)}")

            # 安全地过滤出临时文件信息
            temp_files = []
            for f in agenda_item.files:
                try:
                    if isinstance(f, dict) and 'temp_id' in f:
                        temp_files.append(f)
                except Exception as e:
                    print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

            if not temp_files:
                print("没有临时文件需要处理")
                continue

            print(f"找到 {len(temp_files)} 个临时文件")

            # 创建议程项目录
            agenda_folder_name = f"agenda_{i+1 if agenda_item.id is None else agenda_item.id}"
            agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
            os.makedirs(agenda_dir, exist_ok=True)
            print(f"创建议程项目录: {agenda_dir}")

            # 处理每个临时文件
            processed_files = []
            for file_info in temp_files:
                try:
                    print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                    # 获取临时文件路径
                    temp_path = file_info.get('path')
                    if not temp_path:
                        print("文件路径为空")
                        continue

                    print(f"临时文件路径: {temp_path}")

                    if not os.path.exists(temp_path):
                        print(f"文件不存在: {temp_path}")
                        continue

                    # 生成新的文件名和路径
                    filename = os.path.basename(temp_path)
                    new_path = os.path.join(agenda_dir, filename)
                    print(f"新文件路径: {new_path}")

                    # 复制文件而不是移动，以避免权限问题
                    shutil.copy2(temp_path, new_path)
                    print("文件复制成功")

                    # 尝试删除原文件，如果失败也不影响继续
                    try:
                        os.remove(temp_path)
                        print("原文件删除成功")
                    except Exception as e:
                        print(f"删除原文件失败: {e}")

                    # 更新文件信息
                    file_info['path'] = new_path
                    file_info['url'] = f"/uploads/{meeting_id}/{agenda_folder_name}/{filename}"
                    processed_files.append(file_info)
                    print("文件信息更新成功")

                except Exception as e:
                    print(f"处理临时文件时出错: {e}")
                    import traceback
                    traceback.print_exc()
                    continue

            # 更新议程项的文件列表
            # 保留非临时文件
            non_temp_files = []
            for f in agenda_item.files:
                try:
                    if not (isinstance(f, dict) and 'temp_id' in f):
                        non_temp_files.append(f)
                except Exception as e:
                    print(f"处理非临时文件时出错: {e}")

            agenda_item.files = non_temp_files + processed_files
            print(f"议程项文件列表更新成功，共 {len(agenda_item.files)} 个文件")

    except Exception as e:
        print(f"\n\n处理临时文件时发生全局错误: {e}")
        import traceback
        traceback.print_exc()
        # 不抛出异常，允许程序继续执行
        # 即使文件处理失败，也应该允许会议信息保存


@app.delete("/api/meetings/{meeting_id}", status_code=204) # Use 204 No Content for successful deletion
def delete_existing_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """删除会议"""
    success = crud.delete_meeting(db=db, meeting_id=meeting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"detail": "Meeting deleted successfully"} # Or return None with 204 status

# 会议文件上传API
@app.post("/api/meetings/{meeting_id}/upload")
async def upload_meeting_files(
    meeting_id: str,
    agenda_item_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    上传会议议程项的文件
    """
    # 检查会议是否存在
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # 检查议程项是否存在
    db_agenda_item = db.query(models.AgendaItem).filter(
        models.AgendaItem.id == agenda_item_id,
        models.AgendaItem.meeting_id == meeting_id
    ).first()

    if db_agenda_item is None:
        raise HTTPException(status_code=404, detail="Agenda item not found")

    # 创建会议文件存储目录
    meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
    agenda_dir = os.path.join(meeting_dir, f"agenda_{agenda_item_id}")
    os.makedirs(agenda_dir, exist_ok=True)

    uploaded_files = []

    try:
        for file in files:
            # 检查文件类型
            if not file.filename.lower().endswith(".pdf"):
                continue  # 跳过非PDF文件

            # 生成唯一文件名
            file_uuid = str(uuid.uuid4())
            safe_filename = f"{file_uuid}_{file.filename}"
            file_path = os.path.join(agenda_dir, safe_filename)

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
                "url": f"/uploads/{meeting_id}/agenda_{agenda_item_id}/{safe_filename}"
            })

            # 关闭文件
            await file.close()

        # 更新议程项的文件信息
        current_files = db_agenda_item.files or []
        if isinstance(current_files, list):
            current_files.extend(uploaded_files)
        else:
            current_files = uploaded_files

        db_agenda_item.files = current_files
        db.commit()

        return {"status": "success", "uploaded_files": uploaded_files}

    except Exception as e:
        # 发生错误时回滚
        db.rollback()
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# 临时文件上传API
@app.post("/api/upload-temp-files")
async def upload_temp_files(
    files: List[UploadFile] = File(...)
):
    """
    上传临时文件，不关联到特定会议或议程项
    """
    # 创建临时文件存储目录
    temp_dir = os.path.join(UPLOAD_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)

    uploaded_files = []

    try:
        for file in files:
            # 检查文件类型
            if not file.filename.lower().endswith(".pdf"):
                continue  # 跳过非PDF文件

            # 生成唯一文件名
            file_uuid = str(uuid.uuid4())
            safe_filename = f"{file_uuid}_{file.filename}"
            file_path = os.path.join(temp_dir, safe_filename)

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
                "temp_id": file_uuid  # 临时ID，用于后续关联
            })

            # 关闭文件
            await file.close()

        return {"status": "success", "uploaded_files": uploaded_files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# --- End Meeting API Endpoints ---
