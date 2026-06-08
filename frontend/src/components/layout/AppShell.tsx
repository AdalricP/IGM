import type { ReactNode } from 'react'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-bone scanlines grain">
      <TopBar />
      <main className="px-5 py-5">{children}</main>
      <footer className="px-5 pb-6 pt-2 flex items-center justify-between text-[10px] font-mono text-bone-ghost tracking-wider">
        <span>local · http://localhost:5173 → http://localhost:8765</span>
        <span className="flex items-center gap-3">
          <span>↵ confirm</span>
          <span>esc cancel</span>
          <span>r refresh</span>
        </span>
      </footer>
    </div>
  )
}
