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
import stripe


# Flask application instance
# This file defines a small REST API for users, events and ticketing backed by SQLite.
app = Flask(__name__)
CORS(app)
stripe.api_key = "***REDACTED_STRIPE_KEY***"

# Setup the Flask-JWT-Extended extension
app.config["JWT_SECRET_KEY"] = "supersecret123"

app.config["JWT_SECRET_KEY"] = "change-me-use-env-var"  # use env var in real apps
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=14)
  # Change this!
jwt = JWTManager(app)

# Configure JWT to handle dictionary identities (user info including role)
import json

@jwt.user_identity_loader
def user_identity_lookup(user):
    """Convert user dict to JSON string for JWT subject"""
    if isinstance(user, dict):
        return json.dumps(user)
    return user

@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """Load user from JWT - returns the identity"""
    identity = jwt_data["sub"]
    if isinstance(identity, str):
        try:
            return json.loads(identity)
        except json.JSONDecodeError:
            return identity
    return identity

# Override get_jwt_identity to always return dict
from flask_jwt_extended import verify_jwt_in_request
def get_current_user_identity():
    """Helper to get parsed user identity from JWT"""
    identity = get_jwt_identity()
    if isinstance(identity, str):
        try:
            return json.loads(identity)
        except json.JSONDecodeError:
            return {'user_id': identity}
    return identity


def get_current_user():
    """Helper function to get the current user identity as a dictionary.
    Use this instead of get_jwt_identity() directly."""
    identity = get_jwt_identity()
    if isinstance(identity, str):
        try:
            return json.loads(identity)
        except json.JSONDecodeError:
            return {'user_id': identity}
    return identity


# --- Role-based access control decorators ---
def admin_required():
    """
    Custom decorator that requires the user to have 'ADMIN' role.
    Must be used AFTER @jwt_required() decorator.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            current_user = get_current_user()
            if current_user.get('role') != 'ADMIN':
                return jsonify({'error': 'Admin access required'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def user_required():
    """
    Custom decorator that requires the user to have 'CUSTOMER' or 'ADMIN' role.
    Must be used AFTER @jwt_required() decorator.
    Admins can access user-level endpoints too.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            current_user = get_current_user()
            if current_user.get('role') not in ['CUSTOMER', 'ADMIN']:
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


# --- Venue endpoints ---
@app.route('/venues', methods=['GET'])
def get_venues():
    """Get all venues."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM Venues')
        venues = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'venues': venues}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/venues', methods=['POST'])
@jwt_required()
@admin_required()
def create_venue():
    """Create a new venue. Requires admin authentication."""
    venue_name = request.json.get('venue_name')
    city = request.json.get('city')
    state = request.json.get('state', '')
    country = request.json.get('country')
    timezone = request.json.get('timezone')

    if not venue_name or not city or not country or not timezone:
        return jsonify({'error': 'venue_name, city, country, and timezone are required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO Venues (venue_name, city, state, country, timezone)
            VALUES (?, ?, ?, ?, ?)
        ''', (venue_name, city, state, country, timezone))
        conn.commit()
        venue_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'Venue created', 'venue_id': venue_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Seat endpoints ---
@app.route('/venues/<int:venue_id>/seats', methods=['GET'])
def get_venue_seats(venue_id):
    """Get all seats for a venue."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM Seats WHERE venue_id = ?
            ORDER BY row_label, col_index
        ''', (venue_id,))
        seats = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'seats': seats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/events/<int:event_id>/seats', methods=['GET'])
def get_event_seats(event_id):
    """Get all seats for an event with availability status and pricing."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get event's venue
        cursor.execute('SELECT venue_id FROM Events WHERE event_id = ?', (event_id,))
        event = cursor.fetchone()
        if not event:
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
        # Get seats with status and pricing
        cursor.execute('''
            SELECT s.*, 
                   COALESCE(ess.status, 'AVAILABLE') as availability,
                   pt.price_cents,
                   pt.tier_name
            FROM Seats s
            LEFT JOIN EventSeatStatus ess ON s.seat_id = ess.seat_id AND ess.event_id = ?
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE s.venue_id = ?
            ORDER BY s.row_label, s.col_index
        ''', (event_id, event_id, event['venue_id']))
        seats = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'seats': seats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Public event endpoints ---
@app.route('/events', methods=['GET'])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Start with the base SQL query - join with Venues to get venue info
    query = '''
        SELECT e.*, v.venue_name, v.city, v.state, v.country
        FROM Events e
        LEFT JOIN Venues v ON e.venue_id = v.venue_id
    '''
    params = []
    
    # Check if the 'afterDate' parameter is provided in the query string
    after_date = request.args.get('afterDate')
    if after_date:
        query += ' WHERE e.start_datetime > ?'
        params.append(after_date)
    
    # Execute the query with or without the date filter
    cursor.execute(query, params)
    events = cursor.fetchall()
    
    # Convert the rows to dictionaries to make them serializable
    events_list = [dict(event) for event in events]
    
    conn.close()
    
    return jsonify(events_list)


@app.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """Get a single event by ID with venue information."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT e.*, v.venue_name, v.city, v.state, v.country
            FROM Events e
            LEFT JOIN Venues v ON e.venue_id = v.venue_id
            WHERE e.event_id = ?
        ''', (event_id,))
        
        event = cursor.fetchone()
        conn.close()
        
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        return jsonify(dict(event)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        
        # Attempt to insert the new user into the Users table with default role "CUSTOMER"
        cursor.execute('INSERT INTO Users (email, username, password_hash, role) VALUES (?, ?, ?, ?)',
                       (email, username, hashed_password, 'CUSTOMER'))
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
    current_user = get_current_user()
    
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
def get_me():
    """
    Get the current authenticated user's profile.
    Requires a valid access_token in the Authorization header.
    """
    current_user = get_current_user()
    return jsonify({'user': current_user}), 200


@app.route('/change_password', methods=['PUT'])
@jwt_required()
def change_password():
    # Endpoint to change a user's password.
    # Requires JWT authentication and current password for verification.
    current_user = get_current_user()
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
    current_user = get_current_user()
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
        # Delete user's orders (cascade will handle order items and tickets)
        # Also delete any carts for this user
        cursor.execute('DELETE FROM Carts WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM Orders WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM Users WHERE user_id = ?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User and associated data deleted'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/events', methods=['POST'])
@jwt_required()
@admin_required()
def create_event():
    # Create a new event. 
    # Expected JSON: { "venue_id": 1, "event_name": "...", "start_datetime": "YYYY-MM-DD HH:MM:SS", "event_description": "...", "image_url": "...", "status": "SCHEDULED" }
    # This endpoint requires admin authentication.
    venue_id = request.json.get('venue_id')
    event_name = request.json.get('event_name')
    start_datetime = request.json.get('start_datetime')
    event_description = request.json.get('event_description', '')
    image_url = request.json.get('image_url', '')
    status = request.json.get('status', 'SCHEDULED')

    if not venue_id or not event_name or not start_datetime:
        return jsonify({'error': 'venue_id, event_name, and start_datetime are required'}), 400

    # Validate status
    valid_statuses = ['SCHEDULED', 'ON_SALE', 'CANCELLED', 'COMPLETED']
    if status not in valid_statuses:
        return jsonify({'error': f'status must be one of: {valid_statuses}'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO Events (venue_id, event_name, event_description, start_datetime, image_url, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (venue_id, event_name, event_description, start_datetime, image_url, status))
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
    # Return all events with venue information
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.*, v.venue_name, v.city, v.state, v.country
            FROM Events e
            LEFT JOIN Venues v ON e.venue_id = v.venue_id
        ''')
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
    event_name = request.json.get('event_name')
    start_datetime = request.json.get('start_datetime')
    event_description = request.json.get('event_description')
    image_url = request.json.get('image_url')
    status = request.json.get('status')
    venue_id = request.json.get('venue_id')

    # Validate status if provided
    if status:
        valid_statuses = ['SCHEDULED', 'ON_SALE', 'CANCELLED', 'COMPLETED']
        if status not in valid_statuses:
            return jsonify({'error': f'status must be one of: {valid_statuses}'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE Events
            SET event_name = ?, start_datetime = ?, event_description = ?, image_url = ?, status = ?, venue_id = ?
            WHERE event_id = ?
        ''', (event_name, start_datetime, event_description, image_url, status, venue_id, event_id))
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
    current_user = get_current_user()
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
    

@app.route('/orders', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create an order and purchase tickets for seats.
    Expected JSON: { "event_id": 1, "seat_ids": [1, 2, 3] }
    This will:
    1. Create an order
    2. Create order items for each seat with pricing
    3. Issue tickets for each order item
    4. Update seat status to SOLD
    """
    import uuid
    
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    event_id = request.json.get('event_id')
    seat_ids = request.json.get('seat_ids', [])

    if not event_id or not seat_ids:
        return jsonify({'error': 'event_id and seat_ids are required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate total price from seat pricing
        total_cents = 0
        seat_prices = []
        for seat_id in seat_ids:
            # Get section for this seat
            cursor.execute('SELECT section FROM Seats WHERE seat_id = ?', (seat_id,))
            seat = cursor.fetchone()
            if not seat:
                conn.close()
                return jsonify({'error': f'Seat {seat_id} not found'}), 404
            
            # Get price for this section/event
            cursor.execute('''
                SELECT pt.price_cents 
                FROM SectionPricing sp
                JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
                WHERE sp.event_id = ? AND sp.section = ?
            ''', (event_id, seat['section']))
            pricing = cursor.fetchone()
            price_cents = pricing['price_cents'] if pricing else 0
            seat_prices.append((seat_id, price_cents))
            total_cents += price_cents
        
        # Create the order
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        
        # Create order items and tickets for each seat
        for seat_id, price_cents in seat_prices:
            # Create order item
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
            # Generate barcode and create ticket
            barcode = str(uuid.uuid4()).replace('-', '')[:16].upper()
            cursor.execute('''
                INSERT INTO Tickets (order_item_id, barcode_num, status)
                VALUES (?, ?, 'ISSUED')
            ''', (order_item_id, barcode))
            ticket_id = cursor.lastrowid
            
            tickets_created.append({
                'ticket_id': ticket_id,
                'seat_id': seat_id,
                'barcode': barcode
            })
            
            # Update seat status to SOLD
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'SOLD', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Order created successfully',
            'order_id': order_id,
            'total_cents': total_cents,
            'tickets': tickets_created
        }), 201
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/orders', methods=['GET'])
@jwt_required()
def get_user_orders():
    """
    Get all orders for the current user with their tickets.
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT o.*, e.event_name, e.start_datetime, v.venue_name
            FROM Orders o
            JOIN Events e ON o.event_id = e.event_id
            LEFT JOIN Venues v ON e.venue_id = v.venue_id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        ''', (user_id,))
        orders = cursor.fetchall()
        
        result = []
        for order in orders:
            order_dict = dict(order)
            
            # Get tickets for this order
            cursor.execute('''
                SELECT t.ticket_id, t.barcode_num, t.status as ticket_status,
                       s.row_label, s.seat_number, s.section,
                       oi.unit_price_cents
                FROM Tickets t
                JOIN OrderItems oi ON t.order_item_id = oi.order_item_id
                JOIN Seats s ON oi.seat_id = s.seat_id
                WHERE oi.order_id = ?
            ''', (order['order_id'],))
            tickets = [dict(t) for t in cursor.fetchall()]
            order_dict['tickets'] = tickets
            
            result.append(order_dict)
        
        conn.close()
        return jsonify({'orders': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# INVENTORY / SEAT RESERVATION APIs
# =============================================================================

@app.route('/events/<int:event_id>/inventory', methods=['GET'])
def get_event_inventory(event_id):
    """
    Get seat inventory/availability summary for an event.
    PUBLIC endpoint - does NOT expose who owns seats.
    Returns counts of available, held, and sold seats by section.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify event exists
        cursor.execute('SELECT venue_id, status FROM Events WHERE event_id = ?', (event_id,))
        event = cursor.fetchone()
        if not event:
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
        # Get inventory summary by section
        cursor.execute('''
            SELECT 
                s.section,
                COUNT(*) as total_seats,
                SUM(CASE WHEN COALESCE(ess.status, 'AVAILABLE') = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN ess.status = 'HELD' THEN 1 ELSE 0 END) as held,
                SUM(CASE WHEN ess.status = 'SOLD' THEN 1 ELSE 0 END) as sold,
                pt.price_cents,
                pt.tier_name
            FROM Seats s
            LEFT JOIN EventSeatStatus ess ON s.seat_id = ess.seat_id AND ess.event_id = ?
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE s.venue_id = ?
            GROUP BY s.section
        ''', (event_id, event_id, event['venue_id']))
        
        sections = [dict(row) for row in cursor.fetchall()]
        
        # Calculate totals
        totals = {
            'total_seats': sum(s['total_seats'] for s in sections),
            'available': sum(s['available'] for s in sections),
            'held': sum(s['held'] for s in sections),
            'sold': sum(s['sold'] for s in sections)
        }
        
        conn.close()
        return jsonify({
            'event_id': event_id,
            'event_status': event['status'],
            'sections': sections,
            'totals': totals
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/cart', methods=['GET'])
@jwt_required()
def get_cart():
    """
    Get the current user's active cart with reserved seats.
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get active (OPEN) carts for this user
        cursor.execute('''
            SELECT c.*, e.event_name, e.start_datetime, e.image_url, v.venue_name
            FROM Carts c
            JOIN Events e ON c.event_id = e.event_id
            LEFT JOIN Venues v ON e.venue_id = v.venue_id
            WHERE c.user_id = ? AND c.status = 'OPEN'
            ORDER BY c.created_at DESC
        ''', (user_id,))
        carts = cursor.fetchall()
        
        result = []
        for cart in carts:
            cart_dict = dict(cart)
            
            # Get seats in this cart with pricing
            cursor.execute('''
                SELECT s.seat_id, s.row_label, s.seat_number, s.section,
                       pt.price_cents, pt.tier_name
                FROM CartSeats cs
                JOIN Seats s ON cs.seat_id = s.seat_id
                LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
                LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
                WHERE cs.cart_id = ?
            ''', (cart['event_id'], cart['cart_id']))
            seats = [dict(s) for s in cursor.fetchall()]
            cart_dict['seats'] = seats
            cart_dict['total_cents'] = sum(s['price_cents'] or 0 for s in seats)
            
            result.append(cart_dict)
        
        conn.close()
        return jsonify({'carts': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/events/<int:event_id>/reserve', methods=['POST'])
@jwt_required()
def reserve_seats(event_id):
    """
    Reserve (hold) seats for the current user.
    
    Accepts two formats:
    1. By seat IDs: { "seat_ids": [1, 2, 3] }
    2. By section: { "sections": { "Section A": 2, "Section B": 1 } }
       (reserves 2 available seats from Section A, 1 from Section B)
    
    - Creates a cart if user doesn't have one for this event
    - Adds seats to cart
    - Sets seat status to HELD
    - Sets hold expiration (e.g., 10 minutes)
    
    Returns error if any seats are not available.
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    seat_ids = request.json.get('seat_ids', [])
    sections_request = request.json.get('sections', {})  # { "section_name": quantity }
    
    # Hold duration in minutes
    HOLD_DURATION_MINUTES = 10
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify event exists and is on sale
        cursor.execute('SELECT status, venue_id FROM Events WHERE event_id = ?', (event_id,))
        event = cursor.fetchone()
        if not event:
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        if event['status'] not in ['ON_SALE', 'SCHEDULED']:
            conn.close()
            return jsonify({'error': 'Event is not available for ticket sales'}), 400
        
        # If sections are provided, find available seats by section
        if sections_request and not seat_ids:
            for section_name, qty in sections_request.items():
                if qty <= 0:
                    continue
                # Find available seats in this section
                cursor.execute('''
                    SELECT s.seat_id 
                    FROM Seats s
                    LEFT JOIN EventSeatStatus ess ON s.seat_id = ess.seat_id AND ess.event_id = ?
                    WHERE s.venue_id = ? AND s.section = ? 
                      AND COALESCE(ess.status, 'AVAILABLE') = 'AVAILABLE'
                    LIMIT ?
                ''', (event_id, event['venue_id'], section_name, int(qty)))
                available = [row['seat_id'] for row in cursor.fetchall()]
                
                if len(available) < qty:
                    conn.close()
                    return jsonify({
                        'error': f'Not enough available seats in {section_name}',
                        'requested': qty,
                        'available': len(available)
                    }), 409
                
                seat_ids.extend(available)
        
        if not seat_ids:
            conn.close()
            return jsonify({'error': 'No seats specified for reservation'}), 400
        
        # Check if all seats are available
        unavailable_seats = []
        for seat_id in seat_ids:
            cursor.execute('''
                SELECT status FROM EventSeatStatus 
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
            status_row = cursor.fetchone()
            if status_row and status_row['status'] != 'AVAILABLE':
                unavailable_seats.append(seat_id)
        
        if unavailable_seats:
            conn.close()
            return jsonify({
                'error': 'Some seats are not available',
                'unavailable_seat_ids': unavailable_seats
            }), 409
        
        # Get or create cart for this user and event
        cursor.execute('''
            SELECT cart_id FROM Carts 
            WHERE user_id = ? AND event_id = ? AND status = 'OPEN'
        ''', (user_id, event_id))
        cart = cursor.fetchone()
        
        expires_at = (datetime.utcnow() + timedelta(minutes=HOLD_DURATION_MINUTES)).isoformat()
        
        if cart:
            cart_id = cart['cart_id']
            # Update expiration
            cursor.execute('''
                UPDATE Carts SET expires_at = ? WHERE cart_id = ?
            ''', (expires_at, cart_id))
        else:
            # Create new cart
            cursor.execute('''
                INSERT INTO Carts (user_id, event_id, status, expires_at)
                VALUES (?, ?, 'OPEN', ?)
            ''', (user_id, event_id, expires_at))
            cart_id = cursor.lastrowid
        
        # Add seats to cart and update their status
        for seat_id in seat_ids:
            # Add to CartSeats (ignore if already there)
            cursor.execute('''
                INSERT OR IGNORE INTO CartSeats (cart_id, seat_id)
                VALUES (?, ?)
            ''', (cart_id, seat_id))
            
            # Update or insert seat status
            cursor.execute('''
                INSERT INTO EventSeatStatus (event_id, seat_id, status, held_by_cart_id, hold_expires_at, updated_at)
                VALUES (?, ?, 'HELD', ?, ?, datetime('now'))
                ON CONFLICT(event_id, seat_id) DO UPDATE SET
                    status = 'HELD',
                    held_by_cart_id = ?,
                    hold_expires_at = ?,
                    updated_at = datetime('now')
            ''', (event_id, seat_id, cart_id, expires_at, cart_id, expires_at))
        
        # Fetch detailed seat info for response
        cursor.execute('''
            SELECT s.seat_id, s.row_label, s.seat_number, s.section,
                   pt.price_cents, pt.tier_name
            FROM Seats s
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE s.seat_id IN ({})
        '''.format(','.join('?' * len(seat_ids))), [event_id] + seat_ids)
        reserved_seats = []
        for row in cursor.fetchall():
            reserved_seats.append({
                'seat_id': row['seat_id'],
                'row_name': row['row_label'],
                'seat_number': row['seat_number'],
                'section': row['section'],
                'price': (row['price_cents'] or 0) / 100,
                'tier_name': row['tier_name']
            })
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Seats reserved successfully',
            'cart_id': cart_id,
            'seats_reserved': len(seat_ids),
            'reserved_seats': reserved_seats,
            'expires_at': expires_at,
            'hold_duration_minutes': HOLD_DURATION_MINUTES
        }), 200
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/events/<int:event_id>/release', methods=['POST'])
@jwt_required()
def release_seats(event_id):
    """
    Release (unreserve) seats that the current user has held.
    Expected JSON: { "seat_ids": [1, 2, 3] }
    
    - Removes seats from cart
    - Sets seat status back to AVAILABLE
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    seat_ids = request.json.get('seat_ids', [])
    if not seat_ids:
        return jsonify({'error': 'seat_ids is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user's cart for this event
        cursor.execute('''
            SELECT cart_id FROM Carts 
            WHERE user_id = ? AND event_id = ? AND status = 'OPEN'
        ''', (user_id, event_id))
        cart = cursor.fetchone()
        
        if not cart:
            conn.close()
            return jsonify({'error': 'No active cart found for this event'}), 404
        
        cart_id = cart['cart_id']
        released_seats = []
        
        for seat_id in seat_ids:
            # Verify seat is held by this user's cart
            cursor.execute('''
                SELECT status, held_by_cart_id FROM EventSeatStatus
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
            status_row = cursor.fetchone()
            
            if status_row and status_row['held_by_cart_id'] == cart_id:
                # Remove from cart
                cursor.execute('''
                    DELETE FROM CartSeats WHERE cart_id = ? AND seat_id = ?
                ''', (cart_id, seat_id))
                
                # Set status back to available
                cursor.execute('''
                    UPDATE EventSeatStatus 
                    SET status = 'AVAILABLE', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                    WHERE event_id = ? AND seat_id = ?
                ''', (event_id, seat_id))
                
                released_seats.append(seat_id)
        
        # If cart is now empty, we could optionally delete it
        cursor.execute('SELECT COUNT(*) as count FROM CartSeats WHERE cart_id = ?', (cart_id,))
        if cursor.fetchone()['count'] == 0:
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ?', (cart_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Seats released successfully',
            'seats_released': released_seats
        }), 200
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/cart/<int:cart_id>/checkout', methods=['POST'])
@jwt_required()
def checkout_cart(cart_id):
    """
    Purchase all seats in a cart - converts reserved seats to sold.
    This endpoint replaces direct seat purchase - user must reserve first.
    
    Creates:
    - Order with all seats
    - OrderItems for each seat
    - Tickets for each order item
    - Updates seat status from HELD to SOLD
    - Marks cart as CONVERTED
    """
    import uuid
    
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify cart belongs to user and is open
        cursor.execute('''
            SELECT c.*, e.event_id, e.event_name
            FROM Carts c
            JOIN Events e ON c.event_id = e.event_id
            WHERE c.cart_id = ? AND c.user_id = ? AND c.status = 'OPEN'
        ''', (cart_id, user_id))
        cart = cursor.fetchone()
        
        if not cart:
            conn.close()
            return jsonify({'error': 'Cart not found or already processed'}), 404
        
        # Check if cart has expired
        if cart['expires_at'] < datetime.utcnow().isoformat():
            # Expire the cart
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ?', (cart_id,))
            conn.commit()
            conn.close()
            return jsonify({'error': 'Cart has expired. Please reserve seats again.'}), 410
        
        event_id = cart['event_id']
        
        # Get all seats in cart with pricing
        cursor.execute('''
            SELECT s.seat_id, s.section, pt.price_cents
            FROM CartSeats cs
            JOIN Seats s ON cs.seat_id = s.seat_id
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE cs.cart_id = ?
        ''', (event_id, cart_id))
        seats = cursor.fetchall()
        
        if not seats:
            conn.close()
            return jsonify({'error': 'Cart is empty'}), 400
        
        # Verify all seats are still held by this cart
        for seat in seats:
            cursor.execute('''
                SELECT status, held_by_cart_id FROM EventSeatStatus
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat['seat_id']))
            status = cursor.fetchone()
            if not status or status['status'] != 'HELD' or status['held_by_cart_id'] != cart_id:
                conn.close()
                return jsonify({
                    'error': f'Seat {seat["seat_id"]} is no longer reserved for you'
                }), 409
        
        # Calculate total
        total_cents = sum(s['price_cents'] or 0 for s in seats)
        
        # Create the order
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        
        # Create order items and tickets for each seat
        for seat in seats:
            seat_id = seat['seat_id']
            price_cents = seat['price_cents'] or 0
            
            # Create order item
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
            # Generate barcode and create ticket
            barcode = str(uuid.uuid4()).replace('-', '')[:16].upper()
            cursor.execute('''
                INSERT INTO Tickets (order_item_id, barcode_num, status)
                VALUES (?, ?, 'ISSUED')
            ''', (order_item_id, barcode))
            ticket_id = cursor.lastrowid
            
            tickets_created.append({
                'ticket_id': ticket_id,
                'seat_id': seat_id,
                'barcode': barcode,
                'price_cents': price_cents
            })
            
            # Update seat status to SOLD
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'SOLD', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
        
        # Mark cart as converted
        cursor.execute('''
            UPDATE Carts SET status = 'CONVERTED' WHERE cart_id = ?
        ''', (cart_id,))
        
        # Clear cart seats
        cursor.execute('DELETE FROM CartSeats WHERE cart_id = ?', (cart_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Purchase completed successfully',
            'order_id': order_id,
            'event_name': cart['event_name'],
            'total_cents': total_cents,
            'tickets': tickets_created
        }), 201
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/admin/expired-holds', methods=['POST'])
@jwt_required()
@admin_required()
def cleanup_expired_holds():
    """
    Admin endpoint to clean up expired seat holds.
    This would typically be run by a scheduled job.
    
    - Finds seats where hold has expired
    - Sets them back to AVAILABLE
    - Marks associated carts as EXPIRED
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        now = datetime.utcnow().isoformat()
        
        # Find expired holds
        cursor.execute('''
            SELECT event_id, seat_id, held_by_cart_id 
            FROM EventSeatStatus 
            WHERE status = 'HELD' AND hold_expires_at < ?
        ''', (now,))
        expired = cursor.fetchall()
        
        released_count = 0
        cart_ids = set()
        
        for row in expired:
            # Release the seat
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'AVAILABLE', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (row['event_id'], row['seat_id']))
            
            if row['held_by_cart_id']:
                cart_ids.add(row['held_by_cart_id'])
            
            released_count += 1
        
        # Mark carts as expired
        for cart_id in cart_ids:
            cursor.execute('''
                UPDATE Carts SET status = 'EXPIRED' WHERE cart_id = ? AND status = 'OPEN'
            ''', (cart_id,))
            # Clear cart seats
            cursor.execute('DELETE FROM CartSeats WHERE cart_id = ?', (cart_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Expired holds cleaned up',
            'seats_released': released_count,
            'carts_expired': len(cart_ids)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    """
    Get a specific ticket's details.
    User can only view their own tickets.
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT t.*, oi.seat_id, oi.unit_price_cents,
                   s.row_label, s.seat_number, s.section,
                   o.order_id, o.user_id, o.event_id,
                   e.event_name, e.start_datetime,
                   v.venue_name, v.city
            FROM Tickets t
            JOIN OrderItems oi ON t.order_item_id = oi.order_item_id
            JOIN Orders o ON oi.order_id = o.order_id
            JOIN Seats s ON oi.seat_id = s.seat_id
            JOIN Events e ON o.event_id = e.event_id
            LEFT JOIN Venues v ON e.venue_id = v.venue_id
            WHERE t.ticket_id = ?
        ''', (ticket_id,))
        ticket = cursor.fetchone()
        conn.close()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Security: verify user owns this ticket
        if ticket['user_id'] != user_id and current_user.get('role') != 'ADMIN':
            return jsonify({'error': 'Access denied'}), 403
        
        # Return ticket without exposing user_id
        result = {
            'ticket_id': ticket['ticket_id'],
            'barcode_num': ticket['barcode_num'],
            'status': ticket['status'],
            'issued_at': ticket['issued_at'],
            'seat': {
                'row_label': ticket['row_label'],
                'seat_number': ticket['seat_number'],
                'section': ticket['section']
            },
            'event': {
                'event_id': ticket['event_id'],
                'event_name': ticket['event_name'],
                'start_datetime': ticket['start_datetime'],
                'venue_name': ticket['venue_name'],
                'city': ticket['city']
            },
            'price_cents': ticket['unit_price_cents']
        }
        
        return jsonify({'ticket': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/tickets/<int:ticket_id>/scan', methods=['POST'])
@jwt_required()
@admin_required()
def scan_ticket(ticket_id):
    """
    Admin endpoint to scan/validate a ticket at entry.
    Changes ticket status to SCANNED.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT status FROM Tickets WHERE ticket_id = ?', (ticket_id,))
        ticket = cursor.fetchone()
        
        if not ticket:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404
        
        if ticket['status'] == 'SCANNED':
            conn.close()
            return jsonify({'error': 'Ticket has already been scanned'}), 409
        
        if ticket['status'] == 'VOIDED':
            conn.close()
            return jsonify({'error': 'Ticket has been voided'}), 400
        
        cursor.execute('''
            UPDATE Tickets SET status = 'SCANNED' WHERE ticket_id = ?
        ''', (ticket_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Ticket scanned successfully', 'ticket_id': ticket_id}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/tickets/<int:ticket_id>/void', methods=['POST'])
@jwt_required()
@admin_required()
def void_ticket(ticket_id):
    """
    Admin endpoint to void a ticket (e.g., for refunds).
    Changes ticket status to VOIDED and sets seat back to AVAILABLE.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get ticket with seat info
        cursor.execute('''
            SELECT t.status, oi.seat_id, o.event_id
            FROM Tickets t
            JOIN OrderItems oi ON t.order_item_id = oi.order_item_id
            JOIN Orders o ON oi.order_id = o.order_id
            WHERE t.ticket_id = ?
        ''', (ticket_id,))
        ticket = cursor.fetchone()
        
        if not ticket:
            conn.close()
            return jsonify({'error': 'Ticket not found'}), 404
        
        if ticket['status'] == 'VOIDED':
            conn.close()
            return jsonify({'error': 'Ticket is already voided'}), 400
        
        # Void the ticket
        cursor.execute('''
            UPDATE Tickets SET status = 'VOIDED' WHERE ticket_id = ?
        ''', (ticket_id,))
        
        # Set seat back to available
        cursor.execute('''
            UPDATE EventSeatStatus 
            SET status = 'AVAILABLE', updated_at = datetime('now')
            WHERE event_id = ? AND seat_id = ?
        ''', (ticket['event_id'], ticket['seat_id']))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Ticket voided successfully',
            'ticket_id': ticket_id,
            'seat_id': ticket['seat_id']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)


@app.route('/events/image', methods=['GET'])
def get_event_image():
    # Get the image URL for a specific event by event_id
    event_id = request.args.get('event_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT image_url FROM Events WHERE event_id = ?', (event_id,))
        row = cursor.fetchone()
        if row and row['image_url']:
            return jsonify({'image_url': row['image_url']}), 200
        else:
            return jsonify({'error': 'Image URL not found for the given event_id'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/create-payment-intent', methods=['POST'])
@jwt_required()
def create_payment_intent():
    """
    Create a Stripe PaymentIntent for the user's cart.
    
    Expected JSON: { "cart_id": 123 }
    
    Flow:
    1. Verify cart belongs to user and is still valid (not expired)
    2. Calculate total from cart seats with pricing
    3. Create Stripe PaymentIntent
    4. Return client_secret for frontend to complete payment
    """
    import uuid
    
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        data = request.json
        cart_id = data.get('cart_id')
        
        if not cart_id:
            return jsonify({'error': 'cart_id is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify cart belongs to user and is open
        cursor.execute('''
            SELECT c.*, e.event_id, e.event_name
            FROM Carts c
            JOIN Events e ON c.event_id = e.event_id
            WHERE c.cart_id = ? AND c.user_id = ? AND c.status = 'OPEN'
        ''', (cart_id, user_id))
        cart = cursor.fetchone()
        
        if not cart:
            conn.close()
            return jsonify({'error': 'Cart not found or already processed'}), 404
        
        # Check if cart has expired
        if cart['expires_at'] < datetime.utcnow().isoformat():
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ?', (cart_id,))
            conn.commit()
            conn.close()
            return jsonify({'error': 'Cart has expired. Please reserve seats again.'}), 410
        
        event_id = cart['event_id']
        
        # Get all seats in cart with pricing
        cursor.execute('''
            SELECT s.seat_id, s.section, s.row_label, s.seat_number, 
                   COALESCE(pt.price_cents, 0) as price_cents
            FROM CartSeats cs
            JOIN Seats s ON cs.seat_id = s.seat_id
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE cs.cart_id = ?
        ''', (event_id, cart_id))
        seats = cursor.fetchall()
        
        if not seats:
            conn.close()
            return jsonify({'error': 'Cart is empty'}), 400
        
        # Verify all seats are still held by this cart
        for seat in seats:
            cursor.execute('''
                SELECT status, held_by_cart_id FROM EventSeatStatus
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat['seat_id']))
            status = cursor.fetchone()
            if not status or status['status'] != 'HELD' or status['held_by_cart_id'] != cart_id:
                conn.close()
                return jsonify({
                    'error': f'Seat {seat["row_label"]}{seat["seat_number"]} is no longer reserved for you'
                }), 409
        
        conn.close()
        
        # Calculate total amount in cents
        total_cents = sum(seat['price_cents'] for seat in seats)
        
        if total_cents <= 0:
            return jsonify({'error': 'Invalid total amount'}), 400
        
        # Create Stripe PaymentIntent with metadata for verification later
        payment_intent = stripe.PaymentIntent.create(
            amount=total_cents,
            currency='usd',
            metadata={
                'cart_id': str(cart_id),
                'user_id': str(user_id),
                'event_id': str(event_id),
                'seat_count': str(len(seats))
            }
        )
        
        return jsonify({
            'clientSecret': payment_intent['client_secret'],
            'paymentIntentId': payment_intent['id'],
            'amount': total_cents,
            'currency': 'usd',
            'cart_id': cart_id,
            'seat_count': len(seats)
        }), 200
        
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Stripe error: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/complete-purchase', methods=['POST'])
@jwt_required()
def complete_purchase():
    """
    Complete a purchase after successful Stripe payment.
    
    Expected JSON: { "paymentIntentId": "pi_xxx", "cart_id": 123 }
    
    Flow:
    1. Verify payment was successful with Stripe
    2. Verify cart still belongs to user and matches payment metadata
    3. Create Order, OrderItems, and Tickets
    4. Update seat status from HELD to SOLD
    5. Mark cart as CONVERTED
    6. Return order details with tickets
    """
    import uuid
    
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        data = request.json
        payment_intent_id = data.get('paymentIntentId')
        cart_id = data.get('cart_id')
        
        if not payment_intent_id or not cart_id:
            return jsonify({'error': 'paymentIntentId and cart_id are required'}), 400
        
        # Retrieve and verify payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status != 'succeeded':
            return jsonify({
                'error': 'Payment not successful',
                'payment_status': payment_intent.status
            }), 400
        
        # Verify metadata matches (security check)
        metadata = payment_intent.metadata
        if metadata.get('cart_id') != str(cart_id) or metadata.get('user_id') != str(user_id):
            return jsonify({'error': 'Payment verification failed - cart mismatch'}), 403
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify cart belongs to user and is still open
        cursor.execute('''
            SELECT c.*, e.event_id, e.event_name
            FROM Carts c
            JOIN Events e ON c.event_id = e.event_id
            WHERE c.cart_id = ? AND c.user_id = ? AND c.status = 'OPEN'
        ''', (cart_id, user_id))
        cart = cursor.fetchone()
        
        if not cart:
            conn.close()
            return jsonify({'error': 'Cart not found or already processed'}), 404
        
        event_id = cart['event_id']
        
        # Get all seats in cart with pricing
        cursor.execute('''
            SELECT s.seat_id, s.section, s.row_label, s.seat_number,
                   COALESCE(pt.price_cents, 0) as price_cents, pt.tier_name
            FROM CartSeats cs
            JOIN Seats s ON cs.seat_id = s.seat_id
            LEFT JOIN SectionPricing sp ON s.section = sp.section AND sp.event_id = ?
            LEFT JOIN PriceTiers pt ON sp.price_tier_id = pt.price_tier_id
            WHERE cs.cart_id = ?
        ''', (event_id, cart_id))
        seats = cursor.fetchall()
        
        if not seats:
            conn.close()
            return jsonify({'error': 'Cart is empty'}), 400
        
        # Verify all seats are still held by this cart
        for seat in seats:
            cursor.execute('''
                SELECT status, held_by_cart_id FROM EventSeatStatus
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat['seat_id']))
            status = cursor.fetchone()
            if not status or status['status'] != 'HELD' or status['held_by_cart_id'] != cart_id:
                conn.close()
                return jsonify({
                    'error': f'Seat {seat["row_label"]}{seat["seat_number"]} is no longer reserved'
                }), 409
        
        # Calculate total (should match payment intent)
        total_cents = sum(seat['price_cents'] for seat in seats)
        
        # Create the order with Stripe payment reference
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        
        # Create order items and tickets for each seat
        for seat in seats:
            seat_id = seat['seat_id']
            price_cents = seat['price_cents']
            
            # Create order item
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
            # Generate unique barcode and create ticket
            barcode = str(uuid.uuid4()).replace('-', '')[:16].upper()
            cursor.execute('''
                INSERT INTO Tickets (order_item_id, barcode_num, status)
                VALUES (?, ?, 'ISSUED')
            ''', (order_item_id, barcode))
            ticket_id = cursor.lastrowid
            
            tickets_created.append({
                'ticket_id': ticket_id,
                'seat_id': seat_id,
                'row_label': seat['row_label'],
                'seat_number': seat['seat_number'],
                'section': seat['section'],
                'barcode': barcode,
                'price_cents': price_cents
            })
            
            # Update seat status to SOLD
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'SOLD', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
        
        # Mark cart as converted
        cursor.execute('''
            UPDATE Carts SET status = 'CONVERTED' WHERE cart_id = ?
        ''', (cart_id,))
        
        # Clear cart seats
        cursor.execute('DELETE FROM CartSeats WHERE cart_id = ?', (cart_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Purchase completed successfully',
            'order_id': order_id,
            'event_name': cart['event_name'],
            'event_id': event_id,
            'total_cents': total_cents,
            'total_dollars': total_cents / 100,
            'payment_intent_id': payment_intent_id,
            'tickets': tickets_created,
            'ticket_count': len(tickets_created)
        }), 201
        
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Stripe error: {str(e)}'}), 400
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({'error': str(e)}), 500