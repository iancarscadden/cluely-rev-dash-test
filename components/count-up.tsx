"use client"

import { useState, useEffect, useRef } from "react"
import { formatCurrency } from "@/lib/utils"

interface CountUpProps {
  value: number
  prevValue: number
  className?: string
  duration?: number
}

export function CountUp({ value, prevValue, className = "", duration = 1500 }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(prevValue)
  const startTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip animation on initial render if values are the same
    if (value === prevValue) {
      console.log("CountUp: Values are the same, skipping animation")
      setDisplayValue(value)
      return
    }

    if (value !== prevValue) {
      console.log(`CountUp: Animating from ${prevValue} to ${value}`)
    }

    // Animate the count up
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth acceleration and deceleration
      // This is a cubic bezier easing function that starts slow, accelerates, then decelerates
      const easeInOutCubic = (x: number): number => {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      }

      const easedProgress = easeInOutCubic(progress)

      const currentValue = prevValue + (value - prevValue) * easedProgress
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        console.log(`CountUp: Animation completed at ${value}`)
        // Ensure we end exactly at the target value
        setDisplayValue(value)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [value, prevValue, duration])

  return <span className={className}>{formatCurrency(displayValue)}</span>
}
