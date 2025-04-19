"""
合并会议路由文件

此脚本将多个部分文件合并为一个完整的meetings.py文件
"""

import os

# 定义输入和输出文件
input_files = [
    "routes/meetings_part1.py",
    "routes/meetings_part2.py",
    "routes/meetings_part3.py",
    "routes/meetings_part4.py"
]
output_file = "routes/meetings.py"

# 读取所有输入文件的内容
contents = []
for file_path in input_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        contents.append(f.read())

# 合并内容并写入输出文件
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(contents[0])  # 第一个文件包含导入和基本设置
    
    # 添加其他文件的内容（跳过注释行）
    for content in contents[1:]:
        # 跳过以#开头的行，这些通常是部分标题
        lines = content.split('\n')
        filtered_lines = []
        for line in lines:
            if not line.strip().startswith('# ---'):
                filtered_lines.append(line)
        f.write('\n'.join(filtered_lines))

print(f"已成功合并文件到 {output_file}")

# 删除临时文件
for file_path in input_files:
    try:
        os.remove(file_path)
        print(f"已删除临时文件: {file_path}")
    except Exception as e:
        print(f"删除文件 {file_path} 时出错: {e}")
