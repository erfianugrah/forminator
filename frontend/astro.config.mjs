// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// Frontend builds static files only - Worker handles serving and API routes
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  },

  output: 'static',

  build: {
    format: 'directory' // Creates index.html in directories for clean URLs
  }
});