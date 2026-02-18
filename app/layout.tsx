import '@/lib/fetchWithTimeout'
import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/ui/header'
import { Footer } from '@/components/ui/footer'
import { Toaster } from '@/components/ui/toaster'
import ClientOnly from '@/components/ClientOnly'
import { CartProvider } from '@/hooks/use-cart'
import DisableContextMenu from '@/components/disable-context-menu'
import PlausibleProvider from '@/components/PlausibleProvider'
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
      <head>
        <script async src="https://plausible.io/js/pa-PXp8nvST9Ykfh37ddX2qc.js"></script>
        <script dangerouslySetInnerHTML={{ __html: "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()" }} />
      </head>
      <body>
        <PlausibleProvider />
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
