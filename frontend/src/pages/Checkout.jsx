import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Image,
  Button,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Icon,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
} from '@chakra-ui/react';
import { DeleteIcon, CheckCircleIcon, LockIcon, ArrowBackIcon } from '@chakra-ui/icons';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_51SqGSvIiRRE19iQwATpWGIbOH4KbqFaPQOH9yrECm2gwS4n39TKMfABNJ1SaJK87b6aAGkIcfHDLnPwwfD69EKTY007M7AsSM5');

// Stripe CardElement styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      '::placeholder': {
        color: '#aab7c4',
      },
      padding: '12px',
    },
    invalid: {
      color: '#e53e3e',
      iconColor: '#e53e3e',
    },
  },
};

// Payment Form Component
function PaymentForm({ cartData, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const totalCents = cartData.seats.reduce((sum, seat) => sum + (seat.price_cents || 0), 0);
  const totalDollars = totalCents / 100;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');

      // Step 1: Create payment intent on our backend
      const intentResponse = await fetch('http://localhost:5000/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ cart_id: cartData.cart_id }),
      });

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        throw new Error(intentData.error || 'Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = intentData;

      // Step 2: Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: 'Tessera Customer',
          },
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment was not successful');
      }

      // Step 3: Complete purchase on our backend
      const purchaseResponse = await fetch('http://localhost:5000/complete-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntentId,
          cart_id: cartData.cart_id,
        }),
      });

      const purchaseData = await purchaseResponse.json();

      if (!purchaseResponse.ok) {
        throw new Error(purchaseData.error || 'Failed to complete purchase');
      }

      // Success!
      onSuccess(purchaseData);

    } catch (err) {
      setError(err.message);
      toast({
        title: 'Payment failed',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack spacing={6} align="stretch">
        {/* Card Input */}
        <Box>
          <Text fontWeight="medium" mb={3} color="gray.700">
            Card Details
          </Text>
          <Box
            border="2px solid"
            borderColor="gray.200"
            borderRadius="lg"
            p={4}
            bg="white"
            _focusWithin={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
            transition="all 0.2s"
          >
            <CardElement options={cardElementOptions} />
          </Box>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Security Notice */}
        <HStack spacing={2} justify="center" color="gray.500">
          <Icon as={LockIcon} boxSize={4} />
          <Text fontSize="sm">Your payment is secured with Stripe</Text>
        </HStack>

        {/* Total */}
        <Box bg="gray.50" p={4} borderRadius="xl">
          <HStack justify="space-between">
            <Text fontWeight="bold" fontSize="lg">Total to Pay</Text>
            <Text fontWeight="black" fontSize="2xl" color="blue.600">
              ${totalDollars.toFixed(2)}
            </Text>
          </HStack>
        </Box>

        {/* Buttons */}
        <HStack spacing={4}>
          <Button
            variant="outline"
            flex={1}
            onClick={onCancel}
            isDisabled={processing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            colorScheme="green"
            flex={2}
            size="lg"
            isLoading={processing}
            loadingText="Processing Payment..."
            isDisabled={!stripe || processing}
            leftIcon={<CheckCircleIcon />}
          >
            Pay ${totalDollars.toFixed(2)}
          </Button>
        </HStack>

        {/* Test Card Info */}
        <Alert status="info" borderRadius="lg" bg="blue.50">
          <AlertIcon color="blue.500" />
          <Box fontSize="sm">
            <Text fontWeight="medium" color="blue.800">Test Mode</Text>
            <Text color="blue.600">Use card: 4242 4242 4242 4242, any future date, any CVC</Text>
          </Box>
        </Alert>
      </VStack>
    </Box>
  );
}

// Main Checkout Page Component
function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isSuccessOpen, onOpen: onSuccessOpen, onClose: onSuccessClose } = useDisclosure();

  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCart, setSelectedCart] = useState(null);
  const [orderResult, setOrderResult] = useState(null);
  const [releasingSeats, setReleasingSeats] = useState({});

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('access_token');

  // Fetch user's carts
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/signin');
      return;
    }

    fetchCarts();
  }, [isLoggedIn, navigate]);

  const fetchCarts = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:5000/cart', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }

      const data = await response.json();
      setCarts(data.carts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Release a single seat from cart
  const handleReleaseSeat = async (cart, seatId) => {
    setReleasingSeats(prev => ({ ...prev, [seatId]: true }));

    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:5000/events/${cart.event_id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ seat_ids: [seatId] }),
      });

      toast({
        title: 'Seat removed',
        status: 'info',
        duration: 2000,
      });

      // Refresh carts
      fetchCarts();
    } catch (err) {
      toast({
        title: 'Error removing seat',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setReleasingSeats(prev => ({ ...prev, [seatId]: false }));
    }
  };

  // Open payment modal for a cart
  const handleCheckout = (cart) => {
    setSelectedCart(cart);
    onPaymentOpen();
  };

  // Handle successful payment
  const handlePaymentSuccess = (result) => {
    setOrderResult(result);
    onPaymentClose();
    onSuccessOpen();
    fetchCarts(); // Refresh carts
  };

  // Close success modal and redirect
  const handleSuccessClose = () => {
    onSuccessClose();
    navigate('/events');
  };

  // Calculate cart total
  const getCartTotal = (cart) => {
    return cart.seats.reduce((sum, seat) => sum + (seat.price_cents || 0), 0) / 100;
  };

  // Format datetime
  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'TBD';
    const d = new Date(datetimeStr);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Calculate time remaining until expiration
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  if (!isLoggedIn) {
    return null; // Will redirect in useEffect
  }

  return (
    <Box minH="calc(100vh - 60px)" bg="gray.50" py={8}>
      <Container maxW="container.lg">
        {/* Header */}
        <HStack mb={8} spacing={4}>
          <IconButton
            icon={<ArrowBackIcon />}
            variant="ghost"
            onClick={() => navigate('/events')}
            aria-label="Back to events"
          />
          <Heading size="xl" color="gray.800">My Cart</Heading>
        </HStack>

        {/* Error State */}
        {error && (
          <Alert status="error" borderRadius="lg" mb={6}>
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Empty Cart State */}
        {carts.length === 0 && !loading && (
          <Box
            bg="white"
            borderRadius="xl"
            boxShadow="lg"
            p={12}
            textAlign="center"
          >
            <Text fontSize="6xl" mb={4}>🛒</Text>
            <Heading size="lg" mb={2} color="gray.700">Your cart is empty</Heading>
            <Text color="gray.500" mb={6}>
              Browse events and select seats to add them to your cart
            </Text>
            <Button colorScheme="blue" onClick={() => navigate('/events')}>
              Browse Events
            </Button>
          </Box>
        )}

        {/* Cart Items */}
        <VStack spacing={6} align="stretch">
          {carts.map((cart) => (
            <Box
              key={cart.cart_id}
              bg="white"
              borderRadius="xl"
              boxShadow="lg"
              overflow="hidden"
            >
              {/* Cart Header with Event Image */}
              <Flex
                bg="gray.800"
                color="white"
                p={0}
                position="relative"
                minH="150px"
              >
                {/* Event Image Background */}
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  opacity={0.3}
                >
                  <Image
                    src={cart.image_url || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800'}
                    alt={cart.event_name}
                    objectFit="cover"
                    w="full"
                    h="full"
                  />
                </Box>
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  bg="linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)"
                />
                
                {/* Event Info */}
                <HStack position="relative" p={6} spacing={6} w="full">
                  {/* Event Thumbnail */}
                  <Box
                    w="100px"
                    h="100px"
                    borderRadius="lg"
                    overflow="hidden"
                    flexShrink={0}
                    boxShadow="xl"
                    display={{ base: 'none', md: 'block' }}
                  >
                    <Image
                      src={cart.image_url || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=200'}
                      alt={cart.event_name}
                      objectFit="cover"
                      w="full"
                      h="full"
                    />
                  </Box>

                  <VStack align="start" spacing={1} flex={1}>
                    <Heading size="md">{cart.event_name}</Heading>
                    <Text opacity={0.9} fontSize="sm">
                      📍 {cart.venue_name || 'Venue TBD'}
                    </Text>
                    <Text opacity={0.9} fontSize="sm">
                      📅 {formatDateTime(cart.start_datetime)}
                    </Text>
                  </VStack>

                  {/* Expiration Warning */}
                  <Badge
                    colorScheme="orange"
                    fontSize="sm"
                    px={3}
                    py={1}
                    borderRadius="full"
                  >
                    ⏱️ Expires: {getTimeRemaining(cart.expires_at)}
                  </Badge>
                </HStack>
              </Flex>

              {/* Seats Table */}
              <Box p={6}>
                <Text fontWeight="bold" mb={4} color="gray.700">
                  Selected Seats ({cart.seats.length})
                </Text>

                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Seat</Th>
                      <Th>Section</Th>
                      <Th>Tier</Th>
                      <Th isNumeric>Price</Th>
                      <Th width="50px"></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {cart.seats.map((seat) => (
                      <Tr key={seat.seat_id}>
                        <Td fontWeight="medium">
                          Row {seat.row_label}, Seat {seat.seat_number}
                        </Td>
                        <Td color="gray.600">{seat.section || 'General'}</Td>
                        <Td>
                          <Badge colorScheme="blue" variant="subtle">
                            {seat.tier_name || 'Standard'}
                          </Badge>
                        </Td>
                        <Td isNumeric fontWeight="bold" color="blue.600">
                          ${((seat.price_cents || 0) / 100).toFixed(2)}
                        </Td>
                        <Td>
                          <IconButton
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            aria-label="Remove seat"
                            isLoading={releasingSeats[seat.seat_id]}
                            onClick={() => handleReleaseSeat(cart, seat.seat_id)}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>

                <Divider my={4} />

                {/* Cart Total and Checkout */}
                <Flex justify="space-between" align="center">
                  <VStack align="start" spacing={0}>
                    <Text color="gray.600" fontSize="sm">Order Total</Text>
                    <Text fontWeight="black" fontSize="2xl" color="blue.600">
                      ${getCartTotal(cart).toFixed(2)}
                    </Text>
                  </VStack>

                  <Button
                    colorScheme="green"
                    size="lg"
                    onClick={() => handleCheckout(cart)}
                    leftIcon={<LockIcon />}
                    _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                    transition="all 0.2s"
                  >
                    Secure Checkout
                  </Button>
                </Flex>
              </Box>
            </Box>
          ))}
        </VStack>
      </Container>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose} size="lg" isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="2xl" overflow="hidden" mx={4}>
          <Box bg="blue.600" color="white" px={6} py={5}>
            <ModalHeader p={0} fontSize="xl">
              <HStack spacing={2}>
                <LockIcon />
                <Text>Secure Payment</Text>
              </HStack>
            </ModalHeader>
            {selectedCart && (
              <Text fontSize="sm" opacity={0.9} mt={1}>
                {selectedCart.event_name} • {selectedCart.seats.length} ticket(s)
              </Text>
            )}
          </Box>
          <ModalCloseButton color="white" top={4} />
          <ModalBody py={6}>
            {selectedCart && (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  cartData={selectedCart}
                  onSuccess={handlePaymentSuccess}
                  onCancel={onPaymentClose}
                />
              </Elements>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={isSuccessOpen} onClose={handleSuccessClose} size="md" isCentered closeOnOverlayClick={false}>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="2xl" overflow="hidden" mx={4}>
          <ModalBody py={10} textAlign="center">
            <VStack spacing={6}>
              <Box
                bg="green.100"
                borderRadius="full"
                p={6}
              >
                <Icon as={CheckCircleIcon} boxSize={16} color="green.500" />
              </Box>

              <VStack spacing={2}>
                <Heading size="lg" color="gray.800">
                  Thank You! 🎉
                </Heading>
                <Text color="gray.600" fontSize="lg">
                  Your purchase was successful!
                </Text>
              </VStack>

              {orderResult && (
                <Box bg="gray.50" p={4} borderRadius="xl" w="full">
                  <VStack spacing={2} align="stretch">
                    <HStack justify="space-between">
                      <Text color="gray.600">Order ID</Text>
                      <Text fontWeight="bold">#{orderResult.order_id}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.600">Event</Text>
                      <Text fontWeight="medium">{orderResult.event_name}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.600">Tickets</Text>
                      <Text fontWeight="medium">{orderResult.ticket_count} ticket(s)</Text>
                    </HStack>
                    <Divider />
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Total Paid</Text>
                      <Text fontWeight="black" color="green.600">
                        ${orderResult.total_dollars?.toFixed(2)}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              )}

              <Text fontSize="sm" color="gray.500">
                Your tickets have been emailed to you. You can also view them in your profile.
              </Text>

              <Button
                colorScheme="blue"
                size="lg"
                w="full"
                onClick={handleSuccessClose}
              >
                Continue Browsing Events
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default Checkout;
