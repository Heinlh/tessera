import React, { useEffect, useState } from 'react';
import { Box, Image, Text, VStack, Heading, LinkBox, Button, Badge, HStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { gradients } from '../theme';

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
      borderRadius="2xl" 
      overflow="hidden" 
      boxShadow="card"
      bg="white"
      transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      _hover={{
        transform: 'translateY(-8px)',
        boxShadow: 'cardHover',
      }}
      border="1px solid"
      borderColor="gray.100"
    >
      <Box position="relative">
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={`Image for ${eventName}`} 
            objectFit="cover" 
            width="full" 
            height="220px"
            transition="transform 0.3s ease"
            _groupHover={{ transform: 'scale(1.05)' }}
          />
        ) : (
          <Box 
            height="220px" 
            bg={gradients.cardPlaceholder}
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
              px={3}
              py={1}
              borderRadius="full"
              textTransform="uppercase"
              fontWeight="bold"
              boxShadow="sm"
              backdropFilter="blur(4px)"
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
            backdropFilter="blur(4px)"
            color="white"
            py={2}
            px={4}
          >
            <HStack justify="center" spacing={2}>
              <Text fontSize="xs" fontWeight="medium">Starts in:</Text>
              <Text fontSize="xs" fontWeight="bold" color="yellow.300">{timeLeft}</Text>
            </HStack>
          </Box>
        )}
      </Box>

      <VStack align="stretch" p={5} spacing={4}>
        <Heading 
          size="md" 
          noOfLines={2} 
          lineHeight="shorter"
          color="gray.800"
          letterSpacing="-0.01em"
        >
          {eventName}
        </Heading>
        
        <VStack align="stretch" spacing={2}>
          <HStack>
            <Text fontSize="sm" color="gray.400"></Text>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              {formatDateTime(startDatetime)}
            </Text>
          </HStack>
          {location && (
            <HStack>
              <Text fontSize="sm" color="gray.400">📍</Text>
              <Text fontSize="sm" color="gray.500" noOfLines={1}>
                {location}
              </Text>
            </HStack>
          )}
        </VStack>

        <Button
          as={Link}
          to={`/events/${id}`}
          bgGradient={status === 'ON_SALE' ? gradients.primaryButton : undefined}
          colorScheme={status === 'ON_SALE' ? undefined : 'gray'}
          color={status === 'ON_SALE' ? 'white' : undefined}
          size="lg"
          w="full"
          mt={2}
          fontWeight="bold"
          borderRadius="xl"
          isDisabled={status === 'CANCELLED' || status === 'COMPLETED'}
          _hover={{
            bgGradient: status === 'ON_SALE' ? gradients.primaryButtonHover : undefined,
            transform: status === 'ON_SALE' ? 'scale(1.02)' : 'none',
            boxShadow: status === 'ON_SALE' ? 'lg' : undefined,
          }}
          transition="all 0.2s ease"
        >
          {status === 'ON_SALE' && 'Get Tickets'}
          {status === 'SCHEDULED' && 'Coming Soon'}
          {status === 'CANCELLED' && 'Cancelled'}
          {status === 'COMPLETED' && 'Event Ended'}
          {!status && 'Get Tickets'}
        </Button>
      </VStack>
    </LinkBox>
  );
}

export default EventCard;