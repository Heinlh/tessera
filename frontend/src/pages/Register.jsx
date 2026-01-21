import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Link,
  Text,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@chakra-ui/react';
import { EmailIcon, LockIcon, ViewIcon, ViewOffIcon, AtSignIcon } from '@chakra-ui/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { gradients } from '../theme';
import { PageWrapper, GlassCard, PrimaryButton } from '../components/ui';

function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Success modal state
  const { isOpen: isSuccessOpen, onOpen: onSuccessOpen, onClose: onSuccessClose } = useDisclosure();
  // Error modal state
  const { isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose } = useDisclosure();
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show success modal
        onSuccessOpen();
      } else if (response.status === 409) {
        // Username or email already exists
        setModalErrorMessage('An account with that username or email already exists.');
        onErrorOpen();
      } else {
        setErrorMessage(data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Unable to connect to server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    onSuccessClose();
    navigate('/signin');
  };

  return (
    <>
      <PageWrapper
        bg={gradients.authBackground}
        minH="calc(100vh - 64px)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        py={12}
        px={4}
      >
        <Container maxW="md">
          <GlassCard padding={{ base: 8, md: 10 }} hover={false}>
            <VStack spacing={6} as="form" onSubmit={handleSubmit}>
              {/* Header */}
              <VStack spacing={2} textAlign="center" w="full">
                <Heading fontSize="3xl" fontWeight="bold" color="black">
                  Create Account
                </Heading>
                <Text color="gray.500" fontSize="md">
                  Sign up to get started with Tessera
                </Text>
                {/* Error Message */}
                {errorMessage && (
                  <Text color="red.500" fontSize="sm" fontWeight="medium">
                    {errorMessage}
                  </Text>
                )}
              </VStack>

              {/* Email Input */}
              <FormControl isRequired>
                <FormLabel color="black" fontWeight="medium">
                  Email Address
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement pointerEvents="none">
                    <EmailIcon color="blue.400" />
                  </InputLeftElement>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                    color="black"
                    _placeholder={{ color: 'gray.400' }}
                    _hover={{ borderColor: 'blue.300' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px #3182ce',
                      bg: 'white',
                    }}
                  />
                </InputGroup>
              </FormControl>

              {/* Username Input */}
              <FormControl isRequired>
                <FormLabel color="black" fontWeight="medium">
                  Username
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement pointerEvents="none">
                    <AtSignIcon color="blue.400" />
                  </InputLeftElement>
                  <Input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                    color="black"
                    _placeholder={{ color: 'gray.400' }}
                    _hover={{ borderColor: 'blue.300' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px #3182ce',
                      bg: 'white',
                    }}
                  />
                </InputGroup>
              </FormControl>

              {/* Password Input */}
              <FormControl isRequired>
                <FormLabel color="black" fontWeight="medium">
                  Password
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement pointerEvents="none">
                    <LockIcon color="blue.400" />
                  </InputLeftElement>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                    color="black"
                    _placeholder={{ color: 'gray.400' }}
                    _hover={{ borderColor: 'blue.300' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px #3182ce',
                      bg: 'white',
                    }}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      color="gray.500"
                      _hover={{ color: 'blue.500' }}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {/* Confirm Password Input */}
              <FormControl isRequired>
                <FormLabel color="black" fontWeight="medium">
                  Confirm Password
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement pointerEvents="none">
                    <LockIcon color="blue.400" />
                  </InputLeftElement>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    bg="gray.50"
                    border="2px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                    color="black"
                    _placeholder={{ color: 'gray.400' }}
                    _hover={{ borderColor: 'blue.300' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px #3182ce',
                      bg: 'white',
                    }}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      color="gray.500"
                      _hover={{ color: 'blue.500' }}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {/* Register Button */}
              <PrimaryButton
                type="submit"
                w="full"
                isLoading={isLoading}
                loadingText="Creating account..."
              >
                Create Account
              </PrimaryButton>

              {/* Sign In Link */}
              <Text color="gray.600" fontSize="sm" textAlign="center">
                Already have an account?{' '}
                <Link
                  as={RouterLink}
                  to="/signin"
                  color="blue.500"
                  fontWeight="bold"
                  _hover={{ color: 'blue.600', textDecoration: 'underline' }}
                >
                  Sign in
                </Link>
              </Text>
            </VStack>
          </GlassCard>
        </Container>
      </PageWrapper>

      {/* Success Modal */}
      <Modal isOpen={isSuccessOpen} onClose={handleSuccessClose} isCentered closeOnOverlayClick={false}>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" mx={4}>
          <ModalHeader color="green.600">Account Created!</ModalHeader>
          <ModalBody>
            <Text color="gray.600">
              Your account has been successfully created. You can now sign in with your credentials.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={handleSuccessClose} borderRadius="lg">
              Go to Sign In
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={isErrorOpen} onClose={onErrorClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" mx={4}>
          <ModalHeader color="red.600">Registration Failed</ModalHeader>
          <ModalBody>
            <Text color="gray.600">{modalErrorMessage}</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onErrorClose} borderRadius="lg">
              Try Again
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default Register;
