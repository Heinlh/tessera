from flask import Flask, jsonify, make_response, request # Importing the Flask library and some helper functions
from flask_cors import CORS # Library to handle Cross-Origin Resource Sharing (CORS)
import sqlite3 # Library for talking to our database
from datetime import datetime, timedelta # We'll be working with dates
from functools import wraps  # For creating custom decorators
from werkzeug.security import generate_password_hash, check_password_hash
from flask import jsonify
from flask import request

from flask_jwt_extended import create_access_token
from flask_jwt_extended import create_refresh_token
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import get_jwt
from flask_jwt_extended import jwt_required
from flask_jwt_extended import JWTManager

# Flask application instance
# This file defines a small REST API for users, events and ticketing backed by SQLite.
app = Flask(__name__)
CORS(app)


# Setup the Flask-JWT-Extended extension
app.config["JWT_SECRET_KEY"] = "supersecret123"

app.config["JWT_SECRET_KEY"] = "change-me-use-env-var"  # use env var in real apps
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=14)
  # Change this!
jwt = JWTManager(app)


# --- Role-based access control decorators ---
def admin_required():
    """
    Custom decorator that requires the user to have 'admin' role.
    Must be used AFTER @jwt_required() decorator.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            current_user = get_jwt_identity()
            if current_user.get('role') != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def user_required():
    """
    Custom decorator that requires the user to have 'user' or 'admin' role.
    Must be used AFTER @jwt_required() decorator.
    Admins can access user-level endpoints too.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            current_user = get_jwt_identity()
            if current_user.get('role') not in ['user', 'admin']:
                return jsonify({'error': 'User access required'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


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
        
        # Attempt to insert the new user into the Users table with default role "user"
        cursor.execute('INSERT INTO Users (email, username, password_hash, role) VALUES (?, ?, ?, ?)',
                       (email, username, hashed_password, 'user'))
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
    # Login endpoint that validates username/password and returns JWT tokens.
    # Returns both access_token (short-lived) and refresh_token (long-lived).
    username = request.json.get('username')
    password = request.json.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    # Fetch full user profile for encoding in token (including role)
    cursor.execute('SELECT user_id, username, email, password_hash, role FROM Users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        # Create identity payload with essential user info including role
        user_identity = {
            'user_id': user['user_id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role']
        }

        # Generate tokens
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Token refresh endpoint.
    Requires a valid refresh_token in the Authorization header.
    Returns a new access_token (and optionally a new refresh_token for rotation).
    """
    current_user = get_jwt_identity()
    
    # Create a new access token
    new_access_token = create_access_token(identity=current_user)
    
    # Optional: Rotate refresh token for better security
    new_refresh_token = create_refresh_token(identity=current_user)
    
    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }), 200


@app.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get the current authenticated user's profile.
    Requires a valid access_token in the Authorization header.
    """
    current_user = get_jwt_identity()
    return jsonify({'user': current_user}), 200


@app.route('/change_password', methods=['PUT'])
@jwt_required()
def change_password():
    # Endpoint to change a user's password.
    # Requires JWT authentication and current password for verification.
    current_user = get_jwt_identity()
    user_id = current_user['user_id']
    
    current_password = request.json.get('current_password')
    new_password = request.json.get('new_password')

    if not current_password or not new_password:
        return jsonify({'error': 'current_password and new_password are required'}), 400

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
@jwt_required()
def delete_user():
    # Delete a user account and any related tickets. Requires JWT auth and password verification.
    current_user = get_jwt_identity()
    user_id = current_user['user_id']
    
    password = request.json.get('password')

    if not password:
        return jsonify({'error': 'password is required'}), 400

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
@jwt_required()
@admin_required()
def create_event():
    # Create a new event. Example JSON: { "name": "...", "date": "YYYY-MM-DD", "description": "..." }
    # This endpoint requires admin authentication.
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
@jwt_required()
@admin_required()
def get_all_emails():
    # Return all user emails. Requires admin authentication.
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

@app.route('/events', methods=['GET'])
def get_all_events():
    # Return all events
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM Events')
        rows = cursor.fetchall()
        conn.close()
        events = [dict(row) for row in rows]
        return jsonify({'events': events}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/events', methods = ['PATCH'])
@jwt_required()
@admin_required()
def update_event():
    # Update event details. Requires admin authentication.
    event_id = request.json.get('event_id')
    name = request.json.get('name')
    date = request.json.get('date')
    description = request.json.get('description')
    location = request.json.get('location')
    time = request.json.get('time')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE Events
            SET name = ?, date = ?, description = ?, location = ?, time = ?
            WHERE event_id = ?
        ''', (name, date, description, location, time, event_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Event updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/change_username_email', methods=['POST'])
@jwt_required()
def change_username_email():
    # Change a user's username and email after verifying their password.
    # Requires JWT authentication. Expects: { "new_username":"...", "new_email":"...", "password":"..." }
    current_user = get_jwt_identity()
    user_id = current_user['user_id']
    
    new_username = request.json.get('new_username')
    new_email = request.json.get('new_email')
    password = request.json.get('password')

    if not new_username or not new_email or not password:
        return jsonify({'error': 'new_username, new_email, and password are required'}), 400

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
                           (new_username, new_email, user_id))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Username and email updated successfully'}), 200
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Username or email already exists.'}), 409
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid user ID or password'}), 401
    

@app.route('/tickets', methods=['POST'])
@jwt_required()
def create_ticket():
    # Create a ticket for a user for a specific event.
    # Requires JWT authentication - user must be logged in to purchase tickets.
    current_user = get_jwt_identity()
    user_id = current_user['user_id']
    
    event_id = request.json.get('event_id')
    price = request.json.get('price', 0.0)
    purchase_date = datetime.utcnow().isoformat()  

    if not event_id:
        return jsonify({'error': 'event_id is required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO Tickets (user_id, event_id, purchase_date, price) VALUES (?, ?, ?, ?)',
                       (user_id, event_id, purchase_date, price))
        conn.commit()
        ticket_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'Ticket created', 'ticket_id': ticket_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)


@app.route('/events', methods=['GET'])
def get_event_image():
    # Get the image URL for a specific event by event_id
    event_id = request.args.get('event_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT image FROM Events WHERE event_id = ?', (event_id,))
        row = cursor.fetchone()
        if row and row['image']:
            return jsonify({'image': row['image']}), 200
        else:
            return jsonify({'error': 'Image URL not found for the given event_id'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()