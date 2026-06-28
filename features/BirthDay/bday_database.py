from database import get_connection
from psycopg2.extras import RealDictCursor

def init_birthday_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS birthdays (
            id SERIAL PRIMARY KEY,
            chat_id TEXT NOT NULL,
            name TEXT NOT NULL,
            birthday_mmdd TEXT NOT NULL,
            added_by_user_id TEXT,
            added_by_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(chat_id, name)
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()


def add_birthday(chat_id, name, birthday_mmdd, added_by_user_id, added_by_name):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        INSERT INTO birthdays (
            chat_id,
            name,
            birthday_mmdd,
            added_by_user_id,
            added_by_name
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (chat_id, name)
        DO UPDATE SET
            birthday_mmdd = EXCLUDED.birthday_mmdd,
            added_by_user_id = EXCLUDED.added_by_user_id,
            added_by_name = EXCLUDED.added_by_name
        RETURNING id, chat_id, name, birthday_mmdd
        """,
        (chat_id, name, birthday_mmdd, added_by_user_id, added_by_name)
    )

    birthday = cursor.fetchone()

    conn.commit()
    cursor.close()
    conn.close()

    return birthday


def get_birthdays(chat_id):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT id, name, birthday_mmdd
        FROM birthdays
        WHERE chat_id = %s
        ORDER BY birthday_mmdd ASC, name ASC
        """,
        (chat_id,)
    )

    birthdays = cursor.fetchall()

    cursor.close()
    conn.close()

    return birthdays


def delete_birthday(chat_id, birthday_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        DELETE FROM birthdays
        WHERE chat_id = %s AND id = %s
        """,
        (chat_id, birthday_id)
    )

    deleted_count = cursor.rowcount

    conn.commit()
    cursor.close()
    conn.close()

    return deleted_count
