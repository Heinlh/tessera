from flask import Flask, jsonify, make_response, request # Importing the Flask library and some helper functions
import sqlite3 # Library for talking to our database
from datetime import datetime # We'll be working with dates
from werkzeug.security import generate_password_hash, check_password_hash

# Flask application instance
# This file defines a small REST API for users, events and ticketing backed by SQLite.
app = Flask(__name__)

# This function returns a connection to the database which can be used to send SQL commands to the database
def get_db_connection():
    # Return a SQLite connection object configured to return rows as dict-like objects
    conn = sqlite3.connect('../database/tessera.db')
    conn.row_factory = sqlite3.Row
    return conn


# --- Database initialization helpers ---
# Create any lightweight tables needed by this app that may not exist in the
# main schema (keeps application startup idempotent).
def ensure_tickets_table():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Tickets (
            ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_id INTEGER,
            created_at TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(user_id),
            FOREIGN KEY(event_id) REFERENCES Events(event_id)
        )
    ''')
    conn.commit()
    conn.close()

# Ensure the Tickets table exists on startup. If your main database
# migration process already creates this table, this call is harmless.
ensure_tickets_table()

# --- Public event endpoints ---
@app.route('/events', methods=['GET'])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Start with the base SQL query
    query = 'SELECT * FROM Events'
    params = []
    
    # Check if the 'afterDate' parameter is provided in the query string
    after_date = request.args.get('afterDate')
    if after_date:
        query += ' WHERE date > ?'
        params.append(after_date)
    
    # Execute the query with or without the date filter
    cursor.execute(query, params)
    events = cursor.fetchall()
    
    # Convert the rows to dictionaries to make them serializable
    events_list = [dict(event) for event in events]
    
    conn.close()
    
    return jsonify(events_list)

@app.route('/user', methods=['POST'])
def create_user():
    # Create a new user account.
    # Expected JSON: { "email": "...", "username": "...", "password": "..." }
    # Passwords are stored as a secure hash using Werkzeug utilities.
    # Extract email, username, and password from the JSON payload
    email = request.json.get('email')
    username = request.json.get('username')
    password = request.json.get('password')

    # Basic validation to ensure all fields are provided
    if not email or not username or not password:
        return jsonify({'error': 'All fields (email, username, and password) are required.'}), 400

    # Hash the password
    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Attempt to insert the new user into the Users table
        cursor.execute('INSERT INTO Users (email, username, password_hash) VALUES (?, ?, ?)',
                       (email, username, hashed_password))
        conn.commit()  # Commit the changes to the database

        # Retrieve the user_id of the newly created user to confirm creation
        cursor.execute('SELECT user_id FROM Users WHERE username = ?', (username,))
        new_user_id = cursor.fetchone()

        conn.close()

        return jsonify({'message': 'User created successfully', 'user_id': new_user_id['user_id']}), 201

    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists.'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/login', methods=['POST'])
def login():
    # Simple login endpoint that validates username/password.
    username = request.json.get('username')
    password = request.json.get('password')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM Users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        return jsonify({'message': 'Login successful'}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/change_password', methods=['PUT'])
def change_password():
    # Endpoint to change a user's password.
    # Requires the user's current password for verification.
    user_id = request.json.get('user_id')
    current_password = request.json.get('current_password')
    new_password = request.json.get('new_password')

    if not user_id or not current_password or not new_password:
        return jsonify({'error': 'user_id, current_password and new_password are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM Users WHERE user_id = ?', (user_id,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    if not check_password_hash(user['password_hash'], current_password):
        conn.close()
        return jsonify({'error': 'Current password is incorrect'}), 401

    new_hash = generate_password_hash(new_password)
    try:
        cursor.execute('UPDATE Users SET password_hash = ? WHERE user_id = ?', (new_hash, user_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/user', methods=['DELETE'])
def delete_user():
    # Delete a user account and any related tickets. Requires password verification.
    user_id = request.json.get('user_id')
    password = request.json.get('password')

    if not user_id or not password:
        return jsonify({'error': 'user_id and password are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM Users WHERE user_id = ?', (user_id,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    if not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({'error': 'Invalid password'}), 401

    try:
        # Delete tickets for user first to maintain referential integrity
        cursor.execute('DELETE FROM Tickets WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM Users WHERE user_id = ?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User and associated tickets deleted'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/events', methods=['POST'])
def create_event():
    # Create a new event. Example JSON: { "name": "...", "date": "YYYY-MM-DD", "description": "..." }
    # This endpoint can be used by admins to add events to the system.
    # Expecting at least a name and date; description is optional
    name = request.json.get('name')
    date = request.json.get('date')
    description = request.json.get('description', '')

    if not name or not date:
        return jsonify({'error': 'name and date are required for an event'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO Events (name, date, description) VALUES (?, ?, ?)',
                       (name, date, description))
        conn.commit()
        event_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'Event created', 'event_id': event_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/emails', methods=['GET'])
def get_all_emails():
    # Return all user emails. WARNING: exposing emails is a privacy risk; keep access restricted.
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT email FROM Users')
        rows = cursor.fetchall()
        conn.close()
        emails = [row['email'] for row in rows if row['email']]
        return jsonify({'emails': emails}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/tickets', methods=['POST'])
def award_tickets():
    # Award one or more tickets to a user for an event. Request JSON:
    # { "user_id": 1, "event_id": 2, "quantity": 3 }
    user_id = request.json.get('user_id')
    event_id = request.json.get('event_id')
    quantity = int(request.json.get('quantity', 1))

    if not user_id or not event_id:
        return jsonify({'error': 'user_id and event_id are required'}), 400

    if quantity < 1:
        return jsonify({'error': 'quantity must be >= 1'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify user exists
    cursor.execute('SELECT user_id FROM Users WHERE user_id = ?', (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    # Verify event exists
    cursor.execute('SELECT event_id FROM Events WHERE event_id = ?', (event_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Event not found'}), 404

    created_ticket_ids = []
    try:
        for _ in range(quantity):
            now = datetime.utcnow().isoformat()
            cursor.execute('INSERT INTO Tickets (user_id, event_id, created_at) VALUES (?, ?, ?)',
                           (user_id, event_id, now))
            created_ticket_ids.append(cursor.lastrowid)
        conn.commit()
        conn.close()
        return jsonify({'message': 'Tickets awarded', 'ticket_ids': created_ticket_ids}), 201
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/change_username_email', methods=['POST'])
def change_username_email():
    # Change a user's username and email after verifying their password.
    # Expects: { "user_id":1, "old_username":"...", "old_email":"...", "password":"..." }
    user_id = request.json.get('user_id')
    old_username = request.json.get('old_username')
    old_email = request.json.get('old_email')
    password = request.json.get('password')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM Users WHERE user_id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('UPDATE Users SET username = ?, email = ? WHERE user_id = ?',
                           (old_username, old_email, user_id))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Username and email updated successfully'}), 200
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Username or email already exists.'}), 409
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid user ID or password'}), 401
    
    
if __name__ == '__main__':
    app.run(debug=True)

      