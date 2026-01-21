import React, { useState, useEffect } from 'react';
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
  MenuDivider,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Icon,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { gradients } from '../theme';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Check if user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check localStorage for auth tokens/user data
    const accessToken = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');
    if (accessToken && userData) {
      setIsSignedIn(true);
      setUser(JSON.parse(userData));
    } else {
      setIsSignedIn(false);
      setUser(null);
    }
  }, [location]); // Re-check when location changes

  const handleLogoClick = () => {
    if (location.pathname === '/events') {
      // Refresh the page if already on events page
      window.location.reload();
    } else {
      // Navigate to events page
      navigate('/events');
    }
  };

  const handleLogout = () => {
    // Clear all auth data from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setIsSignedIn(false);
    setUser(null);
    onClose();
    navigate('/events');
  };

  return (
    <>
      <Flex
        bg={gradients.navBar}
        color="white"
        px={{ base: 4, md: 6 }}
        py={3}
        alignItems="center"
        boxShadow="nav"
        position="sticky"
        top={0}
        zIndex={100}
        h="64px"
      >
        {/* Logo Box */}
        <Box
          as="button"
          onClick={handleLogoClick}
          bg="white"
          px={{ base: 4, md: 5 }}
          py={2}
          borderRadius="xl"
          boxShadow="md"
          transition="all 0.2s ease"
          _hover={{
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
            bg: 'gray.50',
          }}
          _active={{
            transform: 'translateY(0)',
            boxShadow: 'sm',
          }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: 'white',
            outlineOffset: '2px',
          }}
        >
          <Text
            fontSize={{ base: 'lg', md: 'xl' }}
            fontWeight="extrabold"
            bgGradient="linear(to-r, blue.500, blue.700)"
            bgClip="text"
            letterSpacing="tight"
          >
            ✦ Tessera
          </Text>
        </Box>

        <Spacer />

        {/* Profile Menu */}
        <Box>
          <Menu>
            <MenuButton
              as={Button}
              bg="whiteAlpha.200"
              color="white"
              backdropFilter="blur(10px)"
              _hover={{ bg: 'whiteAlpha.300' }}
              _active={{ bg: 'whiteAlpha.400' }}
              px={4}
              py={2}
              borderRadius="full"
              boxShadow="sm"
              border="1px solid"
              borderColor="whiteAlpha.300"
              transition="all 0.2s ease"
            >
              <HStack spacing={3} alignItems="center">
                <Avatar
                  size="sm"
                  name={isSignedIn && user ? user.username : 'User'}
                  bg="blue.600"
                  color="white"
                  fontWeight="bold"
                />
                <Text fontSize="sm" fontWeight="semibold" display={{ base: 'none', md: 'block' }}>
                  {isSignedIn && user ? user.username : 'Profile'}
                </Text>
                <ChevronDownIcon />
              </HStack>
            </MenuButton>
            <MenuList
              bg="white"
              borderColor="gray.200"
              boxShadow="xl"
              borderRadius="lg"
              py={2}
            >
              {/* Show "You are not signed in" if not logged in */}
              {!isSignedIn && (
                <>
                  <Box
                    mx={2}
                    mb={2}
                    px={4}
                    py={3}
                    border="2px solid"
                    borderColor="gray.300"
                    borderRadius="md"
                    bg="gray.50"
                  >
                    <Text
                      color="gray.600"
                      fontWeight="bold"
                      fontSize="md"
                      textAlign="center"
                      cursor="default"
                    >
                      You are not signed in
                    </Text>
                  </Box>
                  <MenuItem
                    as={Link}
                    to="/signin"
                    color="black"
                    fontWeight="medium"
                    _hover={{ bg: 'blue.50', color: 'blue.600' }}
                    borderRadius="md"
                    mx={2}
                  >
                    Sign In / Register
                  </MenuItem>
                </>
              )}

              {/* Show My Profile, My Cart, and Logout if logged in */}
              {isSignedIn && (
                <>
                  <MenuItem
                    as={Link}
                    to="/profile"
                    color="black"
                    fontWeight="medium"
                    _hover={{ bg: 'blue.50', color: 'blue.600' }}
                    borderRadius="md"
                    mx={2}
                  >
                    My Profile
                  </MenuItem>
                  <MenuItem
                    as={Link}
                    to="/checkout"
                    color="black"
                    fontWeight="medium"
                    _hover={{ bg: 'green.50', color: 'green.600' }}
                    borderRadius="md"
                    mx={2}
                  >
                    🛒 My Cart
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem
                    onClick={onOpen}
                    color="red.500"
                    fontWeight="medium"
                    _hover={{ bg: 'red.50', color: 'red.600' }}
                    borderRadius="md"
                    mx={2}
                  >
                    Logout
                  </MenuItem>
                </>
              )}
            </MenuList>
          </Menu>
        </Box>
      </Flex>

      {/* Logout Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" mx={4}>
          <ModalHeader color="gray.800">Confirm Logout</ModalHeader>
          <ModalBody>
            <Text color="gray.600">Are you sure you want to log out?</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="outline"
              onClick={onClose}
              borderRadius="lg"
            >
              No
            </Button>
            <Button
              colorScheme="red"
              onClick={handleLogout}
              borderRadius="lg"
            >
              Yes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default Navbar;