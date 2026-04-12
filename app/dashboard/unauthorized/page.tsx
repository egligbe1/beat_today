import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-3xl font-bold mb-4">Producers Only</h1>
      <p className="text-text-muted mb-8 text-center max-w-md">
        This area is reserved for beat producers. If you want to sell your beats, 
        make sure you signed up as a producer.
      </p>
      <Link href="/" className="btn-primary">
        Back to Marketplace
      </Link>
    </div>
  )
}
