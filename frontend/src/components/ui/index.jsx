/**
 * Tessera UI Primitives
 * Reusable components for consistent styling across the application
 */

import React from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  IconButton,
} from '@chakra-ui/react';
import { gradients } from '../../theme';

// =============================================================================
// LAYOUT PRIMITIVES
// =============================================================================

/**
 * PageContainer - Consistent page wrapper with max-width and padding
 */
export function PageContainer({ children, maxW = 'container.xl', centerContent = false, ...props }) {
  return (
    <Container 
      maxW={maxW} 
      px={{ base: 4, md: 6, lg: 8 }}
      centerContent={centerContent}
      {...props}
    >
      {children}
    </Container>
  );
}

/**
 * PageWrapper - Full page background with content
 */
export function PageWrapper({ children, bg, minH = 'calc(100vh - 64px)', ...props }) {
  return (
    <Box minH={minH} bg={bg} w="full" {...props}>
      {children}
    </Box>
  );
}

/**
 * SectionHeader - Heading with optional subtitle
 */
export function SectionHeader({ 
  title, 
  subtitle, 
  align = 'left', 
  size = 'lg',
  titleColor = 'gray.800',
  subtitleColor = 'gray.500',
  spacing = 2,
  ...props 
}) {
  return (
    <VStack 
      spacing={spacing} 
      align={align === 'center' ? 'center' : 'flex-start'}
      textAlign={align}
      w="full"
      {...props}
    >
      <Heading 
        size={size} 
        color={titleColor}
        letterSpacing="-0.02em"
      >
        {title}
      </Heading>
      {subtitle && (
        <Text color={subtitleColor} fontSize="md">
          {subtitle}
        </Text>
      )}
    </VStack>
  );
}

// =============================================================================
// CARD PRIMITIVES
// =============================================================================

/**
 * GlassCard - Modern card with subtle glass effect
 */
export function GlassCard({ 
  children, 
  padding = 8,
  hover = true,
  ...props 
}) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      boxShadow="card"
      p={padding}
      transition="all 0.3s ease"
      _hover={hover ? {
        boxShadow: 'cardHover',
        transform: 'translateY(-4px)',
      } : {}}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * ContentCard - Card for content sections with optional header
 */
export function ContentCard({ 
  children, 
  title, 
  subtitle, 
  headerAction,
  padding = { base: 6, md: 8 },
  ...props 
}) {
  return (
    <Box
      bg="white"
      borderRadius="2xl"
      boxShadow="lg"
      overflow="hidden"
      {...props}
    >
      {(title || headerAction) && (
        <HStack 
          justify="space-between" 
          align="center" 
          px={padding} 
          pt={padding}
          pb={4}
        >
          <VStack align="flex-start" spacing={1}>
            {title && (
              <Heading size="md" color="gray.800">{title}</Heading>
            )}
            {subtitle && (
              <Text fontSize="sm" color="gray.500">{subtitle}</Text>
            )}
          </VStack>
          {headerAction}
        </HStack>
      )}
      <Box px={padding} pb={padding} pt={title ? 0 : padding}>
        {children}
      </Box>
    </Box>
  );
}

// =============================================================================
// BUTTON PRIMITIVES
// =============================================================================

/**
 * PrimaryButton - Main CTA button with gradient
 */
export function PrimaryButton({ children, size = 'lg', ...props }) {
  return (
    <Button
      bgGradient={gradients.primaryButton}
      color="white"
      size={size}
      fontWeight="semibold"
      borderRadius="xl"
      boxShadow="md"
      transition="all 0.2s ease"
      _hover={{
        bgGradient: gradients.primaryButtonHover,
        transform: 'translateY(-2px)',
        boxShadow: 'lg',
        _disabled: {
          bgGradient: gradients.primaryButton,
          transform: 'none',
          boxShadow: 'md',
        },
      }}
      _active={{
        transform: 'translateY(0)',
        boxShadow: 'sm',
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * SecondaryButton - Outline button for secondary actions
 */
export function SecondaryButton({ children, size = 'lg', ...props }) {
  return (
    <Button
      bg="white"
      color="blue.600"
      size={size}
      fontWeight="semibold"
      borderRadius="xl"
      border="2px solid"
      borderColor="blue.500"
      transition="all 0.2s ease"
      _hover={{
        bg: 'blue.50',
        borderColor: 'blue.600',
        transform: 'translateY(-1px)',
      }}
      _active={{
        bg: 'blue.100',
        transform: 'translateY(0)',
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * GhostButton - Subtle button for tertiary actions
 */
export function GhostButton({ children, size = 'md', ...props }) {
  return (
    <Button
      variant="ghost"
      color="gray.600"
      size={size}
      fontWeight="medium"
      borderRadius="lg"
      transition="all 0.2s ease"
      _hover={{
        bg: 'gray.100',
        color: 'gray.800',
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * GlassButton - For use on dark/gradient backgrounds
 */
export function GlassButton({ children, size = 'md', ...props }) {
  return (
    <Button
      bg="whiteAlpha.200"
      color="white"
      size={size}
      fontWeight="semibold"
      borderRadius="full"
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor="whiteAlpha.300"
      boxShadow="sm"
      transition="all 0.2s ease"
      _hover={{
        bg: 'whiteAlpha.300',
        boxShadow: 'md',
      }}
      _active={{
        bg: 'whiteAlpha.400',
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

// =============================================================================
// FORM PRIMITIVES
// =============================================================================

/**
 * FormInput - Standardized input with label and optional error/helper
 */
export function FormInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  leftIcon,
  rightIcon,
  onRightIconClick,
  error,
  helperText,
  isRequired = false,
  isDisabled = false,
  size = 'lg',
  ...props
}) {
  return (
    <FormControl isRequired={isRequired} isInvalid={!!error} isDisabled={isDisabled}>
      {label && (
        <FormLabel color="gray.700" fontWeight="medium" mb={2}>
          {label}
        </FormLabel>
      )}
      <InputGroup size={size}>
        {leftIcon && (
          <InputLeftElement pointerEvents="none">
            {leftIcon}
          </InputLeftElement>
        )}
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          bg="gray.50"
          border="2px solid"
          borderColor={error ? 'red.300' : 'gray.200'}
          borderRadius="xl"
          color="gray.800"
          _placeholder={{ color: 'gray.400' }}
          _hover={{ 
            borderColor: error ? 'red.400' : 'blue.300',
          }}
          _focus={{
            borderColor: error ? 'red.500' : 'blue.500',
            boxShadow: error ? '0 0 0 1px #E53E3E' : '0 0 0 1px #3182ce',
            bg: 'white',
          }}
          {...props}
        />
        {rightIcon && (
          <InputRightElement>
            {onRightIconClick ? (
              <IconButton
                variant="ghost"
                size="sm"
                onClick={onRightIconClick}
                icon={rightIcon}
                aria-label="Input action"
              />
            ) : (
              rightIcon
            )}
          </InputRightElement>
        )}
      </InputGroup>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
      {helperText && !error && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

/**
 * EmptyState - Shown when no content is available
 */
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  ...props 
}) {
  return (
    <VStack 
      spacing={4} 
      py={16} 
      px={8}
      textAlign="center"
      {...props}
    >
      {icon && (
        <Box color="gray.300" fontSize="5xl">
          {icon}
        </Box>
      )}
      <VStack spacing={2}>
        <Heading size="md" color="gray.600">
          {title}
        </Heading>
        {description && (
          <Text color="gray.500" maxW="md">
            {description}
          </Text>
        )}
      </VStack>
      {action}
    </VStack>
  );
}

// =============================================================================
// STAT DISPLAY
// =============================================================================

/**
 * StatCard - Display a metric with label
 */
export function StatCard({ 
  label, 
  value, 
  helpText,
  colorScheme = 'blue',
  ...props 
}) {
  return (
    <Box
      bg={`${colorScheme}.50`}
      borderRadius="xl"
      p={4}
      {...props}
    >
      <Text fontSize="sm" color={`${colorScheme}.600`} fontWeight="medium">
        {label}
      </Text>
      <Text fontSize="2xl" fontWeight="bold" color={`${colorScheme}.700`}>
        {value}
      </Text>
      {helpText && (
        <Text fontSize="xs" color={`${colorScheme}.500`}>
          {helpText}
        </Text>
      )}
    </Box>
  );
}

// =============================================================================
// DIVIDER WITH TEXT
// =============================================================================

/**
 * DividerWithText - Divider with centered text
 */
export function DividerWithText({ children, ...props }) {
  return (
    <HStack w="full" {...props}>
      <Box flex={1} h="1px" bg="gray.200" />
      <Text px={4} color="gray.500" fontSize="sm" fontWeight="medium">
        {children}
      </Text>
      <Box flex={1} h="1px" bg="gray.200" />
    </HStack>
  );
}
