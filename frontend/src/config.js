// API Configuration
// In development: http://localhost:5000
// In production: Set VITE_API_URL environment variable to your backend URL

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Stripe Publishable Key (safe to expose - this is the public key)
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SqGSvIiRRE19iQweWKvcSjCRuDhWc5ne2hOjSolKijoFGmZtuTDDSDnAhyRCi4iFSAfvM6FNUxkCtuTLC8iKySi006GBzo4og';
