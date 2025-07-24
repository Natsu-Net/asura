import { Options } from "$fresh/plugins/twind.ts";

export default {
  selfURL: import.meta.url,
  darkMode: 'class', // Enable class-based dark mode for better control
  theme: {
    extend: {
      // Add custom colors
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        // Dark theme colors
        dark: {
          bg: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
        }
      },
      // Modern spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // Modern typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Modern animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  // Enable all Tailwind CSS features
  plugins: {
    // Custom utilities
    '.text-gradient': {
      'background': 'linear-gradient(to right, #3b82f6, #8b5cf6)',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
    },
    '.glass': {
      'backdrop-filter': 'blur(10px)',
      'background': 'rgba(255, 255, 255, 0.1)',
      'border': '1px solid rgba(255, 255, 255, 0.2)',
    },
  },
} as Options;
