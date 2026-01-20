# Tessera Ticketing System

## How the Ticketing System Works

This document explains the complete flow of how users reserve and purchase tickets in Tessera, from browsing events to receiving digital tickets.

---

## Table of Contents

1. [Overview](#overview)
2. [Seat States](#seat-states)
3. [The Complete Purchase Flow](#the-complete-purchase-flow)
4. [Detailed Process Breakdown](#detailed-process-breakdown)
5. [Data Model](#data-model)
6. [Edge Cases & Error Handling](#edge-cases--error-handling)
7. [Admin Operations](#admin-operations)

---

## Overview

Tessera uses a **hold-based reservation system** to prevent overselling while giving users time to complete their purchase. When a user selects a seat, it is temporarily "held" for them for **10 minutes**. During this hold period, no other user can purchase that seat. If the user doesn't complete checkout within 10 minutes, the hold expires and the seat becomes available again.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Browse    │ -> │   Select    │ -> │   Pay via   │ -> │   Receive   │
│   Events    │    │   Seats     │    │   Stripe    │    │   Tickets   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │
                         v
                   ┌─────────────┐
                   │  10-minute  │
                   │    Hold     │
                   └─────────────┘
```

---

## Seat States

Every seat for an event can be in one of three states:

| State | Description | Can be selected? |
|-------|-------------|------------------|
| `AVAILABLE` | Seat is free and can be reserved | ✅ Yes |
| `HELD` | Seat is temporarily reserved by a user (in their cart) | ❌ No |
| `SOLD` | Seat has been purchased and a ticket has been issued | ❌ No |

### State Transitions

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    v                                          │
            ┌───────────────┐                                  │
            │   AVAILABLE   │ <────────────────────────────────┤
            └───────────────┘                                  │
                    │                                          │
                    │ User clicks "Add to Cart"                │
                    │ (POST /events/{id}/reserve)              │
                    v                                          │
            ┌───────────────┐                                  │
            │     HELD      │ ─────────────────────────────────┤
            └───────────────┘    Hold expires (10 min)         │
                    │            OR user releases seat         │
                    │            (POST /events/{id}/release)   │
                    │                                          │
                    │ User completes payment                   │
                    │ (POST /complete-purchase)                │
                    v                                          │
            ┌───────────────┐                                  │
            │     SOLD      │ ─────────────────────────────────┘
            └───────────────┘    Admin voids ticket
                                 (POST /admin/tickets/{id}/void)
```

---

## The Complete Purchase Flow

### Step 1: Browse Events

Users visit the events page to see all upcoming events.

**API Call:** `GET /events?afterDate=2026-01-20`

**Response includes:**
- Event name, description, date/time
- Venue information (name, city, state)
- Event status (SCHEDULED, ON_SALE, CANCELLED, COMPLETED)
- Event image

---

### Step 2: View Event & Seat Map

User clicks on an event to see details and available seats.

**API Calls:**
- `GET /events/{event_id}` - Get event details
- `GET /events/{event_id}/seats` - Get all seats with availability and pricing

**Seat data includes:**
- Seat ID, row label, seat number, section
- Current availability status (AVAILABLE, HELD, SOLD)
- Price (from section-based pricing tiers)

The frontend renders an interactive seat map where:
- **Blue seats** = Available
- **Gray seats** = Sold or held by others
- **Green seats** = Selected by current user (in their cart)

---

### Step 3: Reserve Seats (Add to Cart)

When a user clicks an available seat and confirms selection, the seat is reserved.

**API Call:** `POST /events/{event_id}/reserve`

**Request Body:**
```json
{
  "seat_ids": [101, 102, 103]
}
```

**What happens on the server:**

1. **Validate event status** - Must be `ON_SALE` or `SCHEDULED`
2. **Check seat availability** - All requested seats must be `AVAILABLE`
3. **Create or update cart** - One cart per user per event
4. **Set hold expiration** - Current time + 10 minutes
5. **Update seat status** - Change from `AVAILABLE` to `HELD`
6. **Link seats to cart** - Store in `CartSeats` table

**Response:**
```json
{
  "message": "Seats reserved successfully",
  "cart_id": 42,
  "seats_reserved": 3,
  "reserved_seats": [
    {
      "seat_id": 101,
      "row_name": "A",
      "seat_number": "1",
      "section": "Orchestra",
      "price": 75.00,
      "tier_name": "Premium"
    }
  ],
  "expires_at": "2026-01-20T15:45:00",
  "hold_duration_minutes": 10
}
```

**Important:** The hold is time-limited. If the user doesn't complete checkout within 10 minutes, the seats automatically become available again (when the admin cleanup job runs or when another user tries to reserve them).

---

### Step 4: View Cart

User navigates to checkout to see their reserved seats.

**API Call:** `GET /cart`

**Response:**
```json
{
  "carts": [
    {
      "cart_id": 42,
      "event_id": 1001,
      "event_name": "Taylor Swift - Eras Tour",
      "start_datetime": "2026-03-15T20:00:00",
      "venue_name": "Madison Square Garden",
      "status": "OPEN",
      "expires_at": "2026-01-20T15:45:00",
      "seats": [
        {
          "seat_id": 101,
          "row_label": "A",
          "seat_number": "1",
          "section": "Orchestra",
          "price_cents": 7500,
          "tier_name": "Premium"
        }
      ],
      "total_cents": 7500
    }
  ]
}
```

---

### Step 5: Create Payment Intent

When user clicks "Pay Now", the frontend creates a Stripe PaymentIntent.

**API Call:** `POST /create-payment-intent`

**Request Body:**
```json
{
  "cart_id": 42
}
```

**What happens on the server:**

1. **Validate cart** - Must be OPEN and not expired
2. **Verify seats still held** - Check `EventSeatStatus` table
3. **Calculate total** - Sum all seat prices
4. **Create Stripe PaymentIntent** - With metadata linking to cart/user

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxx",
  "amount": 7500,
  "currency": "usd",
  "cart_id": 42,
  "seat_count": 1
}
```

---

### Step 6: Process Payment (Stripe)

The frontend uses Stripe Elements to collect card details and confirm payment.

```javascript
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'Customer Name' }
  }
});
```

**This happens entirely on the frontend** with Stripe's secure elements. Card details never touch our server (PCI compliant).

---

### Step 7: Complete Purchase

After Stripe confirms payment succeeded, the frontend finalizes the order.

**API Call:** `POST /complete-purchase`

**Request Body:**
```json
{
  "paymentIntentId": "pi_xxx",
  "cart_id": 42
}
```

**What happens on the server:**

1. **Verify with Stripe** - Retrieve PaymentIntent and confirm `status === 'succeeded'`
2. **Security check** - Verify PaymentIntent metadata matches cart_id and user_id
3. **Verify seats still held** - Double-check no race conditions
4. **Create Order** - Insert into `Orders` table with status `PAID`
5. **Create OrderItems** - One row per seat with pricing
6. **Generate Tickets** - Create unique 16-character barcode for each seat
7. **Update seat status** - Change from `HELD` to `SOLD`
8. **Convert cart** - Mark cart as `CONVERTED` and clear `CartSeats`

**Response:**
```json
{
  "message": "Purchase completed successfully",
  "order_id": 789,
  "event_name": "Taylor Swift - Eras Tour",
  "event_id": 1001,
  "total_cents": 7500,
  "total_dollars": 75.00,
  "payment_intent_id": "pi_xxx",
  "tickets": [
    {
      "ticket_id": 1234,
      "seat_id": 101,
      "row_label": "A",
      "seat_number": "1",
      "section": "Orchestra",
      "barcode": "A1B2C3D4E5F6G7H8",
      "price_cents": 7500
    }
  ],
  "ticket_count": 1
}
```

---

### Step 8: View Tickets

User can view their purchased tickets at any time.

**API Calls:**
- `GET /orders` - List all orders with tickets
- `GET /tickets/{ticket_id}` - Get specific ticket details

**Ticket includes:**
- Unique barcode (for scanning at venue)
- Seat information (row, number, section)
- Event details (name, date, venue)
- Ticket status (ISSUED, SCANNED, VOIDED)

---

## Data Model

### Key Tables

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Events    │────<│    Seats    │     │    Users    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      v                   v                   v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PriceTiers  │     │EventSeatStat│────>│    Carts    │
│ SectionPric │     │             │     │  CartSeats  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              v
                                        ┌─────────────┐
                                        │   Orders    │
                                        │ OrderItems  │
                                        │   Tickets   │
                                        └─────────────┘
```

### EventSeatStatus Table

This is the critical table that tracks seat availability per event:

| Column | Description |
|--------|-------------|
| event_id | Which event this status is for |
| seat_id | Which seat |
| status | AVAILABLE, HELD, or SOLD |
| held_by_cart_id | Which cart is holding this seat (if HELD) |
| hold_expires_at | When the hold expires (ISO timestamp) |
| updated_at | Last status change timestamp |

---

## Edge Cases & Error Handling

### 1. Seat Already Taken

If user tries to reserve a seat that's already held or sold:

```json
{
  "error": "Some seats are not available",
  "unavailable_seat_ids": [101, 102]
}
```
**HTTP Status:** 409 Conflict

---

### 2. Cart Expired

If user tries to checkout after the 10-minute hold:

```json
{
  "error": "Cart has expired. Please reserve seats again."
}
```
**HTTP Status:** 410 Gone

The cart is automatically marked as `EXPIRED`.

---

### 3. Seat Lost During Checkout

If the hold expires between payment and completion (edge case):

```json
{
  "error": "Seat A1 is no longer reserved"
}
```
**HTTP Status:** 409 Conflict

The user would need to be refunded via Stripe dashboard.

---

### 4. Payment Failed

If Stripe payment doesn't succeed:

```json
{
  "error": "Payment not successful",
  "payment_status": "requires_payment_method"
}
```
**HTTP Status:** 400 Bad Request

Seats remain held until expiration; user can retry.

---

### 5. Event Not On Sale

If user tries to reserve seats for an event that's not available:

```json
{
  "error": "Event is not available for ticket sales"
}
```
**HTTP Status:** 400 Bad Request

Only events with status `ON_SALE` or `SCHEDULED` allow reservations.

---

## Admin Operations

### Cleanup Expired Holds

Expired holds are not automatically released (no background job). Admins must periodically run:

**API Call:** `POST /admin/expired-holds`

This finds all seats where `status = 'HELD'` and `hold_expires_at < now()`, then:
- Sets status back to `AVAILABLE`
- Clears `held_by_cart_id` and `hold_expires_at`
- Marks associated carts as `EXPIRED`

---

### Scan Ticket at Venue

When attendee arrives, staff scans their barcode:

**API Call:** `POST /admin/tickets/{ticket_id}/scan`

Changes ticket status from `ISSUED` to `SCANNED`. Prevents re-entry.

---

### Void Ticket (Refund)

If a ticket needs to be cancelled/refunded:

**API Call:** `POST /admin/tickets/{ticket_id}/void`

- Sets ticket status to `VOIDED`
- Sets seat status back to `AVAILABLE`
- (Stripe refund must be processed separately)

---

## Summary

| Step | Action | Endpoint | Result |
|------|--------|----------|--------|
| 1 | Browse events | `GET /events` | See available events |
| 2 | View seat map | `GET /events/{id}/seats` | See seat availability |
| 3 | Add to cart | `POST /events/{id}/reserve` | Seat HELD for 10 min |
| 4 | View cart | `GET /cart` | See reserved seats & total |
| 5 | Start payment | `POST /create-payment-intent` | Get Stripe client secret |
| 6 | Pay | Stripe.js | Card charged |
| 7 | Complete order | `POST /complete-purchase` | Tickets issued, seat SOLD |
| 8 | View tickets | `GET /orders` | See barcodes |

The 10-minute hold window balances user experience (time to enter payment details) with inventory protection (don't lock seats indefinitely).
