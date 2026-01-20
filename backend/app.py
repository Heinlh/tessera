"""
Tessera Backend API
A REST API for ticketing, events, and seat reservations backed by SQLite.
"""

# =============================================================================
# IMPORTS
# =============================================================================
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash
import stripe


# =============================================================================
# APP CONFIGURATION
# =============================================================================
# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Stripe configuration - MUST be set via environment variable
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
if not stripe.api_key:
    raise RuntimeError("STRIPE_SECRET_KEY environment variable is required")

# JWT configuration
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=14)

jwt = JWTManager(app)


# =============================================================================
# DATABASE HELPERS
# =============================================================================
def get_db_connection():
    """Return a SQLite connection object configured to return rows as dict-like objects."""
    conn = sqlite3.connect('../database/tessera.db')
    conn.row_factory = sqlite3.Row
    return conn


# =============================================================================
# JWT CONFIGURATION & HELPERS
# =============================================================================
@jwt.user_identity_loader
def user_identity_lookup(user):
    """Convert user dict to JSON string for JWT subject."""
    if isinstance(user, dict):
        return json.dumps(user)
    return user


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """Load user from JWT - returns the identity."""
    identity = jwt_data["sub"]
    if isinstance(identity, str):
        try:
            return json.loads(identity)
        except json.JSONDecodeError:
            return identity
    return identity


def get_current_user():
    """
    Helper function to get the current user identity as a dictionary.
    Use this instead of get_jwt_identity() directly.
    """
    identity = get_jwt_identity()
    if isinstance(identity, str):
        try:
            return json.loads(identity)
        except json.JSONDecodeError:
            return {'user_id': identity}
    return identity


# =============================================================================
# ROLE-BASED ACCESS CONTROL DECORATORS
# =============================================================================
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


# =============================================================================
# AUTHENTICATION ENDPOINTS
# =============================================================================
@app.route('/user', methods=['POST'])
def create_user():
    """
    Create a new user account.
    Expected JSON: { "email": "...", "username": "...", "password": "..." }
    """
    email = request.json.get('email')
    username = request.json.get('username')
    password = request.json.get('password')

    if not email or not username or not password:
        return jsonify({'error': 'All fields (email, username, and password) are required.'}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO Users (email, username, password_hash, role) VALUES (?, ?, ?, ?)',
            (email, username, hashed_password, 'CUSTOMER')
        )
        conn.commit()
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
    """
    Login endpoint that validates username/password and returns JWT tokens.
    Returns both access_token (short-lived) and refresh_token (long-lived).
    """
    username = request.json.get('username')
    password = request.json.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT user_id, username, email, password_hash, role FROM Users WHERE username = ?',
        (username,)
    )
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        user_identity = {
            'user_id': user['user_id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role']
        }
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
    Returns a new access_token and refresh_token.
    """
    current_user = get_current_user()
    new_access_token = create_access_token(identity=current_user)
    new_refresh_token = create_refresh_token(identity=current_user)
    
    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }), 200


@app.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    """Get the current authenticated user's profile."""
    current_user = get_current_user()
    return jsonify({'user': current_user}), 200


# =============================================================================
# USER MANAGEMENT ENDPOINTS
# =============================================================================
@app.route('/change_password', methods=['PUT'])
@jwt_required()
def change_password():
    """Change a user's password. Requires current password for verification."""
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

    try:
        new_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE Users SET password_hash = ? WHERE user_id = ?', (new_hash, user_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Password updated successfully'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/change_username_email', methods=['POST'])
@jwt_required()
def change_username_email():
    """Change a user's username and email after verifying their password."""
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
            cursor.execute(
                'UPDATE Users SET username = ?, email = ? WHERE user_id = ?',
                (new_username, new_email, user_id)
            )
            conn.commit()
            conn.close()
            return jsonify({'message': 'Username and email updated successfully'}), 200
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Username or email already exists.'}), 409
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid user ID or password'}), 401


@app.route('/user', methods=['DELETE'])
@jwt_required()
def delete_user():
    """Delete a user account and any related data. Requires password verification."""
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
        cursor.execute('DELETE FROM Carts WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM Orders WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM Users WHERE user_id = ?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User and associated data deleted'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


# =============================================================================
# VENUE ENDPOINTS
# =============================================================================
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
        cursor.execute(
            'INSERT INTO Venues (venue_name, city, state, country, timezone) VALUES (?, ?, ?, ?, ?)',
            (venue_name, city, state, country, timezone)
        )
        conn.commit()
        venue_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'Venue created', 'venue_id': venue_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/venues/<int:venue_id>/seats', methods=['GET'])
def get_venue_seats(venue_id):
    """Get all seats for a venue."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM Seats WHERE venue_id = ? ORDER BY row_label, col_index',
            (venue_id,)
        )
        seats = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'seats': seats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# EVENT ENDPOINTS
# =============================================================================
@app.route('/events', methods=['GET'])
def get_events():
    """Get all events with optional date filter."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT e.*, v.venue_name, v.city, v.state, v.country
        FROM Events e
        LEFT JOIN Venues v ON e.venue_id = v.venue_id
    '''
    params = []
    
    after_date = request.args.get('afterDate')
    if after_date:
        query += ' WHERE e.start_datetime > ?'
        params.append(after_date)
    
    cursor.execute(query, params)
    events = [dict(event) for event in cursor.fetchall()]
    conn.close()
    
    return jsonify(events)


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


@app.route('/events', methods=['POST'])
@jwt_required()
@admin_required()
def create_event():
    """Create a new event. Requires admin authentication."""
    venue_id = request.json.get('venue_id')
    event_name = request.json.get('event_name')
    start_datetime = request.json.get('start_datetime')
    event_description = request.json.get('event_description', '')
    image_url = request.json.get('image_url', '')
    status = request.json.get('status', 'SCHEDULED')

    if not venue_id or not event_name or not start_datetime:
        return jsonify({'error': 'venue_id, event_name, and start_datetime are required'}), 400

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


@app.route('/events', methods=['PATCH'])
@jwt_required()
@admin_required()
def update_event():
    """Update event details. Requires admin authentication."""
    event_id = request.json.get('event_id')
    event_name = request.json.get('event_name')
    start_datetime = request.json.get('start_datetime')
    event_description = request.json.get('event_description')
    image_url = request.json.get('image_url')
    status = request.json.get('status')
    venue_id = request.json.get('venue_id')

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


@app.route('/events/image', methods=['GET'])
def get_event_image():
    """Get the image URL for a specific event by event_id."""
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


# =============================================================================
# SEAT & INVENTORY ENDPOINTS
# =============================================================================
@app.route('/events/<int:event_id>/seats', methods=['GET'])
def get_event_seats(event_id):
    """Get all seats for an event with availability status and pricing."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT venue_id FROM Events WHERE event_id = ?', (event_id,))
        event = cursor.fetchone()
        if not event:
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
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


@app.route('/events/<int:event_id>/inventory', methods=['GET'])
def get_event_inventory(event_id):
    """
    Get seat inventory/availability summary for an event.
    PUBLIC endpoint - does NOT expose who owns seats.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT venue_id, status FROM Events WHERE event_id = ?', (event_id,))
        event = cursor.fetchone()
        if not event:
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
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


# =============================================================================
# CART & RESERVATION ENDPOINTS
# =============================================================================
@app.route('/cart', methods=['GET'])
@jwt_required()
def get_cart():
    """Get the current user's active cart with reserved seats."""
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    seat_ids = request.json.get('seat_ids', [])
    sections_request = request.json.get('sections', {})
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
            cursor.execute('UPDATE Carts SET expires_at = ? WHERE cart_id = ?', (expires_at, cart_id))
        else:
            cursor.execute('''
                INSERT INTO Carts (user_id, event_id, status, expires_at)
                VALUES (?, ?, 'OPEN', ?)
            ''', (user_id, event_id, expires_at))
            cart_id = cursor.lastrowid
        
        # Add seats to cart and update their status
        for seat_id in seat_ids:
            cursor.execute('INSERT OR IGNORE INTO CartSeats (cart_id, seat_id) VALUES (?, ?)', (cart_id, seat_id))
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
        
        reserved_seats = [{
            'seat_id': row['seat_id'],
            'row_name': row['row_label'],
            'seat_number': row['seat_number'],
            'section': row['section'],
            'price': (row['price_cents'] or 0) / 100,
            'tier_name': row['tier_name']
        } for row in cursor.fetchall()]
        
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
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    seat_ids = request.json.get('seat_ids', [])
    if not seat_ids:
        return jsonify({'error': 'seat_ids is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
            cursor.execute('''
                SELECT status, held_by_cart_id FROM EventSeatStatus
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
            status_row = cursor.fetchone()
            
            if status_row and status_row['held_by_cart_id'] == cart_id:
                cursor.execute('DELETE FROM CartSeats WHERE cart_id = ? AND seat_id = ?', (cart_id, seat_id))
                cursor.execute('''
                    UPDATE EventSeatStatus 
                    SET status = 'AVAILABLE', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                    WHERE event_id = ? AND seat_id = ?
                ''', (event_id, seat_id))
                released_seats.append(seat_id)
        
        # If cart is now empty, mark as expired
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


# =============================================================================
# CHECKOUT & PAYMENT ENDPOINTS
# =============================================================================
@app.route('/cart/<int:cart_id>/checkout', methods=['POST'])
@jwt_required()
def checkout_cart(cart_id):
    """
    Purchase all seats in a cart (non-Stripe flow).
    Creates Order, OrderItems, Tickets, and updates seat status.
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
        
        if cart['expires_at'] < datetime.utcnow().isoformat():
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ?', (cart_id,))
            conn.commit()
            conn.close()
            return jsonify({'error': 'Cart has expired. Please reserve seats again.'}), 410
        
        event_id = cart['event_id']
        
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
                return jsonify({'error': f'Seat {seat["seat_id"]} is no longer reserved for you'}), 409
        
        total_cents = sum(s['price_cents'] or 0 for s in seats)
        
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        for seat in seats:
            seat_id = seat['seat_id']
            price_cents = seat['price_cents'] or 0
            
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
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
            
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'SOLD', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
        
        cursor.execute('UPDATE Carts SET status = "CONVERTED" WHERE cart_id = ?', (cart_id,))
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


@app.route('/create-payment-intent', methods=['POST'])
@jwt_required()
def create_payment_intent():
    """
    Create a Stripe PaymentIntent for the user's cart.
    Expected JSON: { "cart_id": 123 }
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        data = request.json
        cart_id = data.get('cart_id')
        
        if not cart_id:
            return jsonify({'error': 'cart_id is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
        
        if cart['expires_at'] < datetime.utcnow().isoformat():
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ?', (cart_id,))
            conn.commit()
            conn.close()
            return jsonify({'error': 'Cart has expired. Please reserve seats again.'}), 410
        
        event_id = cart['event_id']
        
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
        
        total_cents = sum(seat['price_cents'] for seat in seats)
        
        if total_cents <= 0:
            return jsonify({'error': 'Invalid total amount'}), 400
        
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
    """
    current_user = get_current_user()
    user_id = current_user['user_id']
    
    try:
        data = request.json
        payment_intent_id = data.get('paymentIntentId')
        cart_id = data.get('cart_id')
        
        if not payment_intent_id or not cart_id:
            return jsonify({'error': 'paymentIntentId and cart_id are required'}), 400
        
        # Verify payment with Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status != 'succeeded':
            return jsonify({
                'error': 'Payment not successful',
                'payment_status': payment_intent.status
            }), 400
        
        # Security check - verify metadata matches
        metadata = payment_intent.metadata
        if metadata.get('cart_id') != str(cart_id) or metadata.get('user_id') != str(user_id):
            return jsonify({'error': 'Payment verification failed - cart mismatch'}), 403
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
        
        total_cents = sum(seat['price_cents'] for seat in seats)
        
        # Create order
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        for seat in seats:
            seat_id = seat['seat_id']
            price_cents = seat['price_cents']
            
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
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
            
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'SOLD', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (event_id, seat_id))
        
        cursor.execute('UPDATE Carts SET status = "CONVERTED" WHERE cart_id = ?', (cart_id,))
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


# =============================================================================
# ORDER ENDPOINTS
# =============================================================================
@app.route('/orders', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create an order and purchase tickets for seats (direct purchase, bypassing cart).
    Expected JSON: { "event_id": 1, "seat_ids": [1, 2, 3] }
    """
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
            cursor.execute('SELECT section FROM Seats WHERE seat_id = ?', (seat_id,))
            seat = cursor.fetchone()
            if not seat:
                conn.close()
                return jsonify({'error': f'Seat {seat_id} not found'}), 404
            
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
        
        cursor.execute('''
            INSERT INTO Orders (user_id, event_id, status, total_cents)
            VALUES (?, ?, 'PAID', ?)
        ''', (user_id, event_id, total_cents))
        order_id = cursor.lastrowid
        
        tickets_created = []
        for seat_id, price_cents in seat_prices:
            cursor.execute('''
                INSERT INTO OrderItems (order_id, seat_id, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?)
            ''', (order_id, seat_id, price_cents, price_cents))
            order_item_id = cursor.lastrowid
            
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
    """Get all orders for the current user with their tickets."""
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
# TICKET ENDPOINTS
# =============================================================================
@app.route('/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    """Get a specific ticket's details. User can only view their own tickets."""
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
        
        if ticket['user_id'] != user_id and current_user.get('role') != 'ADMIN':
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'ticket': {
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
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================
@app.route('/emails', methods=['GET'])
@jwt_required()
@admin_required()
def get_all_emails():
    """Return all user emails. Requires admin authentication."""
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


@app.route('/admin/expired-holds', methods=['POST'])
@jwt_required()
@admin_required()
def cleanup_expired_holds():
    """
    Admin endpoint to clean up expired seat holds.
    This would typically be run by a scheduled job.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        now = datetime.utcnow().isoformat()
        
        cursor.execute('''
            SELECT event_id, seat_id, held_by_cart_id 
            FROM EventSeatStatus 
            WHERE status = 'HELD' AND hold_expires_at < ?
        ''', (now,))
        expired = cursor.fetchall()
        
        released_count = 0
        cart_ids = set()
        
        for row in expired:
            cursor.execute('''
                UPDATE EventSeatStatus 
                SET status = 'AVAILABLE', held_by_cart_id = NULL, hold_expires_at = NULL, updated_at = datetime('now')
                WHERE event_id = ? AND seat_id = ?
            ''', (row['event_id'], row['seat_id']))
            
            if row['held_by_cart_id']:
                cart_ids.add(row['held_by_cart_id'])
            released_count += 1
        
        for cart_id in cart_ids:
            cursor.execute('UPDATE Carts SET status = "EXPIRED" WHERE cart_id = ? AND status = "OPEN"', (cart_id,))
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


@app.route('/admin/tickets/<int:ticket_id>/scan', methods=['POST'])
@jwt_required()
@admin_required()
def scan_ticket(ticket_id):
    """Admin endpoint to scan/validate a ticket at entry."""
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
        
        cursor.execute('UPDATE Tickets SET status = "SCANNED" WHERE ticket_id = ?', (ticket_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Ticket scanned successfully', 'ticket_id': ticket_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/tickets/<int:ticket_id>/void', methods=['POST'])
@jwt_required()
@admin_required()
def void_ticket(ticket_id):
    """Admin endpoint to void a ticket (e.g., for refunds)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
        
        cursor.execute('UPDATE Tickets SET status = "VOIDED" WHERE ticket_id = ?', (ticket_id,))
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


# =============================================================================
# APPLICATION ENTRY POINT
# =============================================================================
if __name__ == '__main__':
    app.run(debug=True)
