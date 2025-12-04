'use client'

import { motion } from 'framer-motion'

export default function Hero3D() {
    return (
        <div className="relative h-[400px] w-full flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial from-blue-100/50 to-transparent opacity-50 blur-3xl" />

            <div className="relative w-full max-w-lg h-full flex items-center justify-center perspective-1000">
                <motion.div
                    className="relative w-48 h-48 md:w-64 md:h-64"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: [0, 360] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                >
                    {/* Central Cube Core */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-100/80 backdrop-blur-md rounded-3xl border border-white shadow-2xl transform translate-z-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse" />
                    </div>

                    {/* Floating Elements */}
                    <motion.div
                        className="absolute -top-12 -left-12 w-24 h-24 bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/80 flex items-center justify-center"
                        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        style={{ transform: "translateZ(60px)" }}
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                        </div>
                    </motion.div>

                    <motion.div
                        className="absolute top-1/3 -right-20 w-32 h-40 bg-white/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/80 flex flex-col items-center justify-center p-4"
                        animate={{ y: [0, 30, 0], rotate: [0, -5, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        style={{ transform: "translateZ(40px)" }}
                    >
                        <div className="w-full h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
                            <div className="h-full w-2/3 bg-green-500" />
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
                            <div className="h-full w-1/2 bg-blue-500" />
                        </div>
                        <span className="text-xs text-gray-500 mt-2">Data Analysis</span>
                    </motion.div>

                    <motion.div
                        className="absolute -bottom-10 left-8 w-48 h-16 bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-white/80 flex items-center justify-center space-x-3"
                        animate={{ y: [0, -15, 0] }}
                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        style={{ transform: "translateZ(80px)" }}
                    >
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm font-bold text-gray-600 ml-2">System OK</span>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
