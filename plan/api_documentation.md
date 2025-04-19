# 无纸化会议系统 API 文档

本文档详细描述了无纸化会议系统的 API 接口，包括请求方法、URL、参数、请求体和响应格式。

## 目录

1. [认证](#1-认证)
2. [会议管理](#2-会议管理)
3. [文件管理](#3-文件管理)
4. [PDF 转换](#4-pdf-转换)
5. [错误处理](#5-错误处理)
6. [数据模型](#6-数据模型)
7. [会议管理 API](#会议管理-api)
8. [文件管理 API](#文件管理-api)
9. [用户管理 API](#用户管理-api)
10. [PDF转JPG API](#pdf转jpg-api)
11. [系统维护 API](#系统维护-api)

## 1. 认证

*注：当前版本未实现认证机制，未来版本将添加。*

## 2. 会议管理

### 2.1 获取会议列表

获取系统中的所有会议列表。

**请求**

```
GET /api/meetings/
```

**查询参数**

| 参数  | 类型    | 必填 | 默认值 | 说明                 |
|-------|---------|------|--------|----------------------|
| skip  | integer | 否   | 0      | 跳过的记录数         |
| limit | integer | 否   | 100    | 返回的最大记录数     |

**响应**

```json
[
  {
    "id": "651122",
    "title": "市政协完全大会",
    "intro": "会议介绍",
    "time": "2025年3月29日 9:00",
    "status": "未开始",
    "agenda_items": []
  },
  {
    "id": "651123",
    "title": "年度工作总结会",
    "intro": "回顾全年工作",
    "time": "2025年12月30日 14:00",
    "status": "未开始",
    "agenda_items": []
  }
]
```

### 2.2 获取会议详情

获取指定会议的详细信息，包括议程项。

**请求**

```
GET /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**响应**

```json
{
  "id": "651122",
  "title": "市政协完全大会",
  "intro": "会议介绍",
  "time": "2025年3月29日 9:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 1,
      "title": "议题一：审议资格",
      "files": [
        {
          "name": "关于审议资格的通知.pdf",
          "path": "uploads/651122/agenda_1/关于审议资格的通知.pdf",
          "size": 1024000,
          "url": "/uploads/651122/agenda_1/关于审议资格的通知.pdf"
        }
      ],
      "reporter": "张三",
      "duration_minutes": 30,
      "pages": ["10"],
      "meeting_id": "651122"
    },
    {
      "id": 2,
      "title": "议题二：全体会议",
      "files": [
        {
          "name": "全委会文件.pdf",
          "path": "uploads/651122/agenda_2/全委会文件.pdf",
          "size": 2048000,
          "url": "/uploads/651122/agenda_2/全委会文件.pdf"
        },
        {
          "name": "选举文件.pdf",
          "path": "uploads/651122/agenda_2/选举文件.pdf",
          "size": 1536000,
          "url": "/uploads/651122/agenda_2/选举文件.pdf"
        }
      ],
      "reporter": "李四",
      "duration_minutes": 45,
      "pages": ["1", "1"],
      "meeting_id": "651122"
    }
  ]
}
```

### 2.3 创建会议

创建一个新的会议，包括议程项。

**请求**

```
POST /api/meetings/
```

**请求体**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会",
  "intro": "讨论第一季度工作计划",
  "time": "2025年1月5日 10:00",
  "status": "未开始",
  "part": [
    {
      "title": "议题一：上季度工作总结",
      "files": [],
      "pages": [],
      "reporter": "张三",
      "duration_minutes": 30
    },
    {
      "title": "议题二：本季度工作计划",
      "files": [],
      "pages": [],
      "reporter": "李四",
      "duration_minutes": 45
    }
  ]
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会",
  "intro": "讨论第一季度工作计划",
  "time": "2025年1月5日 10:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 6,
      "title": "议题二：本季度工作计划",
      "files": [],
      "reporter": "李四",
      "duration_minutes": 45,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 2.4 更新会议

更新指定会议的信息，包括议程项。

**请求**

```
PUT /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**请求体**

```json
{
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "pages": [],
      "reporter": "张三",
      "duration_minutes": 40
    },
    {
      "title": "议题三：预算讨论",
      "files": [],
      "pages": [],
      "reporter": "王五",
      "duration_minutes": 30
    }
  ]
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 40,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 7,
      "title": "议题三：预算讨论",
      "files": [],
      "reporter": "王五",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 2.5 更新会议状态

更新指定会议的状态。

**请求**

```
PUT /api/meetings/{meeting_id}/status
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**请求体**

```json
{
  "status": "进行中"
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "status": "进行中",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 40,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 7,
      "title": "议题三：预算讨论",
      "files": [],
      "reporter": "王五",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 2.6 删除会议

删除指定的会议及其议程项。

**请求**

```
DELETE /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**响应**

```json
{
  "detail": "Meeting deleted successfully"
}
```

## 3. 文件管理

### 3.1 获取文件列表

获取系统中所有上传的文件列表。

**请求**

```
GET /api/documents
```

**响应**

```json
{
  "documents": [
    {
      "id": "关于审议资格的通知",
      "name": "关于审议资格的通知.pdf",
      "path": "uploads/651122/agenda_1/关于审议资格的通知.pdf",
      "url": "/uploads/651122/agenda_1/关于审议资格的通知.pdf",
      "size": 1024000,
      "size_formatted": "1.00 MB",
      "type": "PDF",
      "upload_time": "2023-04-15 10:30:45",
      "meeting_id": "651122"
    },
    {
      "id": "全委会文件",
      "name": "全委会文件.pdf",
      "path": "uploads/651122/agenda_2/全委会文件.pdf",
      "url": "/uploads/651122/agenda_2/全委会文件.pdf",
      "size": 2048000,
      "size_formatted": "2.00 MB",
      "type": "PDF",
      "upload_time": "2023-04-15 10:35:22",
      "meeting_id": "651122"
    }
  ],
  "total": 2
}
```

### 3.2 上传文件

上传 PDF 文件到系统。

**请求**

```
POST /upload
```

**表单数据**

| 参数 | 类型 | 必填 | 说明       |
|------|------|------|------------|
| file | file | 是   | PDF 文件   |

**响应**

```json
{
  "info": "文件 '示例文件.pdf' 已成功保存到 'uploads/示例文件.pdf'"
}
```

### 3.3 上传临时文件

> **注意**: 根据最新更新，临时文件上传功能现在仅通过会议创建/编辑页面可用，
> 文档管理页面已移除直接上传功能，确保所有文件与会议关联。

**端点**: `POST /api/upload-temp-files`

**功能**: 上传临时文件，用于稍后关联到会议

**请求**:
- Content-Type: multipart/form-data
- 文件字段: `files`（允许多个文件）

**响应**:

```json
{
  "status": "success",
  "uploaded_files": [
    {
      "name": "临时文件.pdf",
      "path": "uploads/temp/abc123_临时文件.pdf",
      "size": 1024000,
      "url": "/uploads/temp/abc123_临时文件.pdf",
      "temp_id": "abc123"
    }
  ]
}
```

### 3.4 上传会议文件

上传文件到指定会议的议程项。

**请求**

```
POST /api/meetings/{meeting_id}/upload
```

**路径参数**

| 参数          | 类型    | 说明           |
|---------------|---------|----------------|
| meeting_id    | string  | 会议的唯一标识 |

**查询参数**

| 参数           | 类型    | 必填 | 说明           |
|----------------|---------|------|----------------|
| agenda_item_id | integer | 是   | 议程项的 ID    |

**表单数据**

| 参数  | 类型      | 必填 | 说明       |
|-------|-----------|------|------------|
| files | file[] | 是   | PDF 文件列表 |

**响应**

```json
{
  "status": "success",
  "uploaded_files": [
    {
      "name": "会议文件.pdf",
      "path": "uploads/651122/agenda_1/def456_会议文件.pdf",
      "size": 1024000,
      "url": "/uploads/651122/agenda_1/def456_会议文件.pdf"
    }
  ]
}
```

### 3.5 删除文件

删除指定的文件。

**请求**

```
DELETE /api/documents/{document_id}
```

**路径参数**

| 参数        | 类型   | 说明           |
|-------------|--------|----------------|
| document_id | string | 文件的唯一标识 |

**响应**

```json
{
  "status": "success",
  "message": "文件删除成功"
}
```

## 4. PDF 转换

### 4.1 PDF 转 JPG

将上传的 PDF 文件转换为 JPG 图片。

**请求**

```
POST /convert-pdf-to-jpg
```

**表单数据**

| 参数   | 类型    | 必填 | 默认值 | 说明                       |
|--------|---------|------|--------|----------------------------|
| file   | file    | 是   |        | PDF 文件                   |
| dpi    | integer | 否   | 200    | 转换的 DPI                 |
| format | string  | 否   | "jpg"  | 输出格式 (jpg, png)        |
| merge  | boolean | 否   | false  | 是否合并所有页面为一张图片 |

**响应**

```json
{
  "images": [
    {
      "url": "/static/converted_images/abc123/page_1.jpg",
      "filename": "page_1.jpg",
      "page": 1
    },
    {
      "url": "/static/converted_images/abc123/page_2.jpg",
      "filename": "page_2.jpg",
      "page": 2
    }
  ],
  "total_pages": 2
}
```

如果 `merge=true`，响应将是：

```json
{
  "images": [
    {
      "url": "/static/converted_images/abc123/merged.jpg",
      "filename": "merged.jpg",
      "page": "all",
      "merged": true
    }
  ],
  "total_pages": 1
}
```

## 5. 错误处理

所有 API 在发生错误时都会返回适当的 HTTP 状态码和 JSON 格式的错误信息。

### 5.1 常见错误响应

**400 Bad Request**

```json
{
  "detail": "Meeting ID already registered"
}
```

**404 Not Found**

```json
{
  "detail": "Meeting not found"
}
```

**500 Internal Server Error**

```json
{
  "error": "获取文件列表失败: [错误详情]"
}
```

## 6. 数据模型

### 6.1 Meeting

| 字段         | 类型   | 说明                              |
|--------------|--------|-----------------------------------|
| id           | string | 会议唯一标识                      |
| title        | string | 会议标题                          |
| intro        | string | 会议介绍 (可选)                   |
| time         | string | 会议时间 (可选)                   |
| status       | string | 会议状态 (未开始、进行中、已结束) |
| agenda_items | array  | 议程项列表                        |

### 6.2 AgendaItem

| 字段             | 类型    | 说明                       |
|------------------|---------|----------------------------|
| id               | integer | 议程项唯一标识             |
| title            | string  | 议程项标题                 |
| files            | array   | 关联文件列表               |
| reporter         | string  | 报告人 (可选)              |
| duration_minutes | integer | 时长 (分钟) (可选)         |
| pages            | array   | 页码列表                   |
| meeting_id       | string  | 所属会议的唯一标识         |

### 6.3 File

| 字段           | 类型    | 说明                       |
|----------------|---------|----------------------------|
| name           | string  | 文件名称                   |
| path           | string  | 文件路径                   |
| size           | integer | 文件大小 (字节)            |
| size_formatted | string  | 格式化的文件大小           |
| url            | string  | 文件 URL                   |
| type           | string  | 文件类型                   |
| upload_time    | string  | 上传时间                   |
| meeting_id     | string  | 关联的会议 ID (可选)       |
| temp_id        | string  | 临时文件 ID (仅临时文件)   |

## 7. 会议管理 API

### 获取会议列表

获取系统中的所有会议列表。

**请求**

```
GET /api/meetings/
```

**查询参数**

| 参数  | 类型    | 必填 | 默认值 | 说明                 |
|-------|---------|------|--------|----------------------|
| skip  | integer | 否   | 0      | 跳过的记录数         |
| limit | integer | 否   | 100    | 返回的最大记录数     |

**响应**

```json
[
  {
    "id": "651122",
    "title": "市政协完全大会",
    "intro": "会议介绍",
    "time": "2025年3月29日 9:00",
    "status": "未开始",
    "agenda_items": []
  },
  {
    "id": "651123",
    "title": "年度工作总结会",
    "intro": "回顾全年工作",
    "time": "2025年12月30日 14:00",
    "status": "未开始",
    "agenda_items": []
  }
]
```

### 获取会议详情

获取指定会议的详细信息，包括议程项。

**请求**

```
GET /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**响应**

```json
{
  "id": "651122",
  "title": "市政协完全大会",
  "intro": "会议介绍",
  "time": "2025年3月29日 9:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 1,
      "title": "议题一：审议资格",
      "files": [
        {
          "name": "关于审议资格的通知.pdf",
          "path": "uploads/651122/agenda_1/关于审议资格的通知.pdf",
          "size": 1024000,
          "url": "/uploads/651122/agenda_1/关于审议资格的通知.pdf"
        }
      ],
      "reporter": "张三",
      "duration_minutes": 30,
      "pages": ["10"],
      "meeting_id": "651122"
    },
    {
      "id": 2,
      "title": "议题二：全体会议",
      "files": [
        {
          "name": "全委会文件.pdf",
          "path": "uploads/651122/agenda_2/全委会文件.pdf",
          "size": 2048000,
          "url": "/uploads/651122/agenda_2/全委会文件.pdf"
        },
        {
          "name": "选举文件.pdf",
          "path": "uploads/651122/agenda_2/选举文件.pdf",
          "size": 1536000,
          "url": "/uploads/651122/agenda_2/选举文件.pdf"
        }
      ],
      "reporter": "李四",
      "duration_minutes": 45,
      "pages": ["1", "1"],
      "meeting_id": "651122"
    }
  ]
}
```

### 创建会议

创建一个新的会议，包括议程项。

**请求**

```
POST /api/meetings/
```

**请求体**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会",
  "intro": "讨论第一季度工作计划",
  "time": "2025年1月5日 10:00",
  "status": "未开始",
  "part": [
    {
      "title": "议题一：上季度工作总结",
      "files": [],
      "pages": [],
      "reporter": "张三",
      "duration_minutes": 30
    },
    {
      "title": "议题二：本季度工作计划",
      "files": [],
      "pages": [],
      "reporter": "李四",
      "duration_minutes": 45
    }
  ]
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会",
  "intro": "讨论第一季度工作计划",
  "time": "2025年1月5日 10:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 6,
      "title": "议题二：本季度工作计划",
      "files": [],
      "reporter": "李四",
      "duration_minutes": 45,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 更新会议

更新指定会议的信息，包括议程项。

**请求**

```
PUT /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**请求体**

```json
{
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "pages": [],
      "reporter": "张三",
      "duration_minutes": 40
    },
    {
      "title": "议题三：预算讨论",
      "files": [],
      "pages": [],
      "reporter": "王五",
      "duration_minutes": 30
    }
  ]
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "status": "未开始",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 40,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 7,
      "title": "议题三：预算讨论",
      "files": [],
      "reporter": "王五",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 更新会议状态

更新指定会议的状态。

**请求**

```
PUT /api/meetings/{meeting_id}/status
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**请求体**

```json
{
  "status": "进行中"
}
```

**响应**

```json
{
  "id": "651124",
  "title": "2025年第一季度工作计划会（更新）",
  "intro": "讨论第一季度工作计划和预算",
  "time": "2025年1月6日 10:00",
  "status": "进行中",
  "agenda_items": [
    {
      "id": 5,
      "title": "议题一：上季度工作总结（更新）",
      "files": [],
      "reporter": "张三",
      "duration_minutes": 40,
      "pages": [],
      "meeting_id": "651124"
    },
    {
      "id": 7,
      "title": "议题三：预算讨论",
      "files": [],
      "reporter": "王五",
      "duration_minutes": 30,
      "pages": [],
      "meeting_id": "651124"
    }
  ]
}
```

### 删除会议

删除指定的会议及其议程项。

**请求**

```
DELETE /api/meetings/{meeting_id}
```

**路径参数**

| 参数       | 类型   | 说明           |
|------------|--------|----------------|
| meeting_id | string | 会议的唯一标识 |

**响应**

```json
{
  "detail": "Meeting deleted successfully"
}
```

## 8. 文件管理 API

### 获取文件列表

获取系统中所有上传的文件列表。

**请求**

```
GET /api/documents
```

**响应**

```json
{
  "documents": [
    {
      "id": "关于审议资格的通知",
      "name": "关于审议资格的通知.pdf",
      "path": "uploads/651122/agenda_1/关于审议资格的通知.pdf",
      "url": "/uploads/651122/agenda_1/关于审议资格的通知.pdf",
      "size": 1024000,
      "size_formatted": "1.00 MB",
      "type": "PDF",
      "upload_time": "2023-04-15 10:30:45",
      "meeting_id": "651122"
    },
    {
      "id": "全委会文件",
      "name": "全委会文件.pdf",
      "path": "uploads/651122/agenda_2/全委会文件.pdf",
      "url": "/uploads/651122/agenda_2/全委会文件.pdf",
      "size": 2048000,
      "size_formatted": "2.00 MB",
      "type": "PDF",
      "upload_time": "2023-04-15 10:35:22",
      "meeting_id": "651122"
    }
  ],
  "total": 2
}
```

### 上传文件

上传 PDF 文件到系统。

**请求**

```
POST /upload
```

**表单数据**

| 参数 | 类型 | 必填 | 说明       |
|------|------|------|------------|
| file | file | 是   | PDF 文件   |

**响应**

```json
{
  "info": "文件 '示例文件.pdf' 已成功保存到 'uploads/示例文件.pdf'"
}
```

### 上传临时文件

> **注意**: 根据最新更新，临时文件上传功能现在仅通过会议创建/编辑页面可用，
> 文档管理页面已移除直接上传功能，确保所有文件与会议关联。

**端点**: `POST /api/upload-temp-files`

**功能**: 上传临时文件，用于稍后关联到会议

**请求**:
- Content-Type: multipart/form-data
- 文件字段: `files`（允许多个文件）

**响应**:

```json
{
  "status": "success",
  "uploaded_files": [
    {
      "name": "临时文件.pdf",
      "path": "uploads/temp/abc123_临时文件.pdf",
      "size": 1024000,
      "url": "/uploads/temp/abc123_临时文件.pdf",
      "temp_id": "abc123"
    }
  ]
}
```

### 上传会议文件

上传文件到指定会议的议程项。

**请求**

```
POST /api/meetings/{meeting_id}/upload
```

**路径参数**

| 参数          | 类型    | 说明           |
|---------------|---------|----------------|
| meeting_id    | string  | 会议的唯一标识 |

**查询参数**

| 参数           | 类型    | 必填 | 说明           |
|----------------|---------|------|----------------|
| agenda_item_id | integer | 是   | 议程项的 ID    |

**表单数据**

| 参数  | 类型      | 必填 | 说明       |
|-------|-----------|------|------------|
| files | file[] | 是   | PDF 文件列表 |

**响应**

```json
{
  "status": "success",
  "uploaded_files": [
    {
      "name": "会议文件.pdf",
      "path": "uploads/651122/agenda_1/def456_会议文件.pdf",
      "size": 1024000,
      "url": "/uploads/651122/agenda_1/def456_会议文件.pdf"
    }
  ]
}
```

### 删除文件

删除指定的文件。

**请求**

```
DELETE /api/documents/{document_id}
```

**路径参数**

| 参数        | 类型   | 说明           |
|-------------|--------|----------------|
| document_id | string | 文件的唯一标识 |

**响应**

```json
{
  "status": "success",
  "message": "文件删除成功"
}
```

## 9. 用户管理 API

## 10. PDF转JPG API

### 获取会议JPG文件信息

```
GET /api/meetings/{meeting_id}/jpgs
```

获取指定会议的所有JPG文件信息，用于平板客户端显示。每个PDF文件都会被转换为JPG长图。

**参数**:
- `meeting_id`: 会议ID

**响应**:

```json
{
  "id": "meeting-uuid",
  "title": "示例会议",
  "status": "未开始",
  "time": "2023-11-20 14:30",
  "agenda_items": [
    {
      "id": 1,
      "title": "议程项1",
      "files": [
        {
          "pdf_id": "pdf-uuid",
          "jpg_files": [
            {
              "path": "path/to/pdf-uuid_document.jpg",
              "url": "/uploads/meeting-uuid/agenda_1/jpgs/pdf-uuid/pdf-uuid_document.jpg",
              "name": "document.jpg",
              "page": 1
            }
          ],
          "pdf_info": {
            "name": "document.pdf",
            "path": "path/to/document.pdf",
            "url": "/uploads/meeting-uuid/agenda_1/pdf-uuid_document.pdf"
          }
        }
      ]
    }
  ]
}
```

### 将PDF转换为JPG

```
POST /convert-pdf-to-jpg
```

将上传的PDF文件转换为JPG图片，支持合并为单一长图。

**表单参数**:
- `file`: PDF文件
- `dpi`: 图像DPI(默认200)
- `format`: 输出格式(默认jpg)
- `merge`: 是否合并为单一长图(布尔值)

**响应**:
为合并模式时:
```json
{
  "merged_jpg_url": "/path/to/merged.jpg",
  "merged_jpg_path": "absolute/path/to/merged.jpg"
}
```

为非合并模式时:
```json
{
  "jpg_files": [
    {
      "url": "/path/to/page_1.jpg",
      "path": "absolute/path/to/page_1.jpg",
      "page": 1
    },
    ...
  ]
}
```

## 11. 系统维护 API

### 查看临时文件数量

```
GET /api/maintenance/temp-files-count
```

返回 uploads/temp 目录中的临时文件数量。

**响应**:

```json
{
  "count": 10,
  "status": "success"
}
```

### 清理临时文件

```
POST /api/maintenance/cleanup-temp
```

清理 uploads/temp 目录中未绑定到任何会议的临时文件。

**响应**:

```json
{
  "message": "临时文件清理任务已启动",
  "status": "success"
}
```

### 强制清理临时文件

```
POST /api/maintenance/force-cleanup-temp
```

强制清理 uploads/temp 目录中的所有临时文件，不检查是否绑定到会议。

**响应**:

```json
{
  "message": "强制清理任务已启动",
  "status": "success"
}
```

### 清理孤立会议文件夹

```
POST /api/maintenance/cleanup-empty-folders
```

清理 uploads 目录中不再关联到任何会议的文件夹（数据库中不存在的会议ID）。

**响应**:

```json
{
  "message": "清理完成，共删除 5 个孤立文件夹，保留 10 个文件夹",
  "removed_folders": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
  "status": "success"
}
```

**错误响应**:

```json
{
  "message": "清理孤立文件夹失败: 错误信息",
  "error_details": "详细错误堆栈",
  "status": "error"
}
```
