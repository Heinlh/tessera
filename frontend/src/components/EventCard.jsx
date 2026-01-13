import React, { useEffect, useState } from 'react';
import { Box, Image, Text, VStack, Heading, LinkBox, Button } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

function EventCard({ id, name, date, time, location, imageUrl }) {
  const [timeLeft, setTimeLeft] = useState('');

  // Parse a date string and optional time string into a Date object.
  const parseEventDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null;
    // If time is provided, try to create an ISO datetime string.
    if (timeStr) {
      // Normalize time like "14:30" or "14:30:00" to an ISO-like format
      const t = timeStr.trim();
      // If time already looks like 24h (HH:MM or HH:MM:SS)
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
        const padded = t.split(':').map((s, i) => (i === 0 && s.length === 1 ? `0${s}` : s)).join(':');
        const iso = `${dateStr}T${padded}`;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
      }
      // Fallback: try Date parsing of combined string (handles "2:30 PM")
      const combined = `${dateStr} ${t}`;
      const d2 = new Date(combined);
      if (!isNaN(d2.getTime())) return d2;
    }

    // Fallback: just parse the date (will be midnight local time)
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  useEffect(() => {
    const updateTimer = () => {
      const eventDateObj = parseEventDateTime(date, time);
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
  }, [date, time]);

  return (
    <LinkBox as="article" w="full" borderWidth="1px" rounded="md" overflow="hidden" boxShadow="md">
      <VStack align="stretch">
        {imageUrl && (
          <Image borderRadius="md" src={imageUrl} alt={`Image for ${name}`} objectFit="cover" width="full" />
        )}
        <VStack align="stretch" p="4">
        <Heading size="md" my="2">{name}</Heading>
          <Text fontSize="sm">Date: {date}{time ? ` ${time}` : ''}</Text>
          <Text fontSize="sm">Location: {location}</Text>
          <Text fontSize="sm" color="red.500">{timeLeft}</Text>
          <Button colorScheme="blue" mt="4" as={Link} to={`/events/${id}`}>
            Buy Tickets!
          </Button>
        </VStack>
      </VStack>
    </LinkBox>
  );
}

export default EventCard;