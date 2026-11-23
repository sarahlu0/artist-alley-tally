import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The app makes no network requests; the CSP makes the browser enforce that.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Build only: the dev server injects inline scripts for hot reload. */
const contentSecurityPolicy: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend',
    },
  ],
};

// Relative base so the build works from any subpath, such as GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    contentSecurityPolicy,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Precache only the Latin subsets (which include the currency symbols). Other
        // scripts load on demand and fall back to a system font when offline.
        globIgnores: [
          '**/noto-sans-{cyrillic,cyrillic-ext,greek,greek-ext,devanagari,vietnamese}-*',
        ],
      },
      manifest: {
        name: 'Artist Alley Tally',
        short_name: 'Tally',
        description: 'Log sales at your artist alley table and see what sold.',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#fafafa',
        theme_color: '#23408e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
