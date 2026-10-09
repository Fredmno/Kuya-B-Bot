import os
import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    if not DATABASE_URL:
        return None
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_connection()
    if not conn:
        return

    cursor = conn.cursor()

    # 1. Existing Word Game Players Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            name TEXT,
            xp INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0
        )
    """)

    # 2. Vault Items Table (Unlimited Metadata Storage)
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

    conn.commit()
    cursor.close()
    conn.close()


# ---------------------------------------------------------
# WORD GAME DB HELPERS
# ---------------------------------------------------------

def get_player(user_id, username, name):
    conn = get_connection()
    if not conn:
        return None

    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT user_id, username, name, xp, wins
        FROM players
        WHERE user_id = %s
        """,
        (user_id,)
    )

    player = cursor.fetchone()

    if player is None:
        cursor.execute(
            """
            INSERT INTO players (user_id, username, name, xp, wins)
            VALUES (%s, %s, %s, 0, 0)
            RETURNING user_id, username, name, xp, wins
            """,
            (user_id, username, name)
        )

        player = cursor.fetchone()
        conn.commit()

    cursor.close()
    conn.close()

    return player


def add_xp(user_id, username, name, xp_amount):
    conn = get_connection()
    if not conn:
        return {"xp": 0, "wins": 0, "level": 1}

    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT xp, wins
        FROM players
        WHERE user_id = %s
        """,
        (user_id,)
    )

    player = cursor.fetchone()

    if player is None:
        cursor.execute(
            """
            INSERT INTO players (user_id, username, name, xp, wins)
            VALUES (%s, %s, %s, %s, 1)
            RETURNING xp, wins
            """,
            (user_id, username, name, xp_amount)
        )
    else:
        cursor.execute(
            """
            UPDATE players
            SET username = %s,
                name = %s,
                xp = xp + %s,
                wins = wins + 1
            WHERE user_id = %s
            RETURNING xp, wins
            """,
            (username, name, xp_amount, user_id)
        )

    updated_player = cursor.fetchone()
    conn.commit()

    cursor.close()
    conn.close()

    total_xp = updated_player["xp"]
    wins = updated_player["wins"]
    level = (total_xp // 100) + 1

    return {
        "xp": total_xp,
        "wins": wins,
        "level": level
    }


def get_leaderboard(limit=10):
    conn = get_connection()
    if not conn:
        return []

    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT user_id, username, name, xp, wins
        FROM players
        ORDER BY xp DESC, wins DESC
        LIMIT %s
        """,
        (limit,)
    )

    players = cursor.fetchall()

    cursor.close()
    conn.close()

    return players


# ---------------------------------------------------------
# VAULT DB HELPERS
# ---------------------------------------------------------

def db_get_all_vault_items():
    conn = get_connection()
    if not conn:
        return []

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT 
                id, 
                media_type AS type, 
                title, 
                folder, 
                message_id AS "messageId", 
                file_id AS "fileId" 
            FROM vault_items 
            ORDER BY created_at DESC;
        """)
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error fetching vault items from DB: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def db_add_vault_item(item_id, media_type, title, folder, message_id, file_id):
    conn = get_connection()
    if not conn:
        return False

    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO vault_items (id, media_type, title, folder, message_id, file_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                media_type = EXCLUDED.media_type,
                title = EXCLUDED.title,
                folder = EXCLUDED.folder,
                file_id = EXCLUDED.file_id;
        """, (str(item_id), media_type, title, folder, str(message_id), file_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding vault item to DB: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def db_get_vault_item_by_id(item_id):
    conn = get_connection()
    if not conn:
        return None

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT 
                id, 
                media_type AS type, 
                title, 
                folder, 
                message_id AS "messageId", 
                file_id AS "fileId" 
            FROM vault_items 
            WHERE id = %s;
        """, (str(item_id),))
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        print(f"Error fetching vault item by ID: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def db_delete_vault_item(item_id):
    conn = get_connection()
    if not conn:
        return False

    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM vault_items WHERE id = %s;", (str(item_id),))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error deleting vault item from DB: {e}")
        return False
    finally:
        cursor.close()
        conn.close()
