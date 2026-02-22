import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { StarknetProvider } from '@/components/starknet-provider'
import { Toaster } from '@/components/ui/toaster'
import { RealtimeToastListener } from '@/components/realtime-toast-listener'
import './globals.css'

const _figtree = localFont({
  src: [
    {
      path: '../public/fonts/Figtree-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../public/fonts/Figtree-Black.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  title: 'Hush - Privacy-First Payments on Starknet',
  description: 'Send encrypted, private payments with zero-knowledge proofs on Starknet. Your transactions, your privacy.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${_figtree.variable}`}>
      <body className="font-sans antialiased">
        <StarknetProvider>
          {children}
          <RealtimeToastListener />
          <Toaster />
          <Analytics />
        </StarknetProvider>
      </body>
    </html>
  )
}
