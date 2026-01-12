import React from 'react';
import { Box, Flex, Text, Button, Spacer } from '@chakra-ui/react';

function Navbar() {
  return (
    <Flex bg="blue.500" color="white" p="4" alignItems="center">
      <Box p="2">
        <Text fontSize="xl" fontWeight="bold">Tessera Events</Text>
      </Box>
      <Spacer />
      <Box>
        <Button colorScheme="blue" variant="outline">Profile</Button>
      </Box>
    </Flex>
  );
}

export default Navbar;