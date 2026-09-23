import { createFileRoute } from '@tanstack/react-router'
import { JoinForm } from '@/features/home/join-form'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <JoinForm />
    </main>
  )
}
