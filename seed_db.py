import json
from database import SessionLocal, engine # Import session and engine
from models import Base, Meeting, AgendaItem # Import models and Base

# Your provided sample data
data_string = """
{"id":"651122","title": "市政协完全大会", "intro": "会议介绍", "time": "2025年3月29日 9:00", "part": [{"title": "议题一：审议资格", "file": ["关于审议资格的通知"], "page" : ["10"]}, {"title": "议题二：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题三：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题四：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题五：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}]}
"""

def seed_database():
    # Ensure tables are created (redundant if main.py already does it, but safe)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        meeting_data = json.loads(data_string)

        # Check if meeting already exists
        existing_meeting = db.query(Meeting).filter(Meeting.id == meeting_data["id"]).first()
        if existing_meeting:
            print(f"Meeting with ID {meeting_data['id']} already exists. Skipping seeding.")
            return

        # Create Meeting object
        new_meeting = Meeting(
            id=meeting_data["id"],
            title=meeting_data["title"],
            intro=meeting_data["intro"],
            time=meeting_data["time"],
            status="未开始" # Default status
        )
        db.add(new_meeting)
        # Flush to get the meeting object associated with the session before adding agenda items
        # Not strictly necessary here as we use the provided ID, but good practice if ID was auto-generated
        # db.flush()

        # Create AgendaItem objects
        for item_data in meeting_data.get("part", []):
            new_item = AgendaItem(
                title=item_data["title"],
                files=item_data.get("file"), # Store list directly as JSON
                pages=item_data.get("page"), # Store list directly as JSON
                meeting_id=new_meeting.id # Associate with the meeting
            )
            db.add(new_item)

        db.commit()
        print(f"Successfully seeded database with meeting ID: {new_meeting.id}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Seeding database...")
    seed_database()
    print("Database seeding process finished.")
