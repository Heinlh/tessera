from flask import Flask, jsonify, make_response, request # Importing the Flask library and some helper functions
import sqlite3 # Library for talking to our database
from datetime import datetime # We'll be working with dates 
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__) # Creating a new Flask app. This will help us create API endpoints hiding the complexity of writing network code!

# This function returns a connection to the database which can be used to send SQL commands to the database
def get_db_connection():
  conn = sqlite3.connect('../database/tessera.db')
  conn.row_factory = sqlite3.Row
  return conn

# When asked, add code in this area
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

@app.route('/change_username_email', methods=['POST'])
def change_username_email():
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

      