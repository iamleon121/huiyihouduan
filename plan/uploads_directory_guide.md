# uploads 目录使用指南

## 目录概述

uploads 目录是无纸化会议系统用于存储上传文件的主要目录，所有会议相关的 PDF 文件都存储在此目录中。该目录采用了基于会议和议程项的层级结构，确保文件组织清晰且易于管理。

## 目录结构

```
uploads/
├── {会议ID}/                  # 以会议ID命名的目录
│   ├── agenda_{议程项ID}/     # 以议程项ID命名的子目录
│   │   ├── {UUID}_{文件名}.pdf # 实际存储的文件，使用UUID前缀
│   │   └── jpgs/              # PDF转换的JPG文件存储目录
│   │       └── {PDF_UUID}/    # 以PDF文件UUID为名的目录
│   │           ├── {PDF_UUID}_{文件名}.jpg  # 转换后的长图（新格式）
│   │           └── merged.jpg  # 转换后的长图（旧格式）
│   └── ...
├── temp/                      # 临时文件存储目录
│   ├── {UUID}_{文件名}.pdf     # 临时上传的文件
│   └── ...
└── ...
```

## 文件命名规则

- **文件名格式**：`{UUID}_{原始文件名}.pdf`
- **UUID 前缀**：确保文件名唯一性，避免同名文件冲突
- **原始文件名**：保留用户上传时的原始文件名，便于识别
- **JPG长图命名**：`{PDF_UUID}_{原始文件名}.jpg`（新格式）或`merged.jpg`（旧格式）

## 文件处理流程

1. **文件上传**：
   - 用户上传文件时，首先存储在 `uploads/temp` 临时目录
   - 系统会自动为文件添加 UUID 前缀，确保文件名唯一

2. **文件关联**：
   - 当文件关联到会议议程项时，会从临时目录移动到对应的会议议程项目录
   - 系统会自动创建必要的目录结构（会议目录和议程项目录）

3. **文件去重**：
   - 系统会检查文件是否已存在，如果存在则复用现有文件而不是创建新文件
   - 去重基于原始文件名进行判断

4. **PDF转JPG**：
   - 当PDF文件添加到会议议程项时，系统自动将其转换为JPG长图格式
   - 转换后的JPG文件存储在对应的`jpgs/{PDF_UUID}/`目录中
   - 新版本使用与PDF同名的JPG文件，旧版本使用`merged.jpg`命名

5. **文件清理**：
   - 系统提供"删除未绑定文件"功能，可以清理未关联到会议的临时文件
   - 自动定时任务每24小时清理一次临时文件和孤立的会议文件夹
   - 当会议被删除时，系统自动删除对应的会议文件夹

## 文件访问方式

- **文件 URL 格式**：`/uploads/{会议ID}/agenda_{议程项ID}/{UUID}_{文件名}.pdf`
- **临时文件 URL 格式**：`/uploads/temp/{UUID}_{文件名}.pdf`
- **文件访问权限**：所有文件通过 FastAPI 的 StaticFiles 功能作为静态资源提供访问

## 文件管理功能

1. **文件上传**：
   - 支持上传 PDF 文件
   - 前端和后端都有对文件类型的检查，确保只上传 PDF 文件

2. **文件查看**：
   - 可以在浏览器中直接查看文件
   - 文件通过 URL 路径访问

3. **文件下载**：
   - 可以下载文件到本地
   - 下载保留原始文件名

4. **文件删除**：
   - 可以删除单个文件
   - 可以批量删除未绑定的文件
   - 会议删除时自动删除关联的文件夹

5. **文件自动清理**：
   - 系统自动定时清理未关联的临时文件
   - 系统自动定时清理孤立的会议文件夹（数据库中不存在的会议）
   - 清理任务每24小时执行一次

6. **PDF转JPG**：
   - 自动将PDF文件转换为JPG长图
   - 支持在平板设备上查看长图形式的会议文件

## 文件与会议关联

- 文件可以关联到特定会议的议程项
- 未关联会议的文件存储在临时目录中
- 文件关联信息存储在数据库的议程项记录中

## 文件安全性考虑

- 文件名使用 UUID 前缀，增加安全性
- 系统会检查文件类型，只允许上传 PDF 文件
- 文件操作有错误处理和异常捕获

## 开发注意事项

1. **文件路径处理**：
   - 使用 `os.path.join()` 构建文件路径，确保跨平台兼容性
   - 使用 `os.makedirs(dir, exist_ok=True)` 创建目录，避免目录已存在导致的错误

2. **文件操作异常处理**：
   - 所有文件操作都应包含在 try-except 块中
   - 捕获并记录文件操作异常，提供友好的错误信息

3. **文件去重逻辑**：
   - 上传文件前检查同名文件是否已存在
   - 如果存在同名文件，复用现有文件而不是创建新文件

4. **临时文件管理**：
   - 定期清理长时间未关联的临时文件
   - 提供手动清理临时文件的功能

5. **异步操作处理**：
   - 在同步函数中调用异步函数时，使用`asyncio.new_event_loop()`创建新的事件循环
   - 文件转换等耗时操作应使用异步处理，避免阻塞主线程

6. **自动清理配置**：
   - 可通过修改清理任务中的`cleanup_interval_hours`参数调整清理间隔
   - 系统启动时自动启动清理任务

## 相关代码示例

### 文件上传处理

```python
@app.post("/api/upload-temp-files")
async def upload_temp_files(files: List[UploadFile] = File(...)):
    """上传临时文件，不关联到特定会议或议程项"""
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
                "url": f"/uploads/temp/{safe_filename}"
            })

        return {"status": "success", "uploaded_files": uploaded_files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
```

### 文件关联处理

```python
def process_temp_files_in_meeting(meeting_data):
    """处理会议中的临时文件，将它们从临时目录移动到正式目录"""
    try:
        # 创建会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_data.id)
        os.makedirs(meeting_dir, exist_ok=True)

        # 处理议程项中的临时文件
        for i, agenda_item in enumerate(meeting_data.part):
            # 创建议程项目录
            agenda_folder_name = f"agenda_{i+1}"
            agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
            os.makedirs(agenda_dir, exist_ok=True)
            
            # 处理文件
            for file_info in agenda_item.get("files", []):
                # 检查是否是临时文件
                if "temp_id" in file_info:
                    # 构建临时文件路径
                    temp_filename = f"{file_info['temp_id']}_{file_info['name']}"
                    temp_path = os.path.join(UPLOAD_DIR, "temp", temp_filename)
                    
                    # 检查临时文件是否存在
                    if os.path.exists(temp_path):
                        # 移动文件到议程项目录
                        new_path = os.path.join(agenda_dir, temp_filename)
                        shutil.copy2(temp_path, new_path)
                        
                        # 更新文件信息
                        file_info['path'] = new_path
                        file_info['url'] = f"/uploads/{meeting_data.id}/{agenda_folder_name}/{temp_filename}"
                        
                        # 尝试删除原文件
                        try:
                            os.remove(temp_path)
                        except Exception as e:
                            print(f"删除原文件失败: {e}")
    except Exception as e:
        print(f"处理临时文件失败: {e}")
```

### 清理孤立会议文件夹

```python
@app.post("/api/maintenance/cleanup-empty-folders")
def cleanup_empty_folders(db: Session = Depends(get_db)):
    """
    清理uploads目录中的孤立文件夹（不再关联到任何会议的文件夹）
    """
    try:
        # 获取数据库中所有会议ID
        all_meetings = db.query(models.Meeting).all()
        valid_meeting_ids = {meeting.id for meeting in all_meetings}
        
        # 遍历uploads目录
        removed_folders = []
        skipped_folders = []
        
        for item in os.listdir(UPLOAD_DIR):
            item_path = os.path.join(UPLOAD_DIR, item)
            
            # 跳过temp目录和非目录项
            if item == "temp" or not os.path.isdir(item_path):
                continue
            
            # 检查目录名是否是UUID格式（会议ID）
            try:
                # 尝试将目录名解析为UUID，如果成功则说明可能是会议目录
                uuid_obj = uuid.UUID(item)
                
                # 检查该会议ID是否存在于数据库中
                if item not in valid_meeting_ids:
                    # 会议ID不在数据库中，删除该文件夹
                    shutil.rmtree(item_path)
                    removed_folders.append(item)
                    print(f"已删除孤立会议文件夹: {item}")
                else:
                    skipped_folders.append(item)
            except ValueError:
                # 不是UUID格式，跳过
                skipped_folders.append(item)
        
        return {
            "message": f"清理完成，共删除 {len(removed_folders)} 个孤立文件夹，保留 {len(skipped_folders)} 个文件夹",
            "removed_folders": removed_folders,
            "status": "success"
        }
    
    except Exception as e:
        print(f"清理孤立文件夹时出错: {str(e)}")
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse(
            status_code=500,
            content={
                "message": f"清理孤立文件夹失败: {str(e)}",
                "error_details": error_details,
                "status": "error"
            }
        )
```

### 定时清理任务配置

```python
async def background_cleanup_meetings_task():
    """
    后台清理任务，定时清理无效的会议文件夹
    """
    cleanup_interval_hours = 24.0  # 清理间隔时间（小时）
    while True:
        try:
            print(f"[{datetime.now()}] 开始自动清理无效会议文件夹...")
            
            # 获取数据库连接
            db = next(get_db())
            
            # 获取数据库中所有会议ID
            all_meetings = db.query(models.Meeting).all()
            valid_meeting_ids = {meeting.id for meeting in all_meetings}
            
            # 遍历uploads目录清理无效文件夹
            # ... 清理逻辑 ...
            
            print(f"[{datetime.now()}] 下次无效会议文件夹清理将在 {cleanup_interval_hours} 小时后执行")
            await asyncio.sleep(cleanup_interval_hours * 3600)
        except Exception as e:
            print(f"[{datetime.now()}] 无效会议文件夹清理任务出错: {str(e)}")
            # 发生错误后等待10分钟再次尝试
            await asyncio.sleep(600)
```

## 最佳实践建议

1. **定期备份**：
   - 定期备份 uploads 目录，防止数据丢失
   - 备份应包括文件和数据库，确保文件关联信息完整

2. **磁盘空间监控**：
   - 监控 uploads 目录的磁盘使用情况
   - 设置磁盘空间警告阈值，避免磁盘空间耗尽

3. **文件类型验证**：
   - 除了检查文件扩展名，还应验证文件内容类型
   - 考虑使用 Python 的 magic 库进行更严格的文件类型检查

4. **大文件处理**：
   - 对大文件上传设置超时时间和大小限制
   - 考虑实现分块上传功能，提高大文件上传的可靠性

5. **文件命名规范**：
   - 保持文件命名规则的一致性
   - 避免在文件名中使用特殊字符，确保跨平台兼容性
