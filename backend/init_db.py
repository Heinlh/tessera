"""
Database initialization script for Tessera.
Creates all tables and seeds with sample data for demo purposes.
"""
import sqlite3
import os

# Use environment variable or default path (must match app.py)
DB_PATH = os.environ.get('DATABASE_PATH', 'data/tessera.db')

def init_database():
    """Initialize the database with schema and sample data."""
    # Create data directory if it doesn't exist
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Create tables
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS Users (
      user_id        INTEGER PRIMARY KEY,
      username       TEXT NOT NULL UNIQUE,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL CHECK (role IN ('CUSTOMER','ADMIN')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Venues (
      venue_id     INTEGER PRIMARY KEY,
      venue_name   TEXT NOT NULL,
      city         TEXT NOT NULL,
      state        TEXT,
      country      TEXT NOT NULL,
      timezone     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Events (
      event_id          INTEGER PRIMARY KEY,
      venue_id          INTEGER NOT NULL,
      event_name        TEXT NOT NULL,
      event_description TEXT,
      start_datetime    TEXT NOT NULL,
      image_url         TEXT,
      status            TEXT NOT NULL CHECK (status IN ('SCHEDULED','ON_SALE','CANCELLED','COMPLETED')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (venue_id) REFERENCES Venues(venue_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Seats (
      seat_id      INTEGER PRIMARY KEY,
      venue_id     INTEGER NOT NULL,
      row_label    TEXT NOT NULL,
      seat_number  TEXT NOT NULL,
      col_index    INTEGER NOT NULL,
      section      TEXT,
      orientation  TEXT DEFAULT 'north' CHECK (orientation IN ('north','south','east','west')),
      FOREIGN KEY (venue_id) REFERENCES Venues(venue_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      UNIQUE (venue_id, row_label, seat_number)
    );

    CREATE INDEX IF NOT EXISTS idx_seats_venue_row_col
      ON Seats(venue_id, row_label, col_index);

    CREATE TABLE IF NOT EXISTS PriceTiers (
      price_tier_id  INTEGER PRIMARY KEY,
      event_id       INTEGER NOT NULL,
      tier_code      TEXT NOT NULL,
      tier_name      TEXT NOT NULL,
      price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      UNIQUE (event_id, tier_code)
    );

    CREATE TABLE IF NOT EXISTS SectionPricing (
      event_id       INTEGER NOT NULL,
      section        TEXT NOT NULL,
      price_tier_id  INTEGER NOT NULL,
      PRIMARY KEY (event_id, section),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (price_tier_id) REFERENCES PriceTiers(price_tier_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Carts (
      cart_id      INTEGER PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      event_id     INTEGER NOT NULL,
      status       TEXT NOT NULL CHECK (status IN ('OPEN','CONVERTED','EXPIRED')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_carts_user_status
      ON Carts(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_carts_event_status
      ON Carts(event_id, status);

    CREATE TABLE IF NOT EXISTS CartSeats (
      cart_id  INTEGER NOT NULL,
      seat_id  INTEGER NOT NULL,
      PRIMARY KEY (cart_id, seat_id),
      FOREIGN KEY (cart_id) REFERENCES Carts(cart_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES Seats(seat_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_cartseats_seat
      ON CartSeats(seat_id);

    CREATE TABLE IF NOT EXISTS EventSeatStatus (
      event_id         INTEGER NOT NULL,
      seat_id          INTEGER NOT NULL,
      status           TEXT NOT NULL CHECK (status IN ('AVAILABLE','HELD','SOLD')),
      held_by_cart_id  INTEGER,
      hold_expires_at  TEXT,
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, seat_id),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES Seats(seat_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (held_by_cart_id) REFERENCES Carts(cart_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_eventseatstatus_event_status
      ON EventSeatStatus(event_id, status);
    CREATE INDEX IF NOT EXISTS idx_eventseatstatus_hold_expiry
      ON EventSeatStatus(hold_expires_at);

    CREATE TABLE IF NOT EXISTS Orders (
      order_id     INTEGER PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      event_id     INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      status       TEXT NOT NULL CHECK (status IN ('PENDING','PAID','CANCELLED','REFUNDED')),
      total_cents  INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_created
      ON Orders(user_id, created_at);

    CREATE TABLE IF NOT EXISTS OrderItems (
      order_item_id     INTEGER PRIMARY KEY,
      order_id          INTEGER NOT NULL,
      seat_id           INTEGER NOT NULL,
      unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      line_total_cents  INTEGER NOT NULL CHECK (line_total_cents >= 0),
      FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES Seats(seat_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      UNIQUE (order_id, seat_id)
    );
    """)

    # Check if we need to seed data
    cursor.execute("SELECT COUNT(*) FROM Venues")
    if cursor.fetchone()[0] == 0:
        seed_data(cursor)

    conn.commit()
    conn.close()
    print(f"Database initialized at: {DB_PATH}")

def seed_data(cursor):
    """Seed the database with sample data."""
    # Venues
    cursor.executescript("""
    INSERT INTO Venues VALUES(1,'The Anthem','Washington','DC','US','America/New_York');
    INSERT INTO Venues VALUES(2,'Capital One Arena','Washington','DC','US','America/New_York');
    INSERT INTO Venues VALUES(3,'Merriweather Post Pavilion','Columbia','MD','US','America/New_York');
    """)

    # Events with various artists
    events = [
        (1001, 1, 'Taylor Swift — Live Night', 'Live performance event.', '2026-02-05 19:30:00', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', 'ON_SALE'),
        (1002, 2, 'Drake — Arena Set', 'Live performance event.', '2026-02-06 20:00:00', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', 'ON_SALE'),
        (1003, 3, 'Beyoncé — Summer Show', 'Live performance event.', '2026-02-07 20:00:00', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800', 'ON_SALE'),
        (1004, 1, 'Ed Sheeran — Acoustic Evening', 'Live performance event.', '2026-02-08 19:00:00', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800', 'ON_SALE'),
        (1005, 2, 'Adele — Vocal Showcase', 'Live performance event.', '2026-02-09 19:30:00', 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800', 'ON_SALE'),
        (1006, 3, 'Lady Gaga — Pop Spectacle', 'Live performance event.', '2026-02-10 20:00:00', 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800', 'ON_SALE'),
        (1007, 1, 'Kendrick Lamar — Tour Stop', 'Live performance event.', '2026-02-11 20:00:00', 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800', 'ON_SALE'),
        (1008, 2, 'Billie Eilish — Night Concert', 'Live performance event.', '2026-02-12 19:30:00', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', 'ON_SALE'),
        (1009, 3, 'Bruno Mars — 24K Party', 'Live performance event.', '2026-02-13 20:00:00', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800', 'ON_SALE'),
        (1010, 1, 'Ariana Grande — Pop Night', 'Live performance event.', '2026-02-14 19:00:00', 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800', 'ON_SALE'),
    ]
    
    for event in events:
        cursor.execute(
            "INSERT INTO Events (event_id, venue_id, event_name, event_description, start_datetime, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            event
        )

    # Create seats for each venue (10 rows x 15 seats each)
    seat_id = 1
    for venue_id in [1, 2, 3]:
        rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
        for row_idx, row_label in enumerate(rows):
            # Determine section based on row
            if row_idx < 3:
                section = 'VIP'
            elif row_idx < 6:
                section = 'PREMIUM'
            else:
                section = 'STANDARD'
            
            for col in range(1, 16):
                cursor.execute(
                    "INSERT INTO Seats (seat_id, venue_id, row_label, seat_number, col_index, section) VALUES (?, ?, ?, ?, ?, ?)",
                    (seat_id, venue_id, row_label, str(col), col, section)
                )
                seat_id += 1

    # Create price tiers for each event
    price_tier_id = 1
    for event_id in range(1001, 1011):
        cursor.execute(
            "INSERT INTO PriceTiers (price_tier_id, event_id, tier_code, tier_name, price_cents) VALUES (?, ?, 'VIP', 'VIP Seating', 15000)",
            (price_tier_id, event_id)
        )
        price_tier_id += 1
        cursor.execute(
            "INSERT INTO PriceTiers (price_tier_id, event_id, tier_code, tier_name, price_cents) VALUES (?, ?, 'PREMIUM', 'Premium Seating', 10000)",
            (price_tier_id, event_id)
        )
        price_tier_id += 1
        cursor.execute(
            "INSERT INTO PriceTiers (price_tier_id, event_id, tier_code, tier_name, price_cents) VALUES (?, ?, 'STANDARD', 'Standard Seating', 5000)",
            (price_tier_id, event_id)
        )
        price_tier_id += 1

    # Create section pricing for each event
    price_tier_offset = 0
    for event_id in range(1001, 1011):
        base_tier = 1 + price_tier_offset
        cursor.execute(
            "INSERT INTO SectionPricing (event_id, section, price_tier_id) VALUES (?, 'VIP', ?)",
            (event_id, base_tier)
        )
        cursor.execute(
            "INSERT INTO SectionPricing (event_id, section, price_tier_id) VALUES (?, 'PREMIUM', ?)",
            (event_id, base_tier + 1)
        )
        cursor.execute(
            "INSERT INTO SectionPricing (event_id, section, price_tier_id) VALUES (?, 'STANDARD', ?)",
            (event_id, base_tier + 2)
        )
        price_tier_offset += 3

    # Initialize EventSeatStatus for all events
    # Get venue_id for each event
    event_venues = {
        1001: 1, 1002: 2, 1003: 3, 1004: 1, 1005: 2,
        1006: 3, 1007: 1, 1008: 2, 1009: 3, 1010: 1
    }
    
    for event_id, venue_id in event_venues.items():
        # Get all seats for this venue
        cursor.execute("SELECT seat_id FROM Seats WHERE venue_id = ?", (venue_id,))
        seats = cursor.fetchall()
        for (seat_id,) in seats:
            cursor.execute(
                "INSERT INTO EventSeatStatus (event_id, seat_id, status) VALUES (?, ?, 'AVAILABLE')",
                (event_id, seat_id)
            )

    print("Sample data seeded successfully!")

if __name__ == '__main__':
    init_database()
