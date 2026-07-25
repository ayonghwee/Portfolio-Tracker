import './globals.css'

export const metadata = {
  title: 'Portfolio Tracker',
  description: 'Personal Investment Tracker',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
