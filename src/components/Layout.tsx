import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'

export default function Layout() {
  const { isAuthenticated, logout, user } = useAuth()
  const location = useLocation()

  // Navigation Guard
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans transition-opacity duration-300">
      {isAuthenticated && (
        <header className="bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold tracking-tighter">
                Z
              </div>
              <span className="font-semibold text-lg text-slate-900 tracking-tight">
                Zalike Sistemas
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>{user?.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-fade-in-up">
        <Outlet />
      </main>
    </div>
  )
}
