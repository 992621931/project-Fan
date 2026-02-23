import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // Changed from 'node' to 'jsdom' for localStorage support
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/systems': path.resolve(__dirname, 'src/systems'),
      '@/entities': path.resolve(__dirname, 'src/entities'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/config': path.resolve(__dirname, 'src/config')
    }
  }
});