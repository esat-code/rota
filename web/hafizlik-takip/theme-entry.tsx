import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Timer, PencilLine, House, CalendarDays, GraduationCap } from "lucide-react"

function AppThemeToggle() {
  const plan = document.getElementById("hafizlik-tik-denemesi")!
  const [isDark, setIsDark] = useState(plan.classList.contains("night-mode"))
  useEffect(() => {
    const sync = () => setIsDark(plan.classList.contains("night-mode"))
    document.addEventListener("hafizlik:theme", sync)
    return () => document.removeEventListener("hafizlik:theme", sync)
  }, [plan])
  return <ThemeToggle isDark={isDark} onThemeChange={dark => {
    setIsDark(dark)
    document.dispatchEvent(new CustomEvent("hafizlik:set-theme", { detail: dark }))
  }} />
}
createRoot(document.getElementById("theme-toggle-mount")!).render(<AppThemeToggle />)

const icons = { timer: Timer, edit: PencilLine, home: House, calendar: CalendarDays, graduation: GraduationCap }
document.querySelectorAll<HTMLElement>("[data-toolbar-icon]").forEach(element => {
  const Icon = icons[element.dataset.toolbarIcon as keyof typeof icons]
  if (Icon) createRoot(element).render(<Icon size={16} strokeWidth={1.7} aria-hidden="true" />)
})
