import '@/lib/fetchWithTimeout'
import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/ui/header'
import { Footer } from '@/components/ui/footer'
import { Toaster } from '@/components/ui/toaster'
import ClientOnly from '@/components/ClientOnly'
import { CartProvider } from '@/hooks/use-cart'
import DisableContextMenu from '@/components/disable-context-menu'
import {
  ClerkProvider,
} from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'aiskool',
  description: 'Aiskool - Learn Anything, Anywhere',
  generator: 'aiskool',
  icons: {
    icon: '/favicon.svg'
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientOnly>
          <DisableContextMenu />
          <CartProvider>
            <Header />
            {children}
            <Footer />
            <Toaster />
          </CartProvider>
        </ClientOnly>
      </body>
    </html>
    </ClerkProvider>
  )
}
