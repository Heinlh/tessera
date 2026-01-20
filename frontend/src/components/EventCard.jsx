import React, { useEffect, useState } from 'react';
import { Box, Image, Text, VStack, Heading, LinkBox, Button, Badge, HStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

function EventCard({ id, eventName, startDatetime, venueName, city, imageUrl, status }) {
  const [timeLeft, setTimeLeft] = useState('');

  // Parse ISO datetime string into a Date object
  const parseEventDateTime = (datetimeStr) => {
    if (!datetimeStr) return null;
    const d = new Date(datetimeStr);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  // Format datetime for display
  const formatDateTime = (datetimeStr) => {
    const d = parseEventDateTime(datetimeStr);
    if (!d) return 'Date TBD';
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    const updateTimer = () => {
      const eventDateObj = parseEventDateTime(startDatetime);
      if (!eventDateObj) {
        setTimeLeft('Date not available');
        return;
      }

      const eventDate = eventDateObj.getTime();
      const now = new Date().getTime();
      const distance = eventDate - now;

      if (distance < 0) {
        setTimeLeft('Event has started');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    // Run once immediately then every second
    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [startDatetime]);

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

  const location = [venueName, city].filter(Boolean).join(', ');

  return (
    <LinkBox 
      as="article" 
      w="full" 
      borderRadius="xl" 
      overflow="hidden" 
      boxShadow="lg" 
      bg="white"
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-8px)',
        boxShadow: '2xl',
      }}
    >
      <Box position="relative">
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={`Image for ${eventName}`} 
            objectFit="cover" 
            width="full" 
            height="220px"
          />
        ) : (
          <Box 
            height="220px" 
            bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="4xl"></Text>
          </Box>
        )}
        
        {/* Status Badge Overlay */}
        <Box position="absolute" top={3} left={3}>
          {status && (
            <Badge 
              colorScheme={getStatusColor(status)} 
              fontSize="xs"
              px={2}
              py={1}
              borderRadius="full"
              textTransform="uppercase"
              fontWeight="bold"
              boxShadow="md"
            >
              {status.replace('_', ' ')}
            </Badge>
          )}
        </Box>

        {/* Countdown Overlay */}
        {status === 'ON_SALE' && timeLeft && !timeLeft.includes('started') && (
          <Box 
            position="absolute" 
            bottom={0} 
            left={0} 
            right={0}
            bg="blackAlpha.700"
            color="white"
            py={2}
            px={3}
          >
            <HStack justify="center" spacing={1}>
              <Text fontSize="xs" fontWeight="medium">⏰ Starts in:</Text>
              <Text fontSize="xs" fontWeight="bold" color="yellow.300">{timeLeft}</Text>
            </HStack>
          </Box>
        )}
      </Box>

      <VStack align="stretch" p={5} spacing={3}>
        <Heading size="md" noOfLines={2} lineHeight="shorter">
          {eventName}
        </Heading>
        
        <VStack align="stretch" spacing={1}>
          <HStack>
            <Text fontSize="sm" color="gray.500"></Text>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              {formatDateTime(startDatetime)}
            </Text>
          </HStack>
          {location && (
            <HStack>
              <Text fontSize="sm" color="gray.500">📍</Text>
              <Text fontSize="sm" color="gray.600" noOfLines={1}>
                {location}
              </Text>
            </HStack>
          )}
        </VStack>

        <Button
          as={Link}
          to={`/events/${id}`}
          colorScheme={status === 'ON_SALE' ? 'blue' : 'gray'}
          size="lg"
          w="full"
          mt={2}
          fontWeight="bold"
          isDisabled={status === 'CANCELLED' || status === 'COMPLETED'}
          _hover={{
            transform: status === 'ON_SALE' ? 'scale(1.02)' : 'none',
          }}
          transition="all 0.2s ease"
        >
          {status === 'ON_SALE' && 'Get Tickets'}
          {status === 'SCHEDULED' && 'Coming Soon'}
          {status === 'CANCELLED' && 'Cancelled'}
          {status === 'COMPLETED' && '✓ Event Ended'}
          {!status && 'Get Tickets'}
        </Button>
      </VStack>
    </LinkBox>
  );
}

export default EventCard;