"""
此脚本用于注释main.py中已移动到routes/meetings.py的会议相关路由和函数
"""

import re

# 读取main.py文件
with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义需要注释的部分
sections_to_comment = [
    # 会议API端点部分
    r'# --- Meeting API Endpoints ---\s+@app\.post\("/api/meetings/", response_model=schemas\.Meeting\).*?return db_meeting',
    
    # process_temp_files_in_meeting函数
    r'def process_temp_files_in_meeting\(meeting_data\):.*?# 即使文件处理失败，也应该允许会议信息保存',
    
    # read_meetings函数
    r'@app\.get\("/api/meetings/", response_model=List\[schemas\.Meeting\]\).*?return meetings',
    
    # read_meeting_details函数
    r'@app\.get\("/api/meetings/{meeting_id}", response_model=schemas\.Meeting\).*?return db_meeting',
    
    # get_meeting_status_token函数
    r'@app\.get\("/api/meetings/status/token", response_model=schemas\.MeetingChangeStatus\).*?"meetings": meetings_info\s+}',
    
    # update_meeting_status_endpoint函数
    r'@app\.put\("/api/meetings/{meeting_id}/status", response_model=schemas\.Meeting\).*?return db_meeting',
    
    # update_existing_meeting函数
    r'@app\.put\("/api/meetings/{meeting_id}", response_model=schemas\.Meeting\).*?return db_meeting',
    
    # process_temp_files_in_meeting_update函数
    r'def process_temp_files_in_meeting_update\(meeting_id, meeting_data\):.*?# 即使文件处理失败，也应该允许会议信息保存',
    
    # delete_existing_meeting函数
    r'@app\.delete\("/api/meetings/{meeting_id}", status_code=204\).*?raise HTTPException\(status_code=404, detail="Meeting not found"\)',
    
    # upload_meeting_files函数
    r'@app\.post\("/api/meetings/{meeting_id}/upload"\).*?return {"success": True, "files": uploaded_files}',
    
    # test_update_status_token函数
    r'@app\.post\("/api/meetings/status/token/test", response_model=dict\).*?"updated": old_token != new_token\s+}',
    
    # get_meeting_jpgs函数
    r'@app\.get\("/api/meetings/{meeting_id}/jpgs", response_model=dict\).*?return result',
    
    # get_meeting_package函数
    r'@app\.get\("/api/meetings/{meeting_id}/package", response_model=dict\).*?return result',
    
    # download_meeting_package函数
    r'@app\.get\("/api/meetings/{meeting_id}/download-package"\).*?return StreamingResponse\(zip_buffer, media_type="application/zip", headers=headers\)'
]

# 注释每个部分
for pattern in sections_to_comment:
    # 使用正则表达式查找匹配的部分
    matches = re.finditer(pattern, content, re.DOTALL)
    
    for match in matches:
        # 获取匹配的文本
        matched_text = match.group(0)
        
        # 注释匹配的文本（在每行前面添加#）
        commented_text = '# ' + matched_text.replace('\n', '\n# ')
        
        # 添加注释说明
        commented_text = '# 注意：此部分已移动到routes/meetings.py\n' + commented_text
        
        # 替换原文本
        content = content.replace(matched_text, commented_text)

# 写回main.py文件
with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("已成功注释main.py中的会议相关路由和函数")
