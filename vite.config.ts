import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Expose FIREBASE_-prefixed env vars (e.g. FIREBASE_API_KEY) to the client
  // bundle, since Vercel rejects variable names with the VITE_ prefix.
  envPrefix: ['VITE_', 'FIREBASE_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
});
