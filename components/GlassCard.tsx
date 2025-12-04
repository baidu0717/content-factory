'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps {
    children: ReactNode
    className?: string
    hoverEffect?: boolean
    delay?: number
}

export default function GlassCard({ children, className, hoverEffect = true, delay = 0 }: GlassCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={hoverEffect ? { scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" } : {}}
            className={cn(
                "backdrop-blur-xl bg-white/60 border border-white/60 shadow-lg rounded-2xl overflow-hidden",
                className
            )}
        >
            {children}
        </motion.div>
    )
}
