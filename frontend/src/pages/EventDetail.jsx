import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Tag,
  Progress,
} from '@chakra-ui/react';
import { CalendarIcon, TimeIcon, InfoIcon, CheckCircleIcon } from '@chakra-ui/icons';
import TesseraSeatPicker from '../components/TesseraSeatPicker';

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [event, setEvent] = useState(null);
  const [seatsData, setSeatsData] = useState([]); // Raw seats from API
  const [loading, setLoading] = useState(true);
  const [seatPickerLoading, setSeatPickerLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]); // Array of selected seat IDs
  const [cart, setCart] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('access_token');

  // Fetch event details and seats
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`http://localhost:5000/events/${id}`);
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
        const response = await fetch(`http://localhost:5000/events/${id}/seats`);
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

  // Create a price lookup map: seat_id -> price in dollars
  const seatPriceMap = useMemo(() => {
    const map = {};
    seatsData.forEach(seat => {
      map[seat.seat_id] = (seat.price_cents || 0) / 100;
    });
    return map;
  }, [seatsData]);

  // Helper function to get price by seat ID
  const getPriceBySeatId = useCallback((seatId) => {
    return seatPriceMap[seatId] || 0;
  }, [seatPriceMap]);

  // Transform API seats data into rows format for TesseraSeatPicker
  const seatRows = useMemo(() => {
    if (!seatsData.length) return [];

    // Group seats by row_label
    const rowsMap = {};
    seatsData.forEach(seat => {
      const rowKey = seat.row_label || 'A';
      if (!rowsMap[rowKey]) {
        rowsMap[rowKey] = [];
      }
      rowsMap[rowKey].push(seat);
    });

    // Sort rows alphabetically
    const sortedRowKeys = Object.keys(rowsMap).sort();

    // Convert to TesseraSeatPicker format
    return sortedRowKeys.map(rowKey => {
      const rowSeats = rowsMap[rowKey];
      // Sort by col_index (use parseInt for seat_number if col_index is missing)
      rowSeats.sort((a, b) => {
        const aCol = a.col_index || parseInt(a.seat_number, 10) || 1;
        const bCol = b.col_index || parseInt(b.seat_number, 10) || 1;
        return aCol - bCol;
      });

      // Find max column to create proper spacing
      const maxCol = Math.max(...rowSeats.map(s => s.col_index || parseInt(s.seat_number, 10) || 1));
      const row = [];

      // Create array with nulls for gaps
      for (let col = 1; col <= maxCol; col++) {
        const seat = rowSeats.find(s => (s.col_index || parseInt(s.seat_number, 10)) === col);
        if (seat) {
          const priceInDollars = (seat.price_cents || 0) / 100;
          const seatNum = parseInt(seat.seat_number, 10) || col;
          row.push({
            id: seat.seat_id,
            number: seatNum,
            isReserved: seat.availability !== 'AVAILABLE',
            tooltip: `$${priceInDollars.toFixed(2)} - ${seat.section || 'General'}`,
          });
        } else {
          row.push(null); // Gap/aisle
        }
      }

      return row;
    });
  }, [seatsData]);

  // Calculate total price from selected seats
  const totalPrice = useMemo(() => {
    return selectedSeatIds.reduce((sum, seatId) => sum + getPriceBySeatId(seatId), 0);
  }, [selectedSeatIds, getPriceBySeatId]);

  // Get selected seats details for display
  const selectedSeatsDetails = useMemo(() => {
    return selectedSeatIds.map(seatId => {
      const seat = seatsData.find(s => s.seat_id === seatId);
      return seat ? {
        ...seat,
        price: (seat.price_cents || 0) / 100
      } : null;
    }).filter(Boolean);
  }, [selectedSeatIds, seatsData]);

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

  // Callback when a seat is selected
  const addSeatCallback = async ({ row, number, id: seatId }, addCb) => {
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

    setSeatPickerLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:5000/events/${id}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ seat_ids: [seatId] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reserve seat');
      }

      // Successfully reserved - add to selected seats
      setSelectedSeatIds(prev => [...prev, seatId]);
      setCart(data); // Update cart with latest reservation data

      const price = getPriceBySeatId(seatId);
      addCb(row, number, seatId, `Reserved - $${price.toFixed(2)}`);

      toast({
        title: 'Seat reserved!',
        description: `Seat held for 10 minutes.`,
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Could not reserve seat',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSeatPickerLoading(false);
    }
  };

  // Callback when a seat is deselected
  const removeSeatCallback = async ({ row, number, id: seatId }, removeCb) => {
    setSeatPickerLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:5000/events/${id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ seat_ids: [seatId] }),
      });

      // Remove from selected seats
      setSelectedSeatIds(prev => prev.filter(id => id !== seatId));
      removeCb(row, number);

      toast({
        title: 'Seat released',
        status: 'info',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error releasing seat:', error);
      toast({
        title: 'Could not release seat',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSeatPickerLoading(false);
    }
  };

  // Handle checkout button click
  const handleCheckoutClick = () => {
    if (selectedSeatIds.length === 0) {
      toast({
        title: 'No seats selected',
        description: 'Please select at least one seat.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    onOpen();
  };

  // Process checkout
  const handleCheckout = async () => {
    if (!cart?.cart_id) {
      toast({
        title: 'No active cart',
        description: 'Please select seats first.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setCheckingOut(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:5000/cart/${cart.cart_id}/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      onClose();
      toast({
        title: 'Purchase complete! 🎉',
        description: `Order #${data.order_id} confirmed. ${data.tickets_created} ticket(s) created.`,
        status: 'success',
        duration: 5000,
      });

      // Reset state and refresh seats
      setSelectedSeatIds([]);
      setCart(null);

      const seatsResponse = await fetch(`http://localhost:5000/events/${id}/seats`);
      if (seatsResponse.ok) {
        const seatsData = await seatsResponse.json();
        setSeatsData(seatsData.seats || []);
      }
    } catch (err) {
      toast({
        title: 'Checkout failed',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setCheckingOut(false);
    }
  };

  // Cancel and release all selected seats
  const handleCancelReservation = async () => {
    if (selectedSeatIds.length === 0) {
      onClose();
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:5000/events/${id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ seat_ids: selectedSeatIds }),
      });

      toast({
        title: 'Reservation cancelled',
        description: 'All held seats have been released.',
        status: 'info',
        duration: 3000,
      });

      // Reset and refresh
      setSelectedSeatIds([]);
      setCart(null);
      onClose();

      const seatsResponse = await fetch(`http://localhost:5000/events/${id}/seats`);
      if (seatsResponse.ok) {
        const seatsData = await seatsResponse.json();
        setSeatsData(seatsData.seats || []);
      }
    } catch (err) {
      console.error('Error releasing seats:', err);
    }
  };

  // Get price range from seats - must be before early returns (Rules of Hooks)
  const priceRange = useMemo(() => {
    if (!seatsData.length) return null;
    const prices = seatsData.map(s => (s.price_cents || 0) / 100).filter(p => p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }, [seatsData]);

  // Get inventory stats - must be before early returns (Rules of Hooks)
  const inventoryStats = useMemo(() => {
    const total = seatsData.length;
    const available = seatsData.filter(s => s.availability === 'AVAILABLE').length;
    const sold = seatsData.filter(s => s.availability === 'SOLD').length;
    const held = seatsData.filter(s => s.availability === 'HELD').length;
    return { total, available, sold, held, percentSold: total > 0 ? ((sold / total) * 100) : 0 };
  }, [seatsData]);

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
                    🔥 Selling Fast
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
            {event.status === 'ON_SALE' && seatRows.length > 0 && (
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
                      <Text fontSize="sm" color="gray.600">
                        {inventoryStats.available} of {inventoryStats.total} seats available
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

                  {/* Seat Picker */}
                  <Box 
                    display="flex" 
                    justifyContent="center" 
                    py={4}
                    overflowX="auto"
                    bg="gray.50"
                    borderRadius="lg"
                    p={4}
                  >
                    <TesseraSeatPicker
                      addSeatCallback={addSeatCallback}
                      removeSeatCallback={removeSeatCallback}
                      rows={seatRows}
                      maxReservableSeats={10}
                      alpha
                      visible
                      loading={seatPickerLoading}
                      showStage={false}
                    />
                  </Box>

                  {/* Legend */}
                  <HStack spacing={8} justify="center" mt={6} flexWrap="wrap">
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="gray.300" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Available</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="green.400" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Your Selection</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Box w={5} h={5} bg="gray.600" borderRadius="md" />
                      <Text fontSize="sm" color="gray.600">Sold/Reserved</Text>
                    </HStack>
                  </HStack>
                </Box>
              </Box>
            )}

            {/* No seats available message */}
            {event.status === 'ON_SALE' && seatRows.length === 0 && !loading && (
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

          {/* Right Column - Cart & Info */}
          <GridItem>
            {/* Sticky Cart */}
            <Box position="sticky" top={4}>
              {/* Cart Summary */}
              {event.status === 'ON_SALE' && (
                <Box bg="white" borderRadius="xl" boxShadow="lg" overflow="hidden" mb={6}>
                  <Box bg="blue.600" color="white" px={6} py={4}>
                    <HStack justify="space-between">
                      <Heading size="md">Your Cart</Heading>
                      <Tag colorScheme="whiteAlpha" size="lg" fontWeight="bold">
                        {selectedSeatIds.length}
                      </Tag>
                    </HStack>
                  </Box>

                  <Box p={6}>
                    {selectedSeatIds.length === 0 ? (
                      <VStack py={8} spacing={3}>
                        <Text fontSize="4xl">🎫</Text>
                        <Text color="gray.500" textAlign="center">
                          Select seats from the map to add them to your cart
                        </Text>
                      </VStack>
                    ) : (
                      <VStack spacing={4} align="stretch">
                        {/* Selected Seats List */}
                        <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto">
                          {selectedSeatsDetails.map((seat) => (
                            <HStack key={seat.seat_id} justify="space-between" p={2} bg="gray.50" borderRadius="md">
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium" fontSize="sm">
                                  Row {seat.row_label}, Seat {seat.seat_number}
                                </Text>
                                <Text fontSize="xs" color="gray.500">
                                  {seat.section || 'General Admission'}
                                </Text>
                              </VStack>
                              <Text fontWeight="bold" color="blue.600">
                                ${seat.price.toFixed(2)}
                              </Text>
                            </HStack>
                          ))}
                        </VStack>

                        <Divider />

                        {/* Price Breakdown */}
                        <VStack align="stretch" spacing={2}>
                          <HStack justify="space-between">
                            <Text color="gray.600">Subtotal ({selectedSeatIds.length} tickets)</Text>
                            <Text fontWeight="medium">${totalPrice.toFixed(2)}</Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text color="gray.600">Service Fee</Text>
                            <Text fontWeight="medium">$0.00</Text>
                          </HStack>
                        </VStack>

                        <Divider />

                        <HStack justify="space-between">
                          <Text fontWeight="bold" fontSize="lg">Total</Text>
                          <Text fontWeight="black" fontSize="2xl" color="blue.600">
                            ${totalPrice.toFixed(2)}
                          </Text>
                        </HStack>

                        <Button
                          colorScheme="blue"
                          size="lg"
                          w="full"
                          h={14}
                          fontSize="lg"
                          fontWeight="bold"
                          onClick={handleCheckoutClick}
                          _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                          transition="all 0.2s"
                        >
                          Checkout Now
                        </Button>

                        <HStack justify="center" spacing={1}>
                          <Icon as={InfoIcon} color="gray.400" boxSize={3} />
                          <Text fontSize="xs" color="gray.500">
                            Seats held for 10 minutes
                          </Text>
                        </HStack>
                      </VStack>
                    )}
                  </Box>
                </Box>
              )}

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
                    <Text fontSize="xl">📅</Text>
                    <Text color="gray.600">{formatDateTime(event.start_datetime)}</Text>
                  </HStack>
                  {event.end_datetime && (
                    <HStack>
                      <Text fontSize="xl">🏁</Text>
                      <Text color="gray.600">Ends: {formatDateTime(event.end_datetime)}</Text>
                    </HStack>
                  )}
                </VStack>
              </Box>
            </Box>
          </GridItem>
        </Grid>
      </Container>

      {/* Checkout Modal */}
      <Modal isOpen={isOpen} onClose={handleCancelReservation} size="lg" isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="2xl" overflow="hidden">
          <Box bg="blue.600" color="white" px={6} py={5}>
            <ModalHeader p={0} fontSize="xl">Complete Your Purchase</ModalHeader>
            <Text fontSize="sm" opacity={0.9} mt={1}>{event?.event_name}</Text>
          </Box>
          <ModalCloseButton color="white" top={4} />
          <ModalBody py={6}>
            <VStack spacing={5} align="stretch">
              <Alert status="warning" borderRadius="lg" bg="orange.50">
                <AlertIcon color="orange.500" />
                <Box>
                  <Text fontWeight="medium" color="orange.800">Seats held for 10 minutes</Text>
                  <Text fontSize="sm" color="orange.600">Complete checkout to secure your tickets</Text>
                </Box>
              </Alert>

              <Box>
                <Text fontWeight="bold" mb={3} color="gray.700">Your Tickets ({selectedSeatsDetails.length})</Text>
                <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto">
                  {selectedSeatsDetails.map((seat) => (
                    <HStack 
                      key={seat.seat_id} 
                      justify="space-between" 
                      p={3} 
                      bg="gray.50" 
                      borderRadius="lg"
                      border="1px solid"
                      borderColor="gray.100"
                    >
                      <HStack spacing={3}>
                        <Box bg="blue.100" p={2} borderRadius="md">
                          <Text fontSize="lg">🎫</Text>
                        </Box>
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="semibold">
                            Row {seat.row_label}, Seat {seat.seat_number}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {seat.section || 'General Admission'} • {seat.tier_name || 'Standard'}
                          </Text>
                        </VStack>
                      </HStack>
                      <Text fontWeight="bold" color="blue.600" fontSize="lg">
                        ${seat.price.toFixed(2)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </Box>

              <Divider />

              {/* Price Summary */}
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text color="gray.600">Tickets ({selectedSeatIds.length}x)</Text>
                  <Text fontWeight="medium">${totalPrice.toFixed(2)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.600">Service Fee</Text>
                  <Text fontWeight="medium" color="green.500">FREE</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.600">Order Processing</Text>
                  <Text fontWeight="medium" color="green.500">FREE</Text>
                </HStack>
              </VStack>

              <Box bg="gray.50" p={4} borderRadius="xl">
                <HStack justify="space-between">
                  <Text fontWeight="bold" fontSize="lg">Total</Text>
                  <Text fontWeight="black" fontSize="2xl" color="blue.600">
                    ${totalPrice.toFixed(2)}
                  </Text>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter bg="gray.50" px={6} py={4}>
            <Button variant="ghost" mr={3} onClick={handleCancelReservation}>
              Cancel & Release Seats
            </Button>
            <Button 
              colorScheme="green" 
              size="lg"
              onClick={handleCheckout}
              isLoading={checkingOut}
              loadingText="Processing..."
              px={8}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
              transition="all 0.2s"
              leftIcon={<CheckCircleIcon />}
            >
              Complete Purchase
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default EventDetail;