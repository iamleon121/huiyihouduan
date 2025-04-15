import sqlite3
import json  # Import json for potentially stored JSON data

db_file = 'meetings.db'

def print_table_content(conn, table_name):
    print(f"\n--- Content of '{table_name}' table in {db_file} ---")
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';")
        if not cursor.fetchone():
            print(f"[{table_name} table does not exist]")
            return

        cursor.execute(f"SELECT * FROM {table_name}")
        col_names = [description[0] for description in cursor.description]
        rows = cursor.fetchall()

        if not rows:
            print(f"[No data in {table_name} table]")
            print(f"Columns: {col_names}") # Show columns even if empty
            return

        # Print header
        print(" | ".join(col_names))
        print("-" * (len(" | ".join(col_names)) + len(col_names) * 2)) # Separator line

        # Print rows
        for row in rows:
            # Convert each item to string, handle None, maybe format JSON nicely
            formatted_row = []
            for item in row:
                if isinstance(item, str):
                    # Attempt to parse JSON if it looks like it
                    if (item.startswith('[') and item.endswith(']')) or \
                       (item.startswith('{') and item.endswith('}')):
                        try:
                            parsed_json = json.loads(item)
                            # Simple representation for table view
                            formatted_row.append(f"JSON({len(parsed_json)} items)" if isinstance(parsed_json, list) else "JSON{...}")
                            continue # Go to next item
                        except json.JSONDecodeError:
                            pass # It wasn't valid JSON, treat as regular string
                formatted_row.append(str(item) if item is not None else "NULL")
            print(" | ".join(formatted_row))

    except sqlite3.Error as e:
        print(f"Error querying {table_name} table: {e}")
    except Exception as e:
         print(f"An unexpected error occurred while processing {table_name}: {e}")


# Main execution
conn = None # Initialize conn to None
try:
    conn = sqlite3.connect(db_file)
    print_table_content(conn, 'meetings')
    print_table_content(conn, 'agenda_items')

except sqlite3.Error as e:
    print(f"Database connection error: {e}")
except Exception as e:
    print(f"An error occurred: {e}")
finally:
    if conn:
        conn.close()
        print("\nDatabase connection closed.")
