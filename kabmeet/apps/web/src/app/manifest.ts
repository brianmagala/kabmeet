import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kabmeet — Kabale University Live Sessions',
    short_name: 'Kabmeet',
    description:
      'Live sessions, private virtual classes, and shared developer workspaces for Kabale University (ai.kab.ac.ug/indabax).',
    start_url: '/',
    display: 'standalone',
    background_color: '#065A4B',
    theme_color: '#065A4B',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
