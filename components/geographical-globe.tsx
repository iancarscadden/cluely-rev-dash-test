"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Globe from "react-globe.gl"

interface GlobeDataPoint {
  country: string
  revenue: number
  transactionCount: number
  coordinates: [number, number]
  intensity: number
  size: number
  color: string
}

interface GeographicalGlobeProps {
  data?: GlobeDataPoint[]
  className?: string
  todaysRevenue?: number
}

// Enhanced mock data with more variety
const MOCK_DATA: GlobeDataPoint[] = [
  {
    country: "US",
    revenue: 150000,
    transactionCount: 45,
    coordinates: [39.8283, -98.5795],
    intensity: 1.0,
    size: 1.2,
    color: "#ff0040"
  },
  {
    country: "GB",
    revenue: 45000,
    transactionCount: 12,
    coordinates: [55.3781, -3.4360],
    intensity: 0.3,
    size: 0.8,
    color: "#ff4444"
  },
  {
    country: "DE",
    revenue: 32000,
    transactionCount: 8,
    coordinates: [51.1657, 10.4515],
    intensity: 0.21,
    size: 0.6,
    color: "#ff8844"
  },
  {
    country: "CA",
    revenue: 28000,
    transactionCount: 6,
    coordinates: [56.1304, -106.3468],
    intensity: 0.19,
    size: 0.5,
    color: "#ffcc44"
  },
  {
    country: "AU",
    revenue: 18000,
    transactionCount: 4,
    coordinates: [-25.2744, 133.7751],
    intensity: 0.12,
    size: 0.4,
    color: "#44ff88"
  }
]

export default function GeographicalGlobe({ data = MOCK_DATA, className = "", todaysRevenue = 0 }: GeographicalGlobeProps) {
  const globeRef = useRef<any>(null)
  const [globeReady, setGlobeReady] = useState(false)
  const [time, setTime] = useState(0)

  // Debug: Log the incoming data
  useEffect(() => {
    console.log("GeographicalGlobe: Received data:", data)
    console.log("GeographicalGlobe: Data length:", data?.length || 0)
    console.log("GeographicalGlobe: Today's revenue:", todaysRevenue)
  }, [data, todaysRevenue])

  // Animation timer for pulsing effects
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now() * 0.001)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  // Transform data to Globe.gl format with validation and enhanced effects
  const globeData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      console.warn("GeographicalGlobe: No valid data provided, using mock data")
      return MOCK_DATA.map(point => ({
        lat: point.coordinates[0],
        lng: point.coordinates[1],
        country: point.country,
        revenue: point.revenue,
        transactionCount: point.transactionCount,
        color: point.color,
        size: point.size,
        intensity: point.intensity
      }))
    }

    const transformedData = data.map((point, index) => {
      // Validate required fields
      if (!point.coordinates || point.coordinates.length !== 2) {
        console.warn(`GeographicalGlobe: Invalid coordinates for point ${index}:`, point)
        return null
      }

      // Enhanced color calculation based on intensity with better distribution
      const getEnhancedColor = (intensity: number) => {
        if (intensity > 0.8) return '#ff0040'      // Bright red for highest (80-100%)
        if (intensity > 0.6) return '#ff4444'      // Red for high (60-80%)
        if (intensity > 0.4) return '#ff6644'      // Orange-red for medium-high (40-60%)
        if (intensity > 0.2) return '#ffaa44'      // Orange-yellow for medium (20-40%)
        if (intensity > 0.1) return '#ffdd44'      // Yellow for low-medium (10-20%)
        return '#44ff88'                           // Green for lowest (0-10%)
      }

      return {
        lat: point.coordinates[0],
        lng: point.coordinates[1],
        country: point.country || `unknown-${index}`,
        revenue: point.revenue || 0,
        transactionCount: point.transactionCount || 0,
        color: getEnhancedColor(point.intensity || 0),
        size: Math.max(0.3, (point.intensity || 0.1) * 2.0), // Larger, more dynamic sizes
        intensity: point.intensity || 0
      }
    }).filter((point): point is NonNullable<typeof point> => point !== null)

    console.log("GeographicalGlobe: Transformed data:", transformedData.length, "valid points")
    return transformedData
  }, [data])

  // Create arcs between locations at different revenue levels for extra coolness
  const arcsData = useMemo(() => {
    const allArcs = []

    // San Francisco hub coordinates
    const sanFrancisco = { lat: 37.7749, lng: -122.4194 }

    // High-revenue arcs (red zones) - keep existing behavior
    const highRevenuePoints = globeData
      .filter(point => point.intensity > 0.6)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4) // Top 4 high revenue locations

    for (let i = 0; i < highRevenuePoints.length; i++) {
      for (let j = i + 1; j < highRevenuePoints.length; j++) {
        allArcs.push({
          startLat: highRevenuePoints[i].lat,
          startLng: highRevenuePoints[i].lng,
          endLat: highRevenuePoints[j].lat,
          endLng: highRevenuePoints[j].lng,
          color: '#ff0040',
          intensity: (highRevenuePoints[i].intensity + highRevenuePoints[j].intensity) / 2,
          type: 'high'
        })
      }
    }

    // San Francisco to Green Areas (Hub-and-spoke pattern)
    const greenAreas = globeData
      .filter(point => point.intensity > 0.05 && point.intensity <= 0.3)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8) // Connect to top 8 green areas

    greenAreas.forEach(point => {
      allArcs.push({
        startLat: sanFrancisco.lat,
        startLng: sanFrancisco.lng,
        endLat: point.lat,
        endLng: point.lng,
        color: '#44ff88', // Green lines from SF
        intensity: point.intensity,
        type: 'sf-green'
      })
    })

    // San Francisco to Yellow/Orange Areas
    const yellowAreas = globeData
      .filter(point => point.intensity > 0.3 && point.intensity <= 0.6)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6) // Connect to top 6 yellow areas

    yellowAreas.forEach(point => {
      allArcs.push({
        startLat: sanFrancisco.lat,
        startLng: sanFrancisco.lng,
        endLat: point.lat,
        endLng: point.lng,
        color: '#ffaa44', // Yellow/orange lines from SF
        intensity: point.intensity,
        type: 'sf-yellow'
      })
    })

    // Medium-revenue arcs (yellow/orange zones) - reduce to avoid clutter
    const mediumRevenuePoints = globeData
      .filter(point => point.intensity > 0.4 && point.intensity <= 0.6)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3) // Reduced from 5 to 3

    for (let i = 0; i < mediumRevenuePoints.length; i++) {
      for (let j = i + 1; j < Math.min(mediumRevenuePoints.length, i + 2); j++) { // Connect to 1 nearest
        allArcs.push({
          startLat: mediumRevenuePoints[i].lat,
          startLng: mediumRevenuePoints[i].lng,
          endLat: mediumRevenuePoints[j].lat,
          endLng: mediumRevenuePoints[j].lng,
          color: '#ffaa44',
          intensity: (mediumRevenuePoints[i].intensity + mediumRevenuePoints[j].intensity) / 2,
          type: 'medium'
        })
      }
    }

    return allArcs.slice(0, 20) // Increased limit to accommodate SF hub arcs
  }, [globeData])

  // Create rings for highest revenue locations
  const ringsData = useMemo(() => {
    const highRevenueRings = globeData
      .filter(point => point.intensity > 0.6)
      .map(point => ({
        lat: point.lat,
        lng: point.lng,
        maxR: 1.5 + point.intensity * 2, // Reduced from 3 + point.intensity * 5 to be much smaller
        propagationSpeed: 2,
        repeatPeriod: 1000 + point.intensity * 2000, // Varied timing
        color: point.color
      }))

    // Add subtle rings for medium revenue areas (green/yellow)
    const mediumRevenueRings = globeData
      .filter(point => point.intensity > 0.2 && point.intensity <= 0.6)
      .map(point => ({
        lat: point.lat,
        lng: point.lng,
        maxR: 0.8 + point.intensity * 1.2, // Much smaller rings for medium areas
        propagationSpeed: 1,
        repeatPeriod: 3000 + point.intensity * 3000, // Slower, more subtle timing
        color: point.color
      }))

    // Add very subtle sparkle rings for low revenue areas (green)
    const lowRevenueRings = globeData
      .filter(point => point.intensity <= 0.2)
      .map(point => ({
        lat: point.lat,
        lng: point.lng,
        maxR: 0.4 + point.intensity * 0.6, // Very small rings
        propagationSpeed: 0.5,
        repeatPeriod: 5000 + Math.random() * 3000, // Very slow, random timing for sparkle effect
        color: point.color
      }))

    return [...highRevenueRings, ...mediumRevenueRings, ...lowRevenueRings]
  }, [globeData])

  // Calculate glow intensity based on today's revenue
  const calculateGlowIntensity = (revenue: number): number => {
    return Math.min(revenue / 10000, 1)
  }

  // Get glow properties
  const glowIntensity = calculateGlowIntensity(todaysRevenue)
  const shouldFlash = todaysRevenue >= 10000
  const glowOpacity = 0.6 + (glowIntensity * 1.2)
  const glowSize = 900 + (glowIntensity * 600)

  useEffect(() => {
    if (globeRef.current) {
      // Set camera closer to globe to make it appear bigger
      globeRef.current.pointOfView({ altitude: 1.9, lat: 30, lng: -10 })
      
      // Enable auto-rotation with slower, more subtle speed
      globeRef.current.controls().autoRotate = true
      globeRef.current.controls().autoRotateSpeed = 0.08 + (glowIntensity * 0.12)
      
      setGlobeReady(true)
    }
  }, [glowIntensity])

  const handlePointClick = (point: any) => {
    console.log(`Clicked on ${point.country}: $${point.revenue.toLocaleString()}`)
    
    // Add a cool camera animation when clicking a point
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: point.lat, lng: point.lng, altitude: 1.5 },
        2000 // 2 second animation
      )
    }
  }

  const getPointLabel = (point: any) => {
    const [country, ...rest] = point.country.split('-')
    const isDemo = country === 'demo'
    const actualCountry = isDemo ? rest[0] : country
    
    return `
      <div style="
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 40, 0.95)); 
        color: white; 
        padding: 16px 20px; 
        border-radius: 12px; 
        font-size: 14px;
        font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif;
        border: 2px solid ${point.color};
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px ${point.color}40;
        min-width: 220px;
        backdrop-filter: blur(10px);
      ">
        <div style="margin-bottom: 12px;">
          <strong style="color: ${point.color}; font-size: 18px; text-shadow: 0 0 10px ${point.color};">
            ${actualCountry.toUpperCase()}
          </strong>
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">💰</span>
          <span>Revenue: <span style="color: #34D399; font-weight: bold; text-shadow: 0 0 5px #34D399;">$${point.revenue.toLocaleString()}</span></span>
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">📊</span>
          <span>Transactions: <span style="color: #FBBF24; font-weight: bold;">${point.transactionCount || 0}</span></span>
        </div>
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🔥</span>
          <span>Intensity: <span style="color: ${point.color}; font-weight: bold;">${((point.intensity || 0) * 100).toFixed(1)}%</span></span>
        </div>
        <div style="color: #A78BFA; font-size: 12px; text-align: center; margin-top: 12px; opacity: 0.8;">
          Click to focus • Scroll to zoom
        </div>
      </div>
    `
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Enhanced Dynamic Glow Background with Multiple Layers */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Outermost atmospheric glow */}
        <div 
          className={`absolute rounded-full transition-all duration-2000 ease-in-out ${
            shouldFlash ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${glowSize * 1.4}px`,
            height: `${glowSize * 1.4}px`,
            background: `radial-gradient(circle, 
              rgba(59, 130, 246, ${glowOpacity * 0.3}) 0%, 
              rgba(96, 165, 250, ${glowOpacity * 0.2}) 20%, 
              rgba(147, 197, 253, ${glowOpacity * 0.15}) 40%, 
              rgba(191, 219, 254, ${glowOpacity * 0.1}) 60%, 
              transparent 80%
            )`,
            filter: `blur(${80 + (glowIntensity * 120)}px)`,
            animation: shouldFlash ? 'pulse 3s infinite' : 'none'
          }}
        />
        
        {/* Main glow layer with dynamic colors */}
        <div 
          className="absolute rounded-full transition-all duration-1500 ease-in-out"
          style={{
            width: `${glowSize}px`,
            height: `${glowSize}px`,
            background: `radial-gradient(circle, 
              rgba(96, 165, 250, ${glowOpacity * 0.6}) 0%, 
              rgba(59, 130, 246, ${glowOpacity * 0.5}) 25%, 
              rgba(37, 99, 235, ${glowOpacity * 0.4}) 50%, 
              rgba(29, 78, 216, ${glowOpacity * 0.3}) 75%, 
              transparent 100%
            )`,
            filter: `blur(${50 + (glowIntensity * 80)}px)`,
            transform: `scale(${1 + Math.sin(time * 0.5) * 0.1})` // Gentle breathing effect
          }}
        />
        
        {/* Inner bright core with pulsing */}
        <div 
          className="absolute rounded-full transition-all duration-1000 ease-in-out"
          style={{
            width: `${glowSize * 0.6}px`,
            height: `${glowSize * 0.6}px`,
            background: `radial-gradient(circle, 
              rgba(219, 234, 254, ${glowOpacity * 0.8}) 0%, 
              rgba(147, 197, 253, ${glowOpacity * 0.6}) 40%, 
              rgba(96, 165, 250, ${glowOpacity * 0.4}) 70%, 
              transparent 100%
            )`,
            filter: `blur(${30 + (glowIntensity * 50)}px)`,
            transform: `scale(${1 + Math.sin(time * 1.2) * 0.15})` // Faster pulsing
          }}
        />
        
        {/* Revenue milestone flash effects */}
        {shouldFlash && (
          <>
            {/* Golden flash for high revenue */}
            <div 
              className="absolute rounded-full animate-ping"
              style={{
                width: `${glowSize * 1.2}px`,
                height: `${glowSize * 1.2}px`,
                background: `radial-gradient(circle, 
                  rgba(251, 191, 36, 0.4) 0%, 
                  rgba(245, 158, 11, 0.3) 30%, 
                  rgba(217, 119, 6, 0.2) 60%, 
                  transparent 100%
                )`,
                filter: 'blur(60px)',
                animationDuration: '4s',
                animationIterationCount: 'infinite',
              }}
            />
            
            {/* Green success flash */}
            <div 
              className="absolute rounded-full animate-ping"
              style={{
                width: `${glowSize * 0.8}px`,
                height: `${glowSize * 0.8}px`,
                background: `radial-gradient(circle, 
                  rgba(34, 197, 94, 0.5) 0%, 
                  rgba(74, 222, 128, 0.3) 50%, 
                  transparent 100%
                )`,
                filter: 'blur(40px)',
                animationDuration: '2.5s',
                animationIterationCount: 'infinite',
              }}
            />
          </>
        )}
      </div>

      <div className="w-full h-full relative z-30">
        <Globe
          ref={globeRef}
          
          // Position globe on far right edge - half on screen, half off
          globeOffset={[850, 0]} // [x, y] offset - bringing it back to the left a bit
          
          // Enhanced globe appearance
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          
          // Points configuration with enhanced effects - now as dots instead of cylinders
          pointsData={globeData}
          pointAltitude={0} // Changed from 0.08 to 0 - makes flat dots instead of 3D cylinders
          pointColor={(point: any) => {
            // Hide points for high intensity areas (>0.6) since they have rings
            if (point.intensity > 0.6) return 'transparent'
            return point.color
          }}
          pointRadius={(point: any) => {
            // Make high intensity points much smaller or invisible
            if (point.intensity > 0.6) return 0
            
            // Enhanced effects for medium and low revenue areas
            if (point.intensity <= 0.2) {
              // Green areas: gentle sparkle effect
              const sparkle = 1 + Math.sin(time * 1.5 + point.lat * 0.2 + point.lng * 0.1) * 0.4
              const randomTwinkle = 1 + Math.sin(time * 3 + point.lat * point.lng) * 0.2
              return point.size * sparkle * randomTwinkle * 1.2
            } else {
              // Medium areas: gentle pulsing
              const basePulse = 1 + Math.sin(time * 1.8 + point.lat * 0.15) * 0.35
              const intensityMultiplier = 0.8 + point.intensity * 1.5
              return point.size * basePulse * intensityMultiplier
            }
          }}
          pointResolution={16}
          
          // Arcs for connecting revenue locations with different styles per level
          arcsData={arcsData}
          arcColor={(arc: any) => arc.color}
          arcAltitude={(arc: any) => {
            // Different altitudes for different revenue levels
            if (arc.type === 'high') return 0.15      // Highest arcs for red zones
            if (arc.type === 'sf-green') return 0.08  // Medium-low for SF to green connections
            if (arc.type === 'sf-yellow') return 0.12 // Medium-high for SF to yellow connections
            if (arc.type === 'medium') return 0.10    // Medium height for yellow/orange
            return 0.06                               // Lower arcs for other connections
          }}
          arcStroke={(arc: any) => {
            // Different stroke weights for different revenue levels
            if (arc.type === 'high') return 0.6       // Thickest for red zones
            if (arc.type === 'sf-green') return 0.5   // Prominent for SF green connections
            if (arc.type === 'sf-yellow') return 0.6  // Very prominent for SF yellow connections
            if (arc.type === 'medium') return 0.4     // Medium thickness for yellow/orange
            return 0.3                                // Thinnest for other connections
          }}
          arcDashLength={(arc: any) => {
            // Different dash patterns for visual variety
            if (arc.type === 'high') return 0.4       // Standard dashing for red
            if (arc.type === 'sf-green') return 0.5   // Slightly longer for SF green lines
            if (arc.type === 'sf-yellow') return 0.4  // Standard for SF yellow lines
            if (arc.type === 'medium') return 0.6     // Longer dashes for medium
            return 0.8                                // Longest dashes for others
          }}
          arcDashGap={(arc: any) => {
            if (arc.type === 'high') return 0.2       // Standard gaps for red
            if (arc.type === 'sf-green') return 0.25  // Slightly larger gaps for SF green
            if (arc.type === 'sf-yellow') return 0.2  // Standard gaps for SF yellow
            if (arc.type === 'medium') return 0.3     // Larger gaps for medium
            return 0.4                                // Largest gaps for others
          }}
          arcDashAnimateTime={(arc: any) => {
            // Different animation speeds for visual hierarchy
            if (arc.type === 'high') return 1500      // Fastest animation for red zones
            if (arc.type === 'sf-green') return 2000  // Smooth speed for SF green connections
            if (arc.type === 'sf-yellow') return 1800 // Slightly faster for SF yellow connections
            if (arc.type === 'medium') return 2500    // Medium speed for yellow/orange
            return 3500                               // Slowest for others
          }}
          
          // Rings for top locations
          ringsData={ringsData}
          ringColor={(ring: any) => ring.color}
          ringMaxRadius={(ring: any) => ring.maxR}
          ringPropagationSpeed={(ring: any) => ring.propagationSpeed}
          ringRepeatPeriod={(ring: any) => ring.repeatPeriod}
          
          // Enhanced atmosphere
          showAtmosphere={true}
          atmosphereColor="lightskyblue"
          atmosphereAltitude={0.25}
          
          // Interactivity
          onPointClick={handlePointClick}
          pointLabel={getPointLabel}
          
          // Animation and controls
          animateIn={true}
          enablePointerInteraction={true}
          
          // Enhanced performance settings
          rendererConfig={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
          }}
        />
      </div>
      
      {/* Enhanced loading indicator */}
      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div>
              <div className="absolute top-0 left-0 animate-ping rounded-full h-16 w-16 border-2 border-blue-400 opacity-20"></div>
            </div>
            <p className="text-xl text-white font-medium">Initializing Global Revenue Map...</p>
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 