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
  Heading,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@chakra-ui/icons';
import EventCard from '../components/EventCard';
import { gradients } from '../theme';
import { PageWrapper, PageContainer, SectionHeader, EmptyState, PrimaryButton } from '../components/ui';

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
    <Box 
      bg="white" 
      p={5} 
      borderRadius="2xl" 
      boxShadow="card" 
      border="1px solid" 
      borderColor="gray.100"
      w="full"
      maxW="sm"
    >
      <Text fontSize="sm" color="gray.500" mb={4} textAlign="center">
        Select a date range to filter events
      </Text>
      <HStack justify="space-between" mb={4}>
        <IconButton 
          icon={<ChevronLeftIcon />} 
          size="sm" 
          variant="ghost" 
          onClick={prevMonth} 
          aria-label="Previous month"
          borderRadius="lg"
          _hover={{ bg: 'gray.100' }}
        />
        <Text fontWeight="semibold" color="gray.700">{monthLabel}</Text>
        <IconButton 
          icon={<ChevronRightIcon />} 
          size="sm" 
          variant="ghost" 
          onClick={nextMonth} 
          aria-label="Next month"
          borderRadius="lg"
          _hover={{ bg: 'gray.100' }}
        />
      </HStack>
      {startDate && !endDate && (
        <Text fontSize="xs" color="blue.500" mb={3} textAlign="center" fontWeight="medium">
          Click another date to complete the range
        </Text>
      )}
      {startDate && endDate && (
        <Box bg="blue.50" px={3} py={2} borderRadius="lg" mb={3}>
          <Text fontSize="sm" color="blue.700" textAlign="center" fontWeight="medium">
            {startDate} → {endDate}
          </Text>
        </Box>
      )}
      <SimpleGrid columns={7} spacing={1} textAlign="center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Text key={d} fontSize="xs" fontWeight="bold" color="gray.400" py={2}>{d}</Text>
        ))}
        {daysInMonth.map((day, idx) => {
          const inRange = isInRange(day);
          const start = isStart(day);
          const end = isEnd(day);
          return (
            <Button
              key={idx}
              size="sm"
              h="36px"
              variant={(start || end) ? 'solid' : inRange ? 'outline' : 'ghost'}
              colorScheme={(start || end || inRange) ? 'blue' : 'gray'}
              bg={inRange && !start && !end ? 'blue.50' : undefined}
              isDisabled={!day}
              onClick={() => day && handleDayClick(day)}
              borderRadius="lg"
              fontWeight={start || end ? 'bold' : 'normal'}
              transition="all 0.15s ease"
            >
              {day ? day.getDate() : ''}
            </Button>
          );
        })}
      </SimpleGrid>
      {(startDate || endDate) && (
        <Button 
          size="sm" 
          mt={4} 
          w="full"
          variant="ghost" 
          colorScheme="blue" 
          onClick={() => onSelectRange('', '')}
          borderRadius="lg"
        >
          Clear date filter
        </Button>
      )}
    </Box>
  );
}

function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    fetch(`http://localhost:5000/events?afterDate=${today}`)
      .then(response => response.json())
      .then(data => {
        setEvents(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching events:', error);
        setLoading(false);
      });
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
    <PageWrapper bg={gradients.eventsBackground}>
      <PageContainer maxW="container.xl" centerContent py={8}>
        {/* Hero Section */}
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading 
            size="xl" 
            color="gray.800"
            letterSpacing="-0.02em"
          >
            Discover Events
          </Heading>
          <Text color="gray.500" fontSize="lg" maxW="md">
            Find and book tickets to the best events near you
          </Text>
        </VStack>

        {/* Search and Date Filter Section */}
        <VStack spacing={4} w="full" maxW="lg" mb={8}>
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
                borderRadius="xl"
                border="2px solid"
                borderColor="gray.200"
                boxShadow="sm"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ 
                  borderColor: 'blue.500', 
                  boxShadow: '0 0 0 1px #3182ce',
                  bg: 'white',
                }}
                transition="all 0.2s ease"
              />
            </InputGroup>
            <Button
              bgGradient={gradients.primaryButton}
              color="white"
              size="lg"
              borderRadius="xl"
              boxShadow="md"
              fontWeight="semibold"
              px={6}
              leftIcon={<CalendarIcon />}
              _hover={{
                bgGradient: gradients.primaryButtonHover,
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
              {hasDateFilter ? 'Filtered' : 'Date'}
            </Button>
          </HStack>
          {showDatePicker && (
            <DateGrid startDate={startDate} endDate={endDate} onSelectRange={handleSelectRange} />
          )}
        </VStack>

        {/* Loading State */}
        {loading && (
          <Center py={20}>
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" thickness="3px" />
              <Text color="gray.500">Loading events...</Text>
            </VStack>
          </Center>
        )}

        {/* Empty State */}
        {!loading && filteredEvents.length === 0 && (
          <EmptyState
            icon="🎭"
            title="No events found"
            description={searchQuery || hasDateFilter 
              ? "Try adjusting your search or filters"
              : "Check back soon for upcoming events"}
            action={
              (searchQuery || hasDateFilter) && (
                <Button
                  variant="outline"
                  colorScheme="blue"
                  borderRadius="xl"
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        )}

        {/* Event Grid */}
        {!loading && filteredEvents.length > 0 && (
          <SimpleGrid 
            columns={{ base: 1, md: 2, lg: 3 }} 
            spacing={{ base: 6, md: 8 }} 
            w="full"
            pb={8}
          >
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
        )}
      </PageContainer>
    </PageWrapper>
  );
}

export default EventsPage;