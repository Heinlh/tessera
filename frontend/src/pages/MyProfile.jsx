import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Avatar,
  Badge,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { EmailIcon, AtSignIcon } from '@chakra-ui/icons';
import { gradients } from '../theme';
import { PageWrapper, GlassCard } from '../components/ui';

function MyProfile() {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <PageWrapper bg={gradients.profileBackground} minH="calc(100vh - 64px)">
      <Container maxW="lg" py={12} px={4}>
        <GlassCard padding={{ base: 8, md: 10 }} hover={false}>
          <VStack spacing={8} align="stretch">
            {/* Profile Header */}
            <VStack spacing={4}>
              <Avatar
                size="2xl"
                name={user.username || 'User'}
                bg="blue.500"
                color="white"
                fontSize="3xl"
                fontWeight="bold"
              />
              <VStack spacing={1}>
                <Heading size="lg" color="gray.800" letterSpacing="-0.02em">
                  {user.username || 'User'}
                </Heading>
                <Badge
                  colorScheme={user.role === 'ADMIN' ? 'purple' : 'blue'}
                  fontSize="sm"
                  px={3}
                  py={1}
                  borderRadius="full"
                  textTransform="capitalize"
                >
                  {user.role?.toLowerCase() || 'customer'}
                </Badge>
              </VStack>
            </VStack>

            <Divider borderColor="gray.200" />

            {/* Profile Details */}
            <VStack spacing={4} align="stretch">
              <HStack spacing={4} p={4} bg="gray.50" borderRadius="xl">
                <Box
                  p={3}
                  bg="blue.100"
                  borderRadius="lg"
                  color="blue.600"
                >
                  <Icon as={EmailIcon} boxSize={5} />
                </Box>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">
                    Email Address
                  </Text>
                  <Text color="gray.800" fontWeight="semibold">
                    {user.email || 'Not provided'}
                  </Text>
                </VStack>
              </HStack>

              <HStack spacing={4} p={4} bg="gray.50" borderRadius="xl">
                <Box
                  p={3}
                  bg="purple.100"
                  borderRadius="lg"
                  color="purple.600"
                >
                  <Icon as={AtSignIcon} boxSize={5} />
                </Box>
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">
                    Username
                  </Text>
                  <Text color="gray.800" fontWeight="semibold">
                    {user.username || 'Not set'}
                  </Text>
                </VStack>
              </HStack>
            </VStack>

            {/* Placeholder Notice */}
            <Box
              bg="blue.50"
              border="1px solid"
              borderColor="blue.100"
              borderRadius="xl"
              p={4}
              textAlign="center"
            >
              <Text color="blue.600" fontSize="sm">
                More profile features coming soon!
              </Text>
            </Box>
          </VStack>
        </GlassCard>
      </Container>
    </PageWrapper>
  );
}

export default MyProfile;
