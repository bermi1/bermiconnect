// Demo build: one self-contained HTML file with an in-browser stand-in API (sample data).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-demo', emptyOutDir: true },
});
