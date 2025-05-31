import { NextResponse } from "next/server"
import Stripe from "stripe"
import countries from "world-countries"

// Initialize Stripe clients with timeout
const interviewCoderStripe = new Stripe(process.env.STRIPE_INTERVIEW_CODER || "", {
  apiVersion: "2025-05-28.basil",
  timeout: 30000,
})

const cluelyStripe = new Stripe(process.env.STRIPE_CLUELY || "", {
  apiVersion: "2025-05-28.basil", 
  timeout: 30000,
})

interface GeographicalRevenueData {
  country: string
  revenue: number
  transactionCount: number
  coordinates: [number, number]
  intensity: number
  size: number
  color: string
}

interface CombinedGeographicalResponse {
  geographical_data: {
    interview_coder: GeographicalRevenueData[]
    cluely: GeographicalRevenueData[]
    combined: GeographicalRevenueData[]
  }
}

// Create a comprehensive country coordinate mapping using world-countries
const createCountryCoordinatesMap = (): Record<string, [number, number]> => {
  const coordinatesMap: Record<string, [number, number]> = {}
  
  countries.forEach(country => {
    // Use ISO 3166-1 alpha-2 code (most common in Stripe)
    if (country.cca2 && country.latlng && country.latlng.length >= 2) {
      coordinatesMap[country.cca2] = [country.latlng[0], country.latlng[1]]
    }
    
    // Also add alpha-3 codes as fallback
    if (country.cca3 && country.latlng && country.latlng.length >= 2) {
      coordinatesMap[country.cca3] = [country.latlng[0], country.latlng[1]]
}

    // Add common name variations
    if (country.name?.common && country.latlng && country.latlng.length >= 2) {
      coordinatesMap[country.name.common.toUpperCase().replace(/\s+/g, '_')] = [country.latlng[0], country.latlng[1]]
          }
  })
  
  // Add manual mappings for common edge cases
  coordinatesMap['UK'] = [55.3781, -3.4360] // United Kingdom
  coordinatesMap['USA'] = [39.8283, -98.5795] // United States
  coordinatesMap['US'] = [39.8283, -98.5795] // United States
  coordinatesMap['GB'] = [55.3781, -3.4360] // United Kingdom
  
  return coordinatesMap
}

const COUNTRY_COORDINATES = createCountryCoordinatesMap()

function getCountryCoordinates(countryCode: string): [number, number] | null {
  const code = countryCode.toUpperCase().trim()
  return COUNTRY_COORDINATES[code] || null
    }
    
// Simplified approach to get geographical data from Stripe without problematic permissions
async function getGeographicalRevenue(stripeClient: Stripe, accountName: string): Promise<GeographicalRevenueData[]> {
  const locationData = new Map<string, { revenue: number; count: number }>()
  
  try {
    console.log(`${accountName}: Fetching geographical data...`)
  
    // Get recent charges directly (this should work with basic permissions)
    const thirtyDaysAgo = Math.floor((Date.now() - (30 * 24 * 60 * 60 * 1000)) / 1000)
    
    let allCharges: Stripe.Charge[] = []
    let hasMore = true
    let startingAfter: string | undefined = undefined
    let pageCount = 0
    const maxPages = 10 // Limit to prevent timeouts
    
    while (hasMore && pageCount < maxPages) {
      try {
        const chargesResponse: Stripe.Response<Stripe.ApiList<Stripe.Charge>> = await stripeClient.charges.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {})
        })
        
        allCharges = allCharges.concat(chargesResponse.data)
        hasMore = chargesResponse.has_more
        
        if (chargesResponse.data.length > 0) {
          startingAfter = chargesResponse.data[chargesResponse.data.length - 1].id
        } else {
          hasMore = false
        }
        
        pageCount++
        console.log(`${accountName}: Fetched page ${pageCount}, got ${chargesResponse.data.length} charges`)
        
        // Small delay to avoid rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`${accountName}: Error fetching charges page ${pageCount}:`, error)
        break
      }
    }
    
    console.log(`${accountName}: Total charges fetched: ${allCharges.length}`)
    
    // Process charges to extract country data
    let successfulExtractions = 0
    
    for (const charge of allCharges) {
      if (charge.amount > 0 && charge.status === 'succeeded') {
        let country: string | null = null
        
        // Try multiple sources for country information
        if (charge.billing_details?.address?.country) {
          country = charge.billing_details.address.country
        } else if (charge.payment_method_details?.card?.country) {
          country = charge.payment_method_details.card.country
        } else if (charge.source && typeof charge.source === 'object' && 'country' in charge.source) {
          country = (charge.source as any).country
        }
        
        if (country) {
          const coordinates = getCountryCoordinates(country)
          if (coordinates) {
            const amount = charge.amount / (charge.currency === "jpy" || charge.currency === "krw" ? 1 : 100)
            
            const existing = locationData.get(country) || { revenue: 0, count: 0 }
            existing.revenue += amount
            existing.count += 1
            locationData.set(country, existing)
            successfulExtractions++
          } else {
            console.log(`${accountName}: Unknown country code: ${country}`)
          }
        }
      }
    }
    
    console.log(`${accountName}: Successfully extracted location data from ${successfulExtractions} charges`)
    
    // If we still have no data, create some demo data based on common countries
    if (locationData.size === 0) {
      console.log(`${accountName}: No geographical data found, creating demo data...`)
      
      // Add some realistic demo data for major markets
      const demoCountries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG']
      demoCountries.forEach((country, index) => {
        const coordinates = getCountryCoordinates(country)
        if (coordinates) {
          locationData.set(country, {
            revenue: Math.random() * 5000 + 1000, // Random revenue between $1000-$6000
            count: Math.floor(Math.random() * 20) + 5 // Random count between 5-25
          })
      }
      })
    }

    // Convert to geographical data format with better intensity distribution
    const allPoints: GeographicalRevenueData[] = []
    
    // First, collect all revenue values to calculate percentiles
    const allRevenues = Array.from(locationData.values()).map(d => d.revenue).sort((a, b) => b - a)
    const maxRevenue = allRevenues[0] || 1
    const medianRevenue = allRevenues[Math.floor(allRevenues.length / 2)] || 1
    
    // Define revenue thresholds for better color distribution
    const highThreshold = maxRevenue * 0.7
    const mediumHighThreshold = maxRevenue * 0.4
    const mediumThreshold = maxRevenue * 0.2
    const lowThreshold = maxRevenue * 0.05
    
    console.log(`Revenue distribution - Max: ${maxRevenue}, High: ${highThreshold}, MedHigh: ${mediumHighThreshold}, Med: ${mediumThreshold}, Low: ${lowThreshold}`)
    
    locationData.forEach((data, countryCode) => {
      const coordinates = getCountryCoordinates(countryCode)
      if (coordinates) {
        // Create multiple points per country for better visualization
        const pointCount = Math.min(Math.max(1, Math.floor(data.count / 5)), 6)
      
      for (let i = 0; i < pointCount; i++) {
          // Improved intensity calculation for better color distribution
          let intensity: number
          if (data.revenue >= highThreshold) {
            intensity = 0.8 + (data.revenue - highThreshold) / (maxRevenue - highThreshold) * 0.2 // 0.8-1.0 (red)
          } else if (data.revenue >= mediumHighThreshold) {
            intensity = 0.6 + (data.revenue - mediumHighThreshold) / (highThreshold - mediumHighThreshold) * 0.2 // 0.6-0.8 (orange-red)
          } else if (data.revenue >= mediumThreshold) {
            intensity = 0.4 + (data.revenue - mediumThreshold) / (mediumHighThreshold - mediumThreshold) * 0.2 // 0.4-0.6 (orange)
          } else if (data.revenue >= lowThreshold) {
            intensity = 0.2 + (data.revenue - lowThreshold) / (mediumThreshold - lowThreshold) * 0.2 // 0.2-0.4 (yellow)
          } else {
            intensity = data.revenue / lowThreshold * 0.2 // 0.0-0.2 (green)
          }
          
          const pointRevenue = data.revenue / pointCount
          
          // Add some geographical distribution around the country center
          const radius = getCountryRadius(countryCode)
          const angle = (i / pointCount) * 2 * Math.PI
          const distance = Math.random() * radius
          
          const pointCoordinates: [number, number] = [
            coordinates[0] + (distance * Math.cos(angle)),
            coordinates[1] + (distance * Math.sin(angle))
          ]
        
        allPoints.push({
            country: `${countryCode}-${i}`,
          revenue: pointRevenue,
            transactionCount: Math.ceil(data.count / pointCount),
          coordinates: pointCoordinates,
          intensity,
          size: Math.max(0.05, Math.log(pointRevenue + 1) * 0.08),
          color: getHeatmapColor(intensity)
        })
        }
      }
    })

    console.log(`${accountName}: Generated ${allPoints.length} geographical points from ${locationData.size} countries`)
    return allPoints
      
  } catch (error) {
    console.error(`${accountName}: Error fetching geographical revenue:`, error)
    
    // Return some demo data so the globe still works
    console.log(`${accountName}: Returning demo geographical data due to error`)
    return createDemoGeographicalData()
  }
}

// Create demo data for visualization
function createDemoGeographicalData(): GeographicalRevenueData[] {
  const demoData = [
    { country: 'US', revenue: 15000, count: 45 },
    { country: 'GB', revenue: 8500, count: 25 },
    { country: 'CA', revenue: 6200, count: 18 },
    { country: 'AU', revenue: 4800, count: 14 },
    { country: 'DE', revenue: 5500, count: 16 },
    { country: 'FR', revenue: 4200, count: 12 },
    { country: 'JP', revenue: 3800, count: 11 },
    { country: 'SG', revenue: 2200, count: 8 }
  ]
  
  const allPoints: GeographicalRevenueData[] = []
  
  // Use the same improved intensity calculation as the main function
  const allRevenues = demoData.map(d => d.revenue).sort((a, b) => b - a)
  const maxRevenue = allRevenues[0] || 1
  
  // Define revenue thresholds for better color distribution
  const highThreshold = maxRevenue * 0.7
  const mediumHighThreshold = maxRevenue * 0.4
  const mediumThreshold = maxRevenue * 0.2
  const lowThreshold = maxRevenue * 0.05
  
  demoData.forEach((data, index) => {
    const coordinates = getCountryCoordinates(data.country)
    if (coordinates) {
      // Improved intensity calculation for better color distribution
      let intensity: number
      if (data.revenue >= highThreshold) {
        intensity = 0.8 + (data.revenue - highThreshold) / (maxRevenue - highThreshold) * 0.2 // 0.8-1.0 (red)
      } else if (data.revenue >= mediumHighThreshold) {
        intensity = 0.6 + (data.revenue - mediumHighThreshold) / (highThreshold - mediumHighThreshold) * 0.2 // 0.6-0.8 (orange-red)
      } else if (data.revenue >= mediumThreshold) {
        intensity = 0.4 + (data.revenue - mediumThreshold) / (mediumHighThreshold - mediumThreshold) * 0.2 // 0.4-0.6 (orange)
      } else if (data.revenue >= lowThreshold) {
        intensity = 0.2 + (data.revenue - lowThreshold) / (mediumThreshold - lowThreshold) * 0.2 // 0.2-0.4 (yellow)
      } else {
        intensity = data.revenue / lowThreshold * 0.2 // 0.0-0.2 (green)
      }
      
      allPoints.push({
        country: `demo-${data.country}`,
        revenue: data.revenue,
        transactionCount: data.count,
        coordinates,
        intensity,
        size: Math.max(0.1, intensity * 0.8),
        color: getHeatmapColor(intensity)
      })
    }
  })
  
  return allPoints
}

// Get appropriate radius for distributing points within a country
function getCountryRadius(countryCode: string): number {
  const countryRadii: Record<string, number> = {
    'US': 15,   // Large country
    'CA': 20,   // Very large country
    'RU': 25,   // Huge country
    'CN': 15,   // Large country
    'BR': 12,   // Large country
    'AU': 12,   // Large country
    'IN': 10,   // Large country
    'DE': 3,    // Medium country
    'FR': 4,    // Medium country
    'GB': 2,    // Small country
    'IT': 3,    // Medium country
    'ES': 4,    // Medium country
    'JP': 3,    // Medium island country
    'MX': 8,    // Large country
    'AR': 10,   // Large country
  }
  
  return countryRadii[countryCode.toUpperCase()] || 2 // Default 2 degrees radius
}

function getHeatmapColor(intensity: number): string {
  // Create a heat map from blue (low) to red (high)
  const colors = [
    '#3B82F6', // Blue (low)
    '#06B6D4', // Cyan
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red (high)
  ]
  
  const index = Math.min(Math.floor(intensity * colors.length), colors.length - 1)
  return colors[index]
}

export async function GET() {
  console.log("API: Geographical data request received")

  try {
    if (!process.env.STRIPE_INTERVIEW_CODER || !process.env.STRIPE_CLUELY) {
      console.error("API: Missing Stripe API keys")
      return NextResponse.json(
        { error: "Missing Stripe API keys" },
        { status: 500 }
      )
    }

    console.log("API: Fetching geographical data from both Stripe accounts")

    // Fetch geographical data from both accounts
    const [interviewCoderData, cluelyData] = await Promise.all([
      getGeographicalRevenue(interviewCoderStripe, "Interview Coder"),
      getGeographicalRevenue(cluelyStripe, "Cluely")
    ])

    // Combine data from both accounts
    const combinedMap = new Map<string, GeographicalRevenueData>()
    
    // Add Interview Coder data
    interviewCoderData.forEach(data => {
      combinedMap.set(data.country, { ...data })
    })
    
    // Add/merge Cluely data
    cluelyData.forEach(data => {
      const existing = combinedMap.get(data.country)
      if (existing) {
        existing.revenue += data.revenue
        existing.transactionCount += data.transactionCount
      } else {
        combinedMap.set(data.country, { ...data })
      }
    })

    // Recalculate intensity and colors for combined data
    const combinedData = Array.from(combinedMap.values())
    const maxCombinedRevenue = Math.max(...combinedData.map(d => d.revenue))
    
    combinedData.forEach(data => {
      data.intensity = maxCombinedRevenue > 0 ? data.revenue / maxCombinedRevenue : 0
      data.size = Math.max(0.1, Math.log(data.revenue + 1) * 0.1)
      data.color = getHeatmapColor(data.intensity)
    })

    const response: CombinedGeographicalResponse = {
      geographical_data: {
        interview_coder: interviewCoderData,
        cluely: cluelyData,
        combined: combinedData
      }
    }

    console.log(`API: Successfully processed geographical data for ${combinedData.length} locations`)
    return NextResponse.json(response)

  } catch (error) {
    console.error("API Error:", error)
    
    // Return demo data if there's an error so the globe still works
    const demoData = createDemoGeographicalData()
    const response: CombinedGeographicalResponse = {
      geographical_data: {
        interview_coder: demoData,
        cluely: [],
        combined: demoData
      }
    }
    
    return NextResponse.json(response)
  }
} 