import os
import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            user_id TEXT PRIMARY KEY,
            username TEXT,
            name TEXT,
            xp INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()


def get_player(user_id, username, name):
    conn = get_connection()
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
