# Tessera

## Overview

Tessera is a full-stack event ticketing platform that enables users to browse events, select seats from an interactive seat map, and complete purchases via Stripe. It provides a complete ticketing workflow including seat reservations with time-limited holds, shopping cart management, and digital ticket generation with barcodes.

**Target Users:**
- End users purchasing event tickets
- Event administrators managing venues, events, and ticket validation

**Core Functionality:**
- Browse upcoming events with venue information
- Interactive seat selection with real-time availability
- Time-limited seat reservations (10-minute hold)
- Stripe-integrated checkout flow
- Digital ticket issuance with unique barcodes
- Admin tools for ticket scanning and void operations

## Tech Stack

### Backend
- **Language:** Python 3
 - **Framework:** Flask
- **Authentication:** Flask-JWT-Extended (JWT with access/refresh tokens)
- **Database:** SQLite
- **Payment Processing:** Stripe API
- **Additional Libraries:**
  - `flask-cors` - Cross-Origin Resource Sharing
  - `python-dotenv` - Environment variable management
  - `werkzeug` - Password hashing

### Frontend
- **Language:** JavaScript (ES6+)
- **Framework:** React 18
- **Build Tool:** Vite
- **UI Library:** Chakra UI
- **Routing:** React Router v6
- **Payment UI:** Stripe Elements (@stripe/react-stripe-js)
- **Additional Libraries:**
  - `framer-motion` - Animations
  - `tessera-seat-picker` - Custom seat selection component

### Database
- **Engine:** SQLite 3
- **Schema:** Relational with 11 tables covering users, venues, events, seats, pricing, carts, orders, and tickets

## Project Structure

```
tessera/
├── backend/
│   ├── app.py              # Flask API (all routes and business logic)
│   ├── .env                # Environment variables (not committed)
│   └── .env.example        # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # React app entry, route definitions
│   │   ├── main.jsx        # React DOM render
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigation bar
│   │   │   ├── EventCard.jsx       # Event listing card
│   │   │   ├── SIgnIn.jsx          # Sign-in form
│   │   │   └── TesseraSeatPicker.jsx
│   │   └── pages/
│   │       ├── EventsPage.jsx      # Event listing page
│   │       ├── EventDetail.jsx     # Event detail with seat map
│   │       ├── Checkout.jsx        # Cart and Stripe payment
│   │       ├── MyProfile.jsx       # User profile
│   │       └── Register.jsx        # User registration
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── tessera.db          # SQLite database file
├── .gitignore
└── package.json
```

## Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- Stripe account (for payment processing)

### Backend Setup

```bash
# Navigate to backend directory
cd tessera/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your actual Stripe secret key (starts with sk_test_)
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd tessera/frontend

# Install dependencies
npm install
```

### Environment Variables

Create `backend/.env` with the following variables:

```env
# Stripe API Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production

# Database path (optional - defaults to ../database/tessera.db)
# DATABASE_PATH=../database/tessera.db
```

**Important:** 
- The Stripe **secret key** must start with `sk_test_` (not `pk_test_` or `spk_test_`)
- The Stripe **publishable key** (`pk_test_...`) is configured in `frontend/src/config.js`

## Running the Project

### Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```

The API server runs on `http://localhost:5000` by default.

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173` (Vite default).

### Default Ports

| Service  | Port |
|----------|------|
| Backend  | 5000 |
| Frontend | 5173 |

### Test Credentials

For testing Stripe payments, use:
- **Card:** `4242 4242 4242 4242`
- **Expiry:** Any future date
- **CVC:** Any 3 digits

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/user` | Register new user | No |
| POST | `/login` | Login, returns JWT tokens | No |
| POST | `/refresh` | Refresh access token | Refresh Token |
| GET | `/me` | Get current user profile | Yes |
| PUT | `/change_password` | Change password | Yes |
| POST | `/change_username_email` | Update username/email | Yes |
| DELETE | `/user` | Delete account | Yes |

### Event Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/events` | List all events (optional `?afterDate=`) | No |
| GET | `/events/<id>` | Get event details | No |
| POST | `/events` | Create event | Admin |
| PATCH | `/events` | Update event | Admin |
| GET | `/events/<id>/seats` | Get seats with availability | No |
| GET | `/events/<id>/inventory` | Get inventory summary | No |

### Venue Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/venues` | List all venues | No |
| POST | `/venues` | Create venue | Admin |
| GET | `/venues/<id>/seats` | Get venue seats | No |

### Cart & Reservation Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/cart` | Get user's active carts | Yes |
| POST | `/events/<id>/reserve` | Reserve seats (10-min hold) | Yes |
| POST | `/events/<id>/release` | Release held seats | Yes |
| POST | `/cart/<id>/checkout` | Checkout cart (non-Stripe) | Yes |

### Payment Endpoints (Stripe)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/create-payment-intent` | Create Stripe PaymentIntent | Yes |
| POST | `/complete-purchase` | Complete purchase after payment | Yes |

### Order & Ticket Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/orders` | Get user's orders | Yes |
| POST | `/orders` | Create order (direct purchase) | Yes |
| GET | `/tickets/<id>` | Get ticket details | Yes |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/emails` | Get all user emails | Admin |
| POST | `/admin/expired-holds` | Cleanup expired seat holds | Admin |
| POST | `/admin/tickets/<id>/scan` | Mark ticket as scanned | Admin |
| POST | `/admin/tickets/<id>/void` | Void a ticket | Admin |

## Configuration

### JWT Configuration

- **Access Token Expiry:** 15 minutes
- **Refresh Token Expiry:** 14 days
- Tokens contain user identity (user_id, username, email, role)

### Seat Reservation System

- Seats are held for **10 minutes** when added to cart
- Expired holds can be cleaned up via `/admin/expired-holds`
- Seat statuses: `AVAILABLE`, `HELD`, `SOLD`

### Database Location

The SQLite database is located at `database/tessera.db` relative to the project root. The backend connects using the path `../database/tessera.db` from the `backend/` directory.

## Security Notes

### Secret Management

- **Never commit secrets** to version control
- Store all secrets in `.env` files (git-ignored)
- The application will fail to start if `STRIPE_SECRET_KEY` is not set
- Use strong, unique values for `JWT_SECRET_KEY` in production

### Authentication

- Passwords are hashed using Werkzeug's `generate_password_hash` (PBKDF2)
- JWT tokens are used for stateless authentication
- Role-based access control with `CUSTOMER` and `ADMIN` roles
- Admin endpoints are protected with `@admin_required()` decorator

### Payment Security

- Card details are handled entirely by Stripe (PCI compliant)
- Backend only receives PaymentIntent confirmations
- Payment metadata links cart, user, and event for verification

## Development Notes

### Code Organization

The backend follows a single-file architecture with clear section headers:
- Imports
- App Configuration
- Database Helpers
- JWT Configuration & Helpers
- Role-Based Access Control Decorators
- Endpoint groups by feature (Auth, Users, Venues, Events, Cart, Payment, Orders, Admin)

### Adding New Endpoints

1. Add route decorator with appropriate HTTP method
2. Apply `@jwt_required()` for authenticated endpoints
3. Apply `@admin_required()` for admin-only endpoints
4. Use `get_current_user()` to access the authenticated user
5. Use `get_db_connection()` for database access

### Frontend State Management

- Authentication tokens stored in `localStorage`
- Automatic token refresh on 401 responses
- Cart state managed per-page (not global)

## Known Limitations / TODOs

- **No scheduled job** for cleaning up expired seat holds (manual admin endpoint exists)
- **Single-file backend** - could be refactored into blueprints for larger scale
- **No email verification** for user registration
- **No password reset** functionality
- **SQLite** is used - not suitable for high-concurrency production use
- **Hardcoded frontend Stripe key** - should be moved to environment configuration
- **No comprehensive test suite**
- **JWT secret** has a fallback default value - should be required in production

## License

License not specified.
