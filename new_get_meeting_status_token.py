@router.get("/status/token", response_model=schemas.MeetingChangeStatus)
def get_meeting_status_token(db: Session = Depends(get_db)):
    """
    获取会议状态变更识别码和当前进行中的会议列表

    此API用于客户端轮询检测会议状态变更。只有当会议状态变为"进行中"时，
    此识别码才会更新。客户端可通过比较前后两次请求的识别码是否相同，
    来确定是否有新会议开始进行。

    当没有任何会议处于"进行中"状态时，返回id为"none"，表示当前没有会议召开。

    返回:
        MeetingChangeStatus: 包含id字段和meetings字段的对象
          - id: 会议状态变更识别码，如果没有进行中的会议则为"none"
          - meetings: 当前所有处于"进行中"状态的会议列表
    """
    # 查询所有处于"进行中"状态的会议
    in_progress_meetings = db.query(models.Meeting).filter(models.Meeting.status == "进行中").all()

    # 提取会议信息
    meetings_info = []
    for meeting in in_progress_meetings:
        # 格式化时间，将T替换为空格
        meeting_time = meeting.time
        if meeting_time and 'T' in meeting_time:
            meeting_time = meeting_time.replace('T', ' ')

        meetings_info.append({
            "id": meeting.id,
            "title": meeting.title,
            "time": meeting_time
        })

    print(f"[识别码查询] 当前进行中会议数量: {len(meetings_info)}")

    # 如果没有进行中的会议，返回id为"none"
    if not meetings_info:
        print(f"[识别码查询] 没有进行中的会议，返回id为'none'")
        token = "none"
    else:
        # 获取最新的会议变更识别码
        token = crud.get_meeting_change_status_token(db)
        print(f"[识别码查询] 当前会议状态识别码: {token}")

    # 确保数据库会话关闭，避免缓存问题
    db.close()

    return {
        "id": token,
        "meetings": meetings_info
    }
