from fastapi import FastAPI, UploadFile, File, Request, Form
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

# Ensure the uploads directory exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Ensure the converted images directory exists
IMAGES_DIR = "static/converted_images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

app = FastAPI()

# Mount the static directory to serve static files (like index.html, css, js)
app.mount("/static", StaticFiles(directory="static"), name="static")

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
    """提供会议系统主页面"""
    try:
        with open("static/huiyi.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>错误: huiyi.html 未找到</h1>", status_code=404)

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
