import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';

function MyProfile() {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <Box
      minH="calc(100vh - 72px)"
      bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      py={12}
      px={4}
    >
      <Container maxW="lg">
        <Box
          bg="white"
          borderRadius="2xl"
          boxShadow="2xl"
          p={{ base: 8, md: 10 }}
        >
          <VStack spacing={6} align="start">
            <Heading fontSize="2xl" color="gray.800">
              My Profile
            </Heading>
            <Text color="gray.600">
              Welcome, <strong>{user.username || 'User'}</strong>!
            </Text>
            <Text color="gray.500">
              Email: {user.email || 'N/A'}
            </Text>
            <Text color="gray.500">
              Role: {user.role || 'user'}
            </Text>
            <Text color="gray.400" fontSize="sm">
              This is a placeholder profile page. More features coming soon!
            </Text>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
}

export default MyProfile;
