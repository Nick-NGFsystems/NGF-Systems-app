import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <span className="text-xl font-bold text-blue-400">NGFsystems</span>
            <p className="mt-2 text-sm text-gray-400">
              Building amazing websites for your business
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-base font-semibold text-white">Quick Links</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/sign-in" className="text-sm hover:text-blue-400 transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="text-sm hover:text-blue-400 transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-400 md:text-right">
            <p>&copy; 2026 NGFsystems. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
