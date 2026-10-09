# Add this table inside init_db():
def init_db():
    conn = get_connection()
    if not conn:
        return

    cursor = conn.cursor()

    # 1. Word Game Players Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            name TEXT,
            xp INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0
        )
    """)

    # 2. Vault Items Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vault_items (
            id VARCHAR(64) PRIMARY KEY,
            media_type VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            folder VARCHAR(128) NOT NULL,
            message_id VARCHAR(64) NOT NULL,
            file_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. User Activity Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_activity (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            visit_count INTEGER DEFAULT 1
        );
    """)

    conn.commit()
    cursor.close()
    conn.close()


# ---------------------------------------------------------
# USER ACTIVITY DB HELPERS
# ---------------------------------------------------------

def db_track_user(user_id, username, first_name, last_name):
    conn = get_connection()
    if not conn:
        return False

    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO user_activity (user_id, username, first_name, last_name, last_seen, visit_count)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                last_seen = CURRENT_TIMESTAMP,
                visit_count = user_activity.visit_count + 1;
        """, (str(user_id), username, first_name, last_name))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error tracking user in DB: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def db_get_users():
    conn = get_connection()
    if not conn:
        return []

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT 
                user_id AS id, 
                username, 
                first_name, 
                last_name, 
                to_char(last_seen, 'YYYY-MM-DD HH24:MI') AS last_seen, 
                visit_count
            FROM user_activity 
            ORDER BY last_seen DESC;
        """)
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error fetching users from DB: {e}")
        return []
    finally:
        cursor.close()
        conn.close()
