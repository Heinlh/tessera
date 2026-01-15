import React, { useEffect, useState, useMemo } from 'react';
import {
  SimpleGrid,
  Container,
  Input,
  InputGroup,
  InputLeftElement,
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
} from '@chakra-ui/react';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import EventCard from '../components/EventCard';

// Date range grid component for filtering between two dates
function DateGrid({ startDate, endDate, onSelectRange }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before the 1st
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const formatDate = (d) => d.toISOString().split('T')[0];

  const handleDayClick = (day) => {
    const dateStr = formatDate(day);
    if (!startDate || (startDate && endDate)) {
      // Start a new range
      onSelectRange(dateStr, '');
    } else {
      // Complete the range
      if (dateStr < startDate) {
        onSelectRange(dateStr, startDate);
      } else {
        onSelectRange(startDate, dateStr);
      }
    }
  };

  const isInRange = (day) => {
    if (!day || !startDate || !endDate) return false;
    const dateStr = formatDate(day);
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isStart = (day) => day && startDate === formatDate(day);
  const isEnd = (day) => day && endDate === formatDate(day);

  return (
    <Box bg="white" p={4} borderRadius="md" boxShadow="sm" border="1px solid" borderColor="gray.200">
      <Text fontSize="xs" color="gray.500" mb={3} textAlign="center">
        Click a date to set the starting date , then click another to set the end of your range and events between will be shown.
      </Text>
      <HStack justify="space-between" mb={3}>
        <IconButton icon={<ChevronLeftIcon />} size="sm" variant="ghost" onClick={prevMonth} aria-label="Previous month" />
        <Text fontWeight="semibold">{monthLabel}</Text>
        <IconButton icon={<ChevronRightIcon />} size="sm" variant="ghost" onClick={nextMonth} aria-label="Next month" />
      </HStack>
      {startDate && !endDate && (
        <Text fontSize="xs" color="blue.500" mb={2} textAlign="center">Click another date to complete the range</Text>
      )}
      {startDate && endDate && (
        <Text fontSize="xs" color="gray.600" mb={2} textAlign="center">{startDate} → {endDate}</Text>
      )}
      <SimpleGrid columns={7} spacing={1} textAlign="center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Text key={d} fontSize="xs" fontWeight="bold" color="gray.500">{d}</Text>
        ))}
        {daysInMonth.map((day, idx) => {
          const inRange = isInRange(day);
          const start = isStart(day);
          const end = isEnd(day);
          return (
            <Button
              key={idx}
              size="sm"
              variant={(start || end) ? 'solid' : inRange ? 'outline' : 'ghost'}
              colorScheme={(start || end || inRange) ? 'blue' : 'gray'}
              bg={inRange && !start && !end ? 'blue.50' : undefined}
              isDisabled={!day}
              onClick={() => day && handleDayClick(day)}
            >
              {day ? day.getDate() : ''}
            </Button>
          );
        })}
      </SimpleGrid>
      {(startDate || endDate) && (
        <Button size="xs" mt={3} variant="link" colorScheme="blue" onClick={() => onSelectRange('', '')}>
          Clear date filter
        </Button>
      )}
    </Box>
  );
}

function EventsPage() {
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSelectRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    // Get today's date in YYYY-MM-DD format to filter only future events
    const today = new Date().toISOString().split('T')[0];
    fetch(`http://localhost:5000/events?afterDate=${today}`)
      .then(response => response.json())
      .then(setEvents)
      .catch(error => console.error('Error fetching events:', error));
  }, []);

  // Filter events based on search query and selected date range
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const location = [event.venue_name, event.city].filter(Boolean).join(', ');
      const matchesSearch =
        !searchQuery ||
        event.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesDate = true;
      const eventDate = event.start_datetime?.split('T')[0]; // Extract date portion from ISO datetime
      if (startDate && endDate) {
        matchesDate = eventDate >= startDate && eventDate <= endDate;
      } else if (startDate) {
        matchesDate = eventDate === startDate;
      }
      return matchesSearch && matchesDate;
    });
  }, [events, searchQuery, startDate, endDate]);

  const hasDateFilter = startDate || endDate;

  return (
    <Box
      minH="calc(100vh - 60px)"
      bg="linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)"
      w="full"
    >
    <Container maxW="container.xl" centerContent>
      {/* Search and Date Filter Section */}
      <VStack spacing={4} py={6} w="full" maxW="lg">
        <HStack w="full" spacing={3}>
          <InputGroup size="lg" flex={1}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search events by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg="white"
              borderRadius="full"
              boxShadow="sm"
            />
          </InputGroup>
          <Button
            bgGradient="linear(135deg, #3182ce 0%, #2c5282 100%)"
            color="white"
            size="lg"
            borderRadius="full"
            boxShadow="md"
            fontWeight="semibold"
            _hover={{
              bgGradient: 'linear(135deg, #2b6cb0 0%, #1a365d 100%)',
              transform: 'translateY(-2px)',
              boxShadow: 'lg',
            }}
            _active={{
              transform: 'translateY(0)',
              boxShadow: 'sm',
            }}
            transition="all 0.2s ease"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            Date {hasDateFilter ? '✓' : ''}
          </Button>
        </HStack>
        {showDatePicker && (
          <DateGrid startDate={startDate} endDate={endDate} onSelectRange={handleSelectRange} />
        )}
      </VStack>

      <SimpleGrid columns={{ sm: 1, md: 2, lg: 3 }} spacing={10} py={5}>
        {filteredEvents.map(event => (
          <EventCard
            key={event.event_id}
            id={event.event_id}
            eventName={event.event_name}
            startDatetime={event.start_datetime}
            venueName={event.venue_name}
            city={event.city}
            imageUrl={event.image_url}
            status={event.status}
          />
        ))}
      </SimpleGrid>
    </Container>
    </Box>
  );
}

export default EventsPage;