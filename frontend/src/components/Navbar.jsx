import React from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Spacer,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  HStack,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <Flex bg="blue.500" color="black" p="4" alignItems="center">
      <Box p="2">
        <Text fontSize="xl" fontWeight="bold">Tessera</Text>
      </Box>
      <Spacer />
      <Box>
        <Menu>
          <MenuButton
            as={Button}
            bg="white"
            color="black"
            _hover={{ bg: 'blue.50' }}
            px={3}
            py={1}
            borderRadius="full"
            boxShadow="sm"
          >
            <HStack spacing={3} alignItems="center">
              <Avatar size="sm" name="User" />
              <Text fontSize="sm" fontWeight="semibold">Profile</Text>
              <ChevronDownIcon />
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem as={Link} to="/signin">Sign In/Register</MenuItem>
            <MenuItem>Admin</MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </Flex>
  );
}

export default Navbar;