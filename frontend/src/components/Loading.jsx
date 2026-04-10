import React from 'react'
import { useThemeSettings } from '../theme/ThemeProvider'

const Loading = ({height = "100vh"}) => {
  const { theme } = useThemeSettings()
  const isLight = theme === "light"
  const isDark = theme === "dark"
  
  return (
    <div style={{height}} className={`flex items-center justify-center h-screen ${isLight ? "bg-slate-50" : isDark ? "bg-black" : ""}`}>
        <div className={`w-10 h-10 rounded-full border-3 border-t-transparent animate-spin ${isLight ? "border-cyan-500" : isDark ? "border-white" : "border-purple-500"}`}></div>
    </div>
  )
}

export default Loading
