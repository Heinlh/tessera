import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Image,
  Badge,
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
  Grid,
  GridItem,
  Progress,
} from '@chakra-ui/react';
import { CalendarIcon, TimeIcon, InfoIcon, WarningIcon } from '@chakra-ui/icons';

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Modal for seat selection prompt
  const { isOpen: isSeatModalOpen, onOpen: onSeatModalOpen, onClose: onSeatModalClose } = useDisclosure();
  // Modal for unavailable seat
  const { isOpen: isUnavailableOpen, onOpen: onUnavailableOpen, onClose: onUnavailableClose } = useDisclosure();

  const [event, setEvent] = useState(null);
  const [seatsData, setSeatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSelectedSeats, setUserSelectedSeats] = useState([]); // Seats user has added to cart
  const [pendingSeat, setPendingSeat] = useState(null); // Seat being considered for selection
  const [reservingSeats, setReservingSeats] = useState(false);

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('access_token');

  // Fetch event details and seats
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${API_URL}/events/${id}`);
        if (!response.ok) {
          throw new Error('Event not found');
        }
        const data = await response.json();
        setEvent(data);
      } catch (err) {
        setError(err.message);
      }
    };

    const fetchSeats = async () => {
      try {
        const response = await fetch(`${API_URL}/events/${id}/seats`);
        if (response.ok) {
          const data = await response.json();
          setSeatsData(data.seats || []);
        }
      } catch (err) {
        console.error('Error fetching seats:', err);
      }
    };

    Promise.all([fetchEvent(), fetchSeats()]).finally(() => setLoading(false));
  }, [id]);

  // Get inventory stats
  const inventoryStats = useMemo(() => {
    const total = seatsData.length;
    const available = seatsData.filter(s => s.availability === 'AVAILABLE' || !s.availability).length;
    const sold = seatsData.filter(s => s.availability === 'SOLD').length;
    const held = seatsData.filter(s => s.availability === 'HELD').length;
    return { total, available, sold, held, percentSold: total > 0 ? ((sold / total) * 100) : 0 };
  }, [seatsData]);

  // Get price range from seats
  const priceRange = useMemo(() => {
    if (!seatsData.length) return null;
    const prices = seatsData.map(s => (s.price_cents || 0) / 100).filter(p => p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }, [seatsData]);

  // Group seats by row for seat map display
  const seatsByRow = useMemo(() => {
    const rowsMap = {};
    seatsData.forEach(seat => {
      const rowKey = seat.row_label || 'A';
      if (!rowsMap[rowKey]) {
        rowsMap[rowKey] = [];
      }
      rowsMap[rowKey].push(seat);
    });

    // Sort seats within each row by column
    Object.keys(rowsMap).forEach(rowKey => {
      rowsMap[rowKey].sort((a, b) => {
        const aCol = a.col_index || parseInt(a.seat_number, 10) || 1;
        const bCol = b.col_index || parseInt(b.seat_number, 10) || 1;
        return aCol - bCol;
      });
    });

    return rowsMap;
  }, [seatsData]);

  const sortedRowKeys = useMemo(() => {
    return Object.keys(seatsByRow).sort();
  }, [seatsByRow]);

  // Format datetime for display
  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'TBD';
    const d = new Date(datetimeStr);
    return d.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format date parts for display
  const formatDateParts = (datetimeStr) => {
    if (!datetimeStr) return { day: '--', month: '---', weekday: '---', time: 'TBD' };
    const d = new Date(datetimeStr);
    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      weekday: d.toLocaleString('en-US', { weekday: 'long' }),
      time: d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
      year: d.getFullYear(),
    };
  };

  const dateParts = formatDateParts(event?.start_datetime);
  const location = event ? [event.venue_name, event.city, event.state].filter(Boolean).join(', ') : '';

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'ON_SALE': return 'green';
      case 'SCHEDULED': return 'blue';
      case 'CANCELLED': return 'red';
      case 'COMPLETED': return 'gray';
      default: return 'gray';
    }
  };

  // Get seat color based on status
  const getSeatColor = (seat) => {
    // Check if this seat is selected by user (green)
    if (userSelectedSeats.find(s => s.seat_id === seat.seat_id)) {
      return 'green.400';
    }
    // Available seats (blue)
    if (seat.availability === 'AVAILABLE' || !seat.availability) {
      return 'blue.400';
    }
    // Sold or held seats (gray)
    return 'gray.400';
  };

  // Get seat hover color
  const getSeatHoverColor = (seat) => {
    if (userSelectedSeats.find(s => s.seat_id === seat.seat_id)) {
      return 'green.500';
    }
    if (seat.availability === 'AVAILABLE' || !seat.availability) {
      return 'blue.500';
    }
    return 'gray.500';
  };

  // Handle seat click
  const handleSeatClick = (seat) => {
    if (!isLoggedIn) {
      toast({
        title: 'Please sign in',
        description: 'You need to sign in to select seats.',
        status: 'warning',
        duration: 3000,
      });
      navigate('/signin');
      return;
    }

    // Check if seat is already selected by user - if so, deselect it
    if (userSelectedSeats.find(s => s.seat_id === seat.seat_id)) {
      handleRemoveSeat(seat);
      return;
    }

    // Check if seat is unavailable (sold or held by someone else)
    if (seat.availability === 'SOLD' || seat.availability === 'HELD') {
      setPendingSeat(seat);
      onUnavailableOpen();
      return;
    }

    // Seat is available - show confirmation prompt
    setPendingSeat(seat);
    onSeatModalOpen();
  };

  // Helper function to make authenticated requests with token refresh
  const authenticatedFetch = async (url, options = {}) => {
    let token = localStorage.getItem('access_token');
    
    const makeRequest = async (authToken) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${authToken}`,
        },
      });
    };

    let response = await makeRequest(token);
    
    // If unauthorized, try to refresh the token
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${API_URL}/refresh`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${refreshToken}`,
            },
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            localStorage.setItem('access_token', refreshData.access_token);
            localStorage.setItem('refresh_token', refreshData.refresh_token);
            // Retry the original request with new token
            response = await makeRequest(refreshData.access_token);
          } else {
            // Refresh failed, clear tokens and redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw new Error('Session expired. Please sign in again.');
          }
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          throw new Error('Session expired. Please sign in again.');
        }
      } else {
        throw new Error('Please sign in to continue.');
      }
    }
    
    return response;
  };

  // Add seat to cart
  const handleAddSeatToCart = async () => {
    if (!pendingSeat) return;

    setReservingSeats(true);

    try {
      const response = await authenticatedFetch(`${API_URL}/events/${id}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seat_ids: [pendingSeat.seat_id] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reserve seat');
      }

      // Add to local selected seats
      setUserSelectedSeats(prev => [...prev, pendingSeat]);

      // Update seat data to reflect the hold
      setSeatsData(prev => prev.map(s =>
        s.seat_id === pendingSeat.seat_id
          ? { ...s, availability: 'HELD' }
          : s
      ));

      toast({
        title: 'Seat added to cart!',
        description: `Row ${pendingSeat.row_label}, Seat ${pendingSeat.seat_number} - Held for 10 minutes`,
        status: 'success',
        duration: 3000,
      });

      onSeatModalClose();
      setPendingSeat(null);
    } catch (err) {
      // Handle session expired - redirect to login
      if (err.message.includes('Session expired') || err.message.includes('sign in')) {
        toast({
          title: 'Session Expired',
          description: 'Please sign in again to continue.',
          status: 'warning',
          duration: 3000,
        });
        navigate('/signin');
        return;
      }
      toast({
        title: 'Could not reserve seat',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setReservingSeats(false);
    }
  };

  // Remove seat from cart
  const handleRemoveSeat = async (seat) => {
    try {
      await authenticatedFetch(`${API_URL}/events/${id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seat_ids: [seat.seat_id] }),
      });

      // Remove from local selected seats
      setUserSelectedSeats(prev => prev.filter(s => s.seat_id !== seat.seat_id));

      // Update seat data to reflect availability
      setSeatsData(prev => prev.map(s =>
        s.seat_id === seat.seat_id
          ? { ...s, availability: 'AVAILABLE' }
          : s
      ));

      toast({
        title: 'Seat removed from cart',
        status: 'info',
        duration: 2000,
      });
    } catch (err) {
      console.error('Error releasing seat:', err);
      if (err.message.includes('Session expired') || err.message.includes('sign in')) {
        navigate('/signin');
      }
    }
  };

  // Calculate total price of selected seats
  const totalPrice = useMemo(() => {
    return userSelectedSeats.reduce((sum, seat) => sum + ((seat.price_cents || 0) / 100), 0);
  }, [userSelectedSeats]);

  if (loading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error || !event) {
    return (
      <Container maxW="container.md" py={10}>
        <Alert status="error">
          <AlertIcon />
          {error || 'Event not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Box minH="calc(100vh - 60px)" bg="gray.50">
      {/* Hero Banner */}
      <Box
        position="relative"
        h={{ base: '300px', md: '400px' }}
        overflow="hidden"
      >
        {/* Background Image with Overlay */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bgImage={event.image_url ? `url(${event.image_url})` : 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)'}
          bgSize="cover"
          bgPosition="center"
          filter="blur(8px)"
          transform="scale(1.1)"
        />
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)"
        />

        {/* Hero Content */}
        <Container maxW="container.xl" h="full" position="relative">
          <Flex
            h="full"
            pb={8}
            gap={6}
            direction={{ base: 'column', md: 'row' }}
            align={{ base: 'center', md: 'flex-end' }}
          >
            {/* Event Image Thumbnail */}
            {event.image_url && (
              <Box
                flexShrink={0}
                w={{ base: '150px', md: '200px' }}
                h={{ base: '150px', md: '200px' }}
                borderRadius="xl"
                overflow="hidden"
                boxShadow="2xl"
                border="4px solid white"
              >
                <Image
                  src={event.image_url}
                  alt={event.event_name}
                  objectFit="cover"
                  w="full"
                  h="full"
                />
              </Box>
            )}

            {/* Event Info */}
            <VStack align={{ base: 'center', md: 'start' }} spacing={3} color="white" flex={1} textAlign={{ base: 'center', md: 'left' }}>
              <HStack spacing={2}>
                <Badge
                  colorScheme={getStatusColor(event.status)}
                  fontSize="sm"
                  px={3}
                  py={1}
                  borderRadius="full"
                  textTransform="uppercase"
                  fontWeight="bold"
                >
                  {event.status?.replace('_', ' ')}
                </Badge>
                {inventoryStats.percentSold > 80 && (
                  <Badge colorScheme="red" fontSize="sm" px={3} py={1} borderRadius="full">
                    Selling Fast
                  </Badge>
                )}
              </HStack>
              <Heading size="2xl" fontWeight="black" textShadow="2px 2px 4px rgba(0,0,0,0.5)">
                {event.event_name}
              </Heading>
              <HStack spacing={4} flexWrap="wrap" justify={{ base: 'center', md: 'flex-start' }}>
                <HStack>
                  <CalendarIcon />
                  <Text fontWeight="medium">{dateParts.weekday}, {dateParts.month} {dateParts.day}, {dateParts.year}</Text>
                </HStack>
                <HStack>
                  <TimeIcon />
                  <Text fontWeight="medium">{dateParts.time}</Text>
                </HStack>
              </HStack>
              {location && (
                <Text fontSize="lg" opacity={0.9}>
                  📍 {location}
                </Text>
              )}
            </VStack>

            {/* Price Tag */}
            {priceRange && event.status === 'ON_SALE' && (
              <Box
                bg="white"
                color="gray.800"
                px={6}
                py={4}
                borderRadius="xl"
                boxShadow="xl"
                textAlign="center"
                display={{ base: 'none', lg: 'block' }}
              >
                <Text fontSize="sm" color="gray.500" fontWeight="medium">Starting from</Text>
                <Text fontSize="3xl" fontWeight="black" color="blue.600">
                  ${priceRange.min.toFixed(0)}
                </Text>
                {priceRange.max !== priceRange.min && (
                  <Text fontSize="xs" color="gray.400">up to ${priceRange.max.toFixed(0)}</Text>
                )}
              </Box>
            )}
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        <Grid templateColumns={{ base: '1fr', lg: '1fr 350px' }} gap={8}>
          {/* Left Column - Seat Map */}
          <GridItem>
            {/* Seat Picker Section */}
            {event.status === 'ON_SALE' && seatsData.length > 0 && (
              <Box bg="white" borderRadius="xl" boxShadow="lg" overflow="hidden">
                {/* Section Header */}
                <Box bg="gray.800" color="white" px={6} py={4}>
                  <Heading size="md">Select Your Seats</Heading>
                  <Text fontSize="sm" opacity={0.8} mt={1}>
                    Click on available seats to add them to your cart
                  </Text>
                </Box>

                <Box p={6}>
                  {/* Availability Bar */}
                  <Box mb={6}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color="gray.600" fontWeight="bold">
                        {inventoryStats.available}/{inventoryStats.total} seats available
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {inventoryStats.percentSold.toFixed(0)}% sold
                      </Text>
                    </HStack>
                    <Progress
                      value={inventoryStats.percentSold}
                      colorScheme="blue"
                      size="sm"
                      borderRadius="full"
                      bg="gray.200"
                    />
                  </Box>

                  {/* Stage indicator */}
                  <Box
                    bg="linear-gradient(135deg, #1a365d 0%, #2d3748 100%)"
                    color="white"
                    py={4}
                    textAlign="center"
                    borderRadius="lg"
                    fontWeight="bold"
                    letterSpacing="widest"
                    fontSize="lg"
                    boxShadow="md"
                    mb={6}
                  >
                    ★ STAGE ★
                  </Box>

                  {/* Seat Map */}
                  <Box
                    bg="gray.50"
                    borderRadius="lg"
                    p={4}
                    overflowX="auto"
                  >
                    <VStack spacing={2} align="center">
                      {sortedRowKeys.map(rowKey => (
                        <HStack key={rowKey} spacing={2}>
                          {/* Row Label */}
                          <Text
                            w="30px"
                            fontWeight="bold"
                            color="gray.500"
                            fontSize="sm"
                            textAlign="center"
                          >
                            {rowKey}
                          </Text>

                          {/* Seats */}
                          <HStack spacing={1}>
                            {seatsByRow[rowKey].map(seat => (
                              <Box
                                key={seat.seat_id}
                                as="button"
                                w="32px"
                                h="32px"
                                bg={getSeatColor(seat)}
                                borderRadius="md"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                fontSize="xs"
                                fontWeight="bold"
                                color="white"
                                cursor="pointer"
                                transition="all 0.2s"
                                _hover={{
                                  bg: getSeatHoverColor(seat),
                                  transform: 'scale(1.1)',
                                }}
                                onClick={() => handleSeatClick(seat)}
                                title={`Row ${seat.row_label}, Seat ${seat.seat_number} - $${((seat.price_cents || 0) / 100).toFixed(2)} - ${seat.section || 'General'}`}
                              >
                                {seat.seat_number}
                              </Box>
                            ))}
                          </HStack>

                          {/* Row Label (right side) */}
                          <Text
                            w="30px"
                            fontWeight="bold"
                            color="gray.500"
                            fontSize="sm"
                            textAlign="center"
                          >
                            {rowKey}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>

                  {/* Legend */}
                  <HStack spacing={8} justify="center" mt={6} flexWrap="wrap">
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="blue.400" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Available</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="green.400" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Your Selection</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="gray.400" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Sold/Reserved</Text>
                    </HStack>
                  </HStack>

                  {/* Selection Summary */}
                  {userSelectedSeats.length > 0 && (
                    <Box mt={6} p={4} bg="green.50" borderRadius="lg" border="2px solid" borderColor="green.200">
                      <HStack justify="space-between" align="center">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" color="green.800">
                            {userSelectedSeats.length} seat(s) selected
                          </Text>
                          <Text fontSize="sm" color="green.600">
                            Total: ${totalPrice.toFixed(2)}
                          </Text>
                        </VStack>
                        <Button
                          colorScheme="green"
                          onClick={() => navigate('/checkout')}
                        >
                          Go to Checkout
                        </Button>
                      </HStack>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* No seats available message */}
            {event.status === 'ON_SALE' && seatsData.length === 0 && !loading && (
              <Alert status="info" borderRadius="xl">
                <AlertIcon />
                No seats are available for this event yet. Please check back later.
              </Alert>
            )}

            {/* Not on sale message */}
            {event.status !== 'ON_SALE' && (
              <Box bg="white" borderRadius="xl" boxShadow="lg" p={8} textAlign="center">
                <Icon
                  as={InfoIcon}
                  boxSize={12}
                  color={event.status === 'CANCELLED' ? 'red.400' : 'blue.400'}
                  mb={4}
                />
                <Heading size="md" mb={2}>
                  {event.status === 'CANCELLED' && 'Event Cancelled'}
                  {event.status === 'COMPLETED' && 'Event Has Ended'}
                  {event.status === 'SCHEDULED' && 'Coming Soon'}
                </Heading>
                <Text color="gray.600">
                  {event.status === 'CANCELLED' && 'This event has been cancelled. Refunds will be processed automatically.'}
                  {event.status === 'COMPLETED' && 'This event has already taken place.'}
                  {event.status === 'SCHEDULED' && 'Tickets are not yet on sale. Check back soon!'}
                </Text>
              </Box>
            )}

            {/* Event Description */}
            {event.event_description && (
              <Box bg="white" borderRadius="xl" boxShadow="lg" p={6} mt={6}>
                <Heading size="md" mb={4}>About This Event</Heading>
                <Text color="gray.600" lineHeight="tall">
                  {event.event_description}
                </Text>
              </Box>
            )}
          </GridItem>

          {/* Right Column - Venue Info */}
          <GridItem>
            <Box position="sticky" top={4}>
              {/* Venue Info Card */}
              <Box bg="white" borderRadius="xl" boxShadow="lg" p={6}>
                <Heading size="sm" mb={4} color="gray.700">Venue Information</Heading>
                <VStack align="start" spacing={3}>
                  {event.venue_name && (
                    <HStack>
                      <Text fontSize="xl">🏟️</Text>
                      <Text fontWeight="medium">{event.venue_name}</Text>
                    </HStack>
                  )}
                  {location && (
                    <HStack>
                      <Text fontSize="xl">📍</Text>
                      <Text color="gray.600">{location}</Text>
                    </HStack>
                  )}
                  <HStack>
                    <Text fontSize="xl"></Text>
                    <Text color="gray.600">{formatDateTime(event.start_datetime)}</Text>
                  </HStack>
                  {event.end_datetime && (
                    <HStack>
                      <Text fontSize="xl">🏁</Text>
                      <Text color="gray.600">Ends: {formatDateTime(event.end_datetime)}</Text>
                    </HStack>
                  )}
                </VStack>

                <Divider my={4} />

                {/* Pricing Info */}
                {priceRange && (
                  <Box>
                    <Text fontWeight="medium" mb={2} color="gray.700">Ticket Prices</Text>
                    <HStack justify="space-between">
                      <Text color="gray.600">Starting from</Text>
                      <Text fontWeight="bold" color="blue.600">${priceRange.min.toFixed(2)}</Text>
                    </HStack>
                    {priceRange.max !== priceRange.min && (
                      <HStack justify="space-between">
                        <Text color="gray.600">Up to</Text>
                        <Text fontWeight="bold" color="blue.600">${priceRange.max.toFixed(2)}</Text>
                      </HStack>
                    )}
                  </Box>
                )}
              </Box>

              {/* Instructions Card */}
              <Box bg="blue.50" borderRadius="xl" p={6} mt={4} border="1px solid" borderColor="blue.100">
                <Heading size="sm" mb={3} color="blue.800">How to Purchase</Heading>
                <VStack align="start" spacing={2} fontSize="sm" color="blue.700">
                  <Text>1. Click on a <b>blue seat</b> to select it</Text>
                  <Text>2. Confirm to add it to your cart</Text>
                  <Text>3. Selected seats show in <b>green</b></Text>
                  <Text>4. Go to <b>My Cart</b> to checkout</Text>
                </VStack>
              </Box>
            </Box>
          </GridItem>
        </Grid>
      </Container>

      {/* Add to Cart Confirmation Modal */}
      <Modal isOpen={isSeatModalOpen} onClose={onSeatModalClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" mx={4}>
          <ModalHeader color="gray.800">Add Seat to Cart?</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {pendingSeat && (
              <VStack spacing={4} align="stretch">
                <Box bg="blue.50" p={4} borderRadius="lg">
                  <VStack spacing={2} align="start">
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Seat</Text>
                      <Text fontWeight="bold">Row {pendingSeat.row_label}, Seat {pendingSeat.seat_number}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Section</Text>
                      <Text fontWeight="medium">{pendingSeat.section || 'General'}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Price</Text>
                      <Text fontWeight="black" fontSize="xl" color="blue.600">
                        ${((pendingSeat.price_cents || 0) / 100).toFixed(2)}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
                <Text fontSize="sm" color="gray.500">
                  This seat will be held for 10 minutes while you complete checkout.
                </Text>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={onSeatModalClose}>
              No
            </Button>
            <Button
              colorScheme="green"
              onClick={handleAddSeatToCart}
              isLoading={reservingSeats}
              loadingText="Adding..."
            >
              Yes, Add to Cart
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Unavailable Seat Modal */}
      <Modal isOpen={isUnavailableOpen} onClose={onUnavailableClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" mx={4}>
          <ModalHeader color="gray.800">
            <HStack spacing={2}>
              <Icon as={WarningIcon} color="orange.500" />
              <Text>Seat Unavailable</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {pendingSeat && (
              <VStack spacing={4} align="stretch">
                <Alert status="warning" borderRadius="lg">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="medium">
                      Row {pendingSeat.row_label}, Seat {pendingSeat.seat_number}
                    </Text>
                    <Text fontSize="sm">
                      This seat is {pendingSeat.availability === 'SOLD' ? 'already sold' : 'currently reserved by another customer'}.
                    </Text>
                  </Box>
                </Alert>
                <Text color="gray.600">
                  Please select a different seat from the available options (shown in blue).
                </Text>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={() => { onUnavailableClose(); setPendingSeat(null); }}>
              Got it
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default EventDetail;
