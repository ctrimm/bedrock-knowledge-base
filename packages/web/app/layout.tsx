import { ReactNode } from 'react'
import { Providers } from './providers'

export const metadata = {
  title: 'Bedrock Knowledge Base',
  description: 'A knowledge base application powered by AWS Bedrock',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}