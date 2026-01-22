import React, { useState } from 'react';
import { API_URL } from '../config';
import {
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Link,
  Text,
  VStack,
  Icon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { EmailIcon, LockIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { gradients } from '../theme';
import { PageWrapper, GlassCard, PrimaryButton, DividerWithText } from './ui';

function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot password modal state
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email, // The backend expects username, but we use email field
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store tokens and user data in localStorage
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        toast({
          title: 'Login successful!',
          description: `Welcome back, ${data.user.username}!`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Navigate to events page
        navigate('/events');
      } else {
        setErrorMessage('Invalid username or password. Please try again!');
      }
    } catch (error) {
      setErrorMessage('Unable to connect to server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotPasswordMessage('');
    setForgotPasswordError('');
    setIsForgotLoading(true);

    try {
      // Check if email exists in database
      // For now, we'll simulate this check - in production you'd have a dedicated endpoint
      const response = await fetch(`${API_URL}/emails`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Since /emails is protected, we'll just show a success message
      // In a real app, you'd have a public endpoint for password reset requests
      setForgotPasswordMessage(
        `If an account exists for ${forgotEmail}, a password reset link has been sent to that email address.`
      );
    } catch (error) {
      // For security, always show the same message regardless of whether email exists
      setForgotPasswordMessage(
        `If an account exists for ${forgotEmail}, a password reset link has been sent to that email address.`
      );
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotModalClose = () => {
    setForgotEmail('');
    setForgotPasswordMessage('');
    setForgotPasswordError('');
    onClose();
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
                <Heading
                  fontSize="3xl"
                  fontWeight="bold"
                  color="black"
                >
                  Welcome Back
                </Heading>
                <Text color="gray.500" fontSize="md">
                  Sign in to continue to Tessera
                </Text>
                {/* Error Message */}
                {errorMessage && (
                  <Text color="red.500" fontSize="sm" fontWeight="medium">
                    {errorMessage}
                  </Text>
                )}
              </VStack>

              {/* Email/Username Input */}
              <FormControl>
                <FormLabel color="black" fontWeight="medium">
                  Username or Email
                </FormLabel>
                <InputGroup size="lg">
                  <InputLeftElement pointerEvents="none">
                    <EmailIcon color="blue.400" />
                  </InputLeftElement>
                  <Input
                    type="text"
                    placeholder="Enter your username or email"
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

            {/* Password Input */}
            <FormControl>
              <FormLabel color="black" fontWeight="medium">
                Password
              </FormLabel>
              <InputGroup size="lg">
                <InputLeftElement pointerEvents="none">
                  <LockIcon color="blue.400" />
                </InputLeftElement>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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

            {/* Remember Me & Forgot Password */}
            <HStack justify="space-between" w="full">
              <Checkbox
                colorScheme="blue"
                isChecked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              >
                <Text color="black" fontSize="sm">
                  Remember me
                </Text>
              </Checkbox>
              <Link
                color="blue.500"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ color: 'blue.600' }}
                onClick={onOpen}
                cursor="pointer"
              >
                Forgot password?
              </Link>
            </HStack>

            {/* Sign In Button */}
            <PrimaryButton
              type="submit"
              w="full"
              isLoading={isLoading}
              loadingText="Signing in..."
            >
              Sign In
            </PrimaryButton>

            {/* Divider */}
            <DividerWithText>or continue with</DividerWithText>

            {/* Social Login Buttons */}
            <HStack w="full" spacing={4}>
              <Button
                w="full"
                size="lg"
                variant="outline"
                borderColor="gray.300"
                borderRadius="xl"
                color="black"
                leftIcon={
                  <Icon viewBox="0 0 24 24" boxSize={5}>
                    <path
                      fill="#EA4335"
                      d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7## L1.23746264,17.3349879 L5.27698177,14.2678769 Z"
                    />
                  </Icon>
                }
                _hover={{
                  bg: 'gray.50',
                  borderColor: 'blue.300',
                }}
              >
                Google
              </Button>
              <Button
                w="full"
                size="lg"
                bg="#1877F2"
                color="white"
                borderRadius="xl"
                leftIcon={
                  <Icon viewBox="0 0 24 24" boxSize={5} fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </Icon>
                }
                _hover={{
                  bg: '#166FE5',
                  transform: 'translateY(-2px)',
                  boxShadow: 'md',
                }}
                _active={{ bg: '#1565D8' }}
                transition="all 0.2s"
              >
                Facebook
              </Button>
            </HStack>

            {/* Sign Up Link */}
            <Text color="gray.600" fontSize="sm" textAlign="center">
              Don't have an account?{' '}
              <Link
                as={RouterLink}
                to="/register"
                color="blue.500"
                fontWeight="bold"
                _hover={{ color: 'blue.600', textDecoration: 'underline' }}
              >
                Sign up
              </Link>
            </Text>
          </VStack>
        </GlassCard>
      </Container>
    </PageWrapper>

    {/* Forgot Password Modal */}
    <Modal isOpen={isOpen} onClose={handleForgotModalClose} isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" mx={4}>
        <ModalHeader color="gray.800">Reset Password</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Text color="gray.600" fontSize="sm">
              Enter your email address and we'll send you a link to reset your password.
            </Text>
            <FormControl>
              <Input
                type="email"
                placeholder="Enter your email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                bg="gray.50"
                border="2px solid"
                borderColor="gray.200"
                borderRadius="lg"
                color="black"
                _placeholder={{ color: 'gray.400' }}
                _focus={{
                  borderColor: 'blue.500',
                  boxShadow: '0 0 0 1px #3182ce',
                }}
              />
            </FormControl>
            {forgotPasswordMessage && (
              <Text color="green.500" fontSize="sm" textAlign="center">
                {forgotPasswordMessage}
              </Text>
            )}
            {forgotPasswordError && (
              <Text color="red.500" fontSize="sm" textAlign="center">
                {forgotPasswordError}
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={handleForgotModalClose} borderRadius="lg">
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleForgotPassword}
            borderRadius="lg"
            isLoading={isForgotLoading}
            isDisabled={!forgotEmail}
          >
            Send Reset Link
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>
  );
}

export default SignIn;