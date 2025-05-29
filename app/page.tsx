import RevenueDashboard from "@/components/revenue-dashboard"

export default function Home() {
  return (
    <main className="min-h-screen h-screen bg-gray-50 flex flex-col">
      <div className="container py-6 flex-grow flex flex-col">
        <RevenueDashboard />
      </div>
    </main>
  )
}
