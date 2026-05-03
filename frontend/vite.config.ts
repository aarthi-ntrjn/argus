import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.VITE_COVERAGE
      ? [
          istanbul({
            include: 'src/**',
            exclude: ['node_modules', 'tests/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts'],
            extension: ['.ts', '.tsx'],
            requireEnv: false,
            forceBuildInstrument: true,
          }),
        ]
      : []),
  ],
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:7411',
      '/ws': { target: 'ws://localhost:7411', ws: true },
      '/hooks': 'http://localhost:7411',
    },
  },
  build: {
    outDir: process.env.VITE_COVERAGE ? 'dist-coverage' : 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('react-joyride') || id.includes('react-floater')) return 'vendor-tour';
        },
      },
    },
  },
});
