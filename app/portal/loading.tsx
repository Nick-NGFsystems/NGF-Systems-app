export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-56 rounded-xl bg-gray-200" />
    </div>
  )
}
