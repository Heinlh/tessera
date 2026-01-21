import { extendTheme } from '@chakra-ui/react';

// =============================================================================
// TESSERA DESIGN TOKENS
// Extracted from existing codebase - NO color changes, only formalization
// =============================================================================

const colors = {
  // Primary brand colors (existing blue palette)
  brand: {
    50: '#e6f2ff',
    100: '#b3d9ff',
    200: '#80bfff',
    300: '#4da6ff',
    400: '#1a8cff',
    500: '#3182ce', // Primary blue (existing)
    600: '#2b6cb0',
    700: '#2c5282', // Dark blue (existing in gradients)
    800: '#1a365d',
    900: '#0d1b2e',
  },
  // Accent colors for special UI elements
  accent: {
    purple: '#667eea', // Used in auth gradients
    violet: '#764ba2', // Used in profile gradient
  },
};

// Gradients - preserving existing gradients
const gradients = {
  navBar: 'linear-gradient(135deg, #3182ce 0%, #2c5282 100%)',
  primaryButton: 'linear-gradient(135deg, #3182ce 0%, #2c5282 100%)',
  primaryButtonHover: 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
  authBackground: 'linear-gradient(135deg, #667eea 0%, #000000 100%)',
  profileBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  eventsBackground: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
  cardPlaceholder: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

// Typography
const fonts = {
  heading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
};

const fontSizes = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  md: '1rem',       // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem',// 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem',    // 48px
};

// Spacing (8px base system)
const space = {
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
};

// Border Radius (standardized)
const radii = {
  none: '0',
  sm: '0.25rem',    // 4px
  base: '0.375rem', // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
};

// Shadows (refined for modern look)
const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  card: '0 4px 20px rgba(0, 0, 0, 0.08)',
  cardHover: '0 12px 40px rgba(0, 0, 0, 0.12)',
  nav: '0 4px 12px rgba(0, 0, 0, 0.15)',
  glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
};

// Transitions
const transition = {
  property: {
    common: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
    colors: 'background-color, border-color, color, fill, stroke',
    dimensions: 'width, height',
    position: 'left, right, top, bottom',
    background: 'background-color, background-image, background-position',
  },
  easing: {
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  duration: {
    'ultra-fast': '50ms',
    faster: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    'ultra-slow': '500ms',
  },
};

// =============================================================================
// COMPONENT STYLE OVERRIDES
// =============================================================================

const components = {
  // Button variants
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'xl',
      transition: 'all 0.2s ease',
      _focus: {
        boxShadow: '0 0 0 3px rgba(49, 130, 206, 0.4)',
      },
    },
    variants: {
      // Primary gradient button (matches existing)
      primary: {
        bgGradient: gradients.primaryButton,
        color: 'white',
        _hover: {
          bgGradient: gradients.primaryButtonHover,
          transform: 'translateY(-2px)',
          boxShadow: 'lg',
          _disabled: {
            bgGradient: gradients.primaryButton,
            transform: 'none',
          },
        },
        _active: {
          transform: 'translateY(0)',
          boxShadow: 'sm',
        },
      },
      // Secondary outline button
      secondary: {
        bg: 'white',
        color: 'brand.600',
        border: '2px solid',
        borderColor: 'brand.500',
        _hover: {
          bg: 'brand.50',
          borderColor: 'brand.600',
          transform: 'translateY(-1px)',
        },
        _active: {
          bg: 'brand.100',
          transform: 'translateY(0)',
        },
      },
      // Ghost button
      ghost: {
        color: 'gray.600',
        _hover: {
          bg: 'gray.100',
          color: 'gray.800',
        },
      },
      // Glass button (for dark backgrounds)
      glass: {
        bg: 'whiteAlpha.200',
        color: 'white',
        backdropFilter: 'blur(10px)',
        border: '1px solid',
        borderColor: 'whiteAlpha.300',
        _hover: {
          bg: 'whiteAlpha.300',
        },
        _active: {
          bg: 'whiteAlpha.400',
        },
      },
    },
    sizes: {
      lg: {
        h: '12',
        minW: '12',
        fontSize: 'md',
        px: '6',
      },
      md: {
        h: '10',
        minW: '10',
        fontSize: 'sm',
        px: '4',
      },
      sm: {
        h: '8',
        minW: '8',
        fontSize: 'xs',
        px: '3',
      },
    },
    defaultProps: {
      size: 'md',
    },
  },

  // Input styling
  Input: {
    variants: {
      filled: {
        field: {
          bg: 'gray.50',
          border: '2px solid',
          borderColor: 'gray.200',
          borderRadius: 'xl',
          _placeholder: { color: 'gray.400' },
          _hover: {
            borderColor: 'gray.300',
            bg: 'gray.50',
          },
          _focus: {
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px #3182ce',
            bg: 'white',
          },
        },
      },
    },
    defaultProps: {
      variant: 'filled',
      size: 'lg',
    },
  },

  // Card styling
  Card: {
    baseStyle: {
      container: {
        bg: 'white',
        borderRadius: '2xl',
        boxShadow: 'card',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        _hover: {
          boxShadow: 'cardHover',
          transform: 'translateY(-4px)',
        },
      },
    },
  },

  // Modal styling
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: '2xl',
        boxShadow: '2xl',
      },
      header: {
        fontWeight: 'bold',
        fontSize: 'xl',
      },
    },
  },

  // Menu styling
  Menu: {
    baseStyle: {
      list: {
        bg: 'white',
        borderColor: 'gray.200',
        boxShadow: 'xl',
        borderRadius: 'xl',
        py: '2',
      },
      item: {
        fontWeight: 'medium',
        borderRadius: 'md',
        mx: '2',
        _hover: {
          bg: 'blue.50',
          color: 'blue.600',
        },
      },
    },
  },

  // Badge styling
  Badge: {
    baseStyle: {
      borderRadius: 'full',
      px: '2',
      py: '1',
      fontWeight: 'bold',
      fontSize: 'xs',
      textTransform: 'uppercase',
    },
  },

  // Alert styling
  Alert: {
    baseStyle: {
      container: {
        borderRadius: 'lg',
      },
    },
  },

  // Heading styling
  Heading: {
    baseStyle: {
      fontWeight: 'bold',
      letterSpacing: '-0.02em',
    },
  },

  // Container styling
  Container: {
    baseStyle: {
      maxW: 'container.xl',
      px: { base: '4', md: '6', lg: '8' },
    },
  },
};

// =============================================================================
// GLOBAL STYLES
// =============================================================================

const styles = {
  global: {
    body: {
      bg: 'gray.50',
      color: 'gray.800',
      lineHeight: 'tall',
    },
    '*::placeholder': {
      color: 'gray.400',
    },
    '*, *::before, *::after': {
      borderColor: 'gray.200',
    },
    // Smooth scrolling
    html: {
      scrollBehavior: 'smooth',
    },
    // Focus visible for accessibility
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'brand.500',
      outlineOffset: '2px',
    },
  },
};

// =============================================================================
// EXPORT THEME
// =============================================================================

const theme = extendTheme({
  colors,
  fonts,
  fontSizes,
  space,
  radii,
  shadows,
  transition,
  components,
  styles,
  // Semantic tokens for light/dark mode compatibility (future-proofing)
  semanticTokens: {
    colors: {
      'chakra-body-text': { _light: 'gray.800' },
      'chakra-body-bg': { _light: 'gray.50' },
      'chakra-border-color': { _light: 'gray.200' },
      'chakra-placeholder-color': { _light: 'gray.400' },
    },
  },
  // Custom config
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
});

// Export gradients separately for use in components
export { gradients };
export default theme;
