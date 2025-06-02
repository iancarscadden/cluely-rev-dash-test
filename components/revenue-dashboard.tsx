"use client"

import { useState, useEffect, useRef } from "react"
import { Settings, RefreshCw, AlertCircle } from "lucide-react"
import { RevenueChart } from "./revenue-chart"
import { CountUp } from "./count-up"
import { SettingsPanel } from "./settings-panel"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { format, parseISO, isValid } from "date-fns"
import dynamic from "next/dynamic"

// Dynamically import GeographicalGlobe with SSR disabled
const GeographicalGlobe = dynamic(() => import("./geographical-globe"), {
  ssr: false, // This prevents server-side rendering
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white opacity-50"></div>
    </div>
  )
})

// Types for our revenue data
interface RevenueData {
  date: string
  amount_interview_coder: number
  cumulative_amount_interview_coder: number
  amount_cluely: number
  cumulative_amount_cluely: number
  total_daily_revenue: number
  total_cumulative_revenue: number
}

interface RevenueResponse {
  revenue_data: RevenueData[]
  today_revenue: {
    interview_coder: number
    cluely: number
    total: number
    date?: string // Date of the revenue data
    is_today?: boolean // Whether this is actually today's data
  }
  total_revenue: {
    interview_coder: number
    cluely: number
    total: number
  }
  error?: string
}

// Helper function to safely format dates
function safeFormatDate(dateString: string, formatStr: string): string {
  try {
    // Check if the date string is in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const date = parseISO(dateString)
      if (isValid(date)) {
        return format(date, formatStr)
      }
    }

    // If we can't parse it as an ISO date, try to extract the month and day
    const parts = dateString.split("-")
    if (parts.length === 3) {
      const month = Number.parseInt(parts[1], 10)
      const day = Number.parseInt(parts[2], 10)

      if (!isNaN(month) && !isNaN(day)) {
        // Return a simple formatted string
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ]
        return `${monthNames[month - 1]} ${day}`
      }
    }

    // Fallback to just returning the date string or a part of it
    return dateString.split("-").slice(1).join("-") // Return MM-DD part
  } catch (error) {
    console.error(`Error formatting date ${dateString}:`, error)
    return "Latest" // Fallback value
  }
}

export default function RevenueDashboard() {
  // State for revenue data
  const [revenueData, setRevenueData] = useState<RevenueResponse | null>(null)
  const [geographicalData, setGeographicalData] = useState<any>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showSettings, setShowSettings] = useState(false)
  const [splitRevenue, setSplitRevenue] = useState(false)
  const [prevTotal, setPrevTotal] = useState(0)
  const [prevCluelyTotal, setPrevCluelyTotal] = useState(0)
  const [prevInterviewCoderTotal, setPrevInterviewCoderTotal] = useState(0)

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Function to fetch revenue data
  const fetchRevenueData = async (isInitialLoad = false) => {
    try {
      console.log(
        `Dashboard: ${
          isInitialLoad ? "Initial load" : "Refreshing"
        } revenue data...`
      )

      if (isInitialLoad) {
        setInitialLoading(true)
      } else {
        setRefreshing(true)

        // Store current values for animation
        if (revenueData) {
          setPrevTotal(revenueData.total_revenue.total)
          setPrevCluelyTotal(revenueData.total_revenue.cluely)
          setPrevInterviewCoderTotal(revenueData.total_revenue.interview_coder)
          console.log(
            `Dashboard: Previous totals set for animation - Total: ${revenueData.total_revenue.total}`
          )
        }
      }

      // Fetch both revenue and geographical data in parallel
      const [revenueResponse, geographicalResponse] = await Promise.all([
        // Revenue data
        fetch("/api/revenue", {
          cache: "no-store"
        }),
        // Geographical data
        fetch("/api/geographical", {
          cache: "no-store"
        })
      ])

      if (!revenueResponse.ok) {
        throw new Error(`Revenue API error! status: ${revenueResponse.status}`)
      }

      const newRevenueData = await revenueResponse.json()
      console.log("Dashboard: Revenue data received", newRevenueData)

      if (newRevenueData.error) {
        console.error(
          `Dashboard: Error from Revenue API - ${newRevenueData.error}`
        )
        setError(newRevenueData.error)
      } else {
        setRevenueData(newRevenueData)
        setError(null)
        console.log("Dashboard: Revenue data updated successfully")
      }

      // Handle geographical data (don't fail if this errors)
      if (geographicalResponse.ok) {
        const newGeographicalData = await geographicalResponse.json()
        console.log(
          "Dashboard: Geographical data received",
          newGeographicalData
        )

        if (!newGeographicalData.error) {
          setGeographicalData(newGeographicalData)
          console.log("Dashboard: Geographical data updated successfully")
          console.log(
            "Dashboard: Combined geographical data points:",
            newGeographicalData.geographical_data?.combined?.length || 0
          )
        } else {
          console.warn(
            "Dashboard: Geographical data error:",
            newGeographicalData.error
          )
        }
      } else {
        console.warn("Dashboard: Geographical API failed, using mock data")
        console.warn("Dashboard: Response status:", geographicalResponse.status)
        console.warn(
          "Dashboard: Response statusText:",
          geographicalResponse.statusText
        )
      }
    } catch (err) {
      console.error("Dashboard: Failed to fetch revenue data", err)
      setError(
        `Failed to fetch revenue data: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    } finally {
      if (isInitialLoad) {
        setInitialLoading(false)
      }
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    console.log("Dashboard: Initial data fetch")
    fetchRevenueData(true)

    // Set up auto-refresh every 1 minute
    autoRefreshIntervalRef.current = setInterval(
      () => {
        console.log("Dashboard: Auto-refresh triggered")
        fetchRevenueData(false)
      },
      60 * 1000 // 1 minute
    )

    return () => {
      console.log("Dashboard: Cleaning up intervals and timeouts")
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  // Handle manual refresh
  const handleRefresh = () => {
    if (!refreshing) {
      console.log("Dashboard: Manual refresh triggered")
      fetchRevenueData(false)
    }
  }

  // Toggle settings panel
  const toggleSettings = () => {
    console.log(
      `Dashboard: Settings panel ${showSettings ? "closed" : "opened"}`
    )
    setShowSettings(!showSettings)
  }

  // Get the appropriate value to display based on settings
  const getDisplayValue = () => {
    if (!revenueData) return 0

    return splitRevenue
      ? {
          cluely: revenueData.total_revenue.cluely,
          interviewCoder: revenueData.total_revenue.interview_coder
        }
      : revenueData.total_revenue.total
  }

  // Get previous values for animation
  const getPrevValue = () => {
    if (splitRevenue) {
      return {
        cluely: prevCluelyTotal,
        interviewCoder: prevInterviewCoderTotal
      }
    }
    return prevTotal
  }

  // Get today's revenue
  const getTodayRevenue = () => {
    if (!revenueData) return 0

    return splitRevenue
      ? {
          cluely: revenueData.today_revenue.cluely,
          interviewCoder: revenueData.today_revenue.interview_coder
        }
      : revenueData.today_revenue.total
  }

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          splitRevenue={splitRevenue}
          setSplitRevenue={setSplitRevenue}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Full-screen Globe Background */}
      {/* <div className="absolute inset-0 w-full h-full">
        <GeographicalGlobe 
          className="w-full h-full relative z-10" 
          todaysRevenue={typeof getTodayRevenue() === 'number' ? getTodayRevenue() as number : 0}
          data={geographicalData?.geographical_data?.combined || undefined}
        />
      </div> */}

      {/* Centered Chart Layout */}
      <div className="absolute inset-0 z-10 flex flex-col justify-start pt-8">
        <div className="w-full max-w-6xl mx-auto px-8">
          <div className="flex items-center justify-between gap-8 mb-6">
            {/* Total Revenue - Left - Same size as Today's */}
            <div className="flex-1">
              <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-8 border border-white border-opacity-20 relative overflow-hidden">
                {/* Cluely Logo in top right corner of revenue box */}
                <div className="absolute top-4 right-4 pointer-events-none opacity-20">
                  <svg
                    className="w-16 h-16 text-white"
                    viewBox="0 0 64.37 64.41"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g>
                      <path
                        className="fill-current"
                        d="M42.81,1.81C17.56-6.81-6.47,16.8,1.58,42.22c7.4,23.37,38.16,29.95,54.52,11.65,15.33-17.14,8.47-44.63-13.29-52.06ZM8.41,25.04c5.36,4.43,12.1,6.67,19.07,6.57l-15.39,15.28c-4.52-6.29-5.93-14.4-3.68-21.85ZM39.17,56.12c-7.39,2.12-15.45.71-21.64-3.8l15.48-15.59c-.25,2.3.05,4.89.51,7.19.46,2.27,1.4,4.91,2.46,6.97.9,1.75,2.24,3.22,3.19,4.82.11.19.34.14,0,.41ZM52.05,47.26c-.75,1-4.45,5.03-5.45,5.23-.61.13-2-1.71-2.39-2.24-6.37-8.74-4.83-20.87,3.15-28,.05-.19-.1-.27-.18-.39-.33-.49-4.12-4.28-4.62-4.62-.22-.15-.22-.26-.52-.11-.49.26-1.75,1.86-2.37,2.37-7.94,6.65-20.62,6.25-27.75-1.36,3.6-5.98,11.06-10.08,17.98-10.67,21.49-1.84,35.18,22.53,22.15,39.79Z"
                      />
                    </g>
                  </svg>
                </div>

                <h2 className="text-3xl font-semibold text-white mb-6">
                  Total Revenue
                </h2>

                {initialLoading ? (
                  <div className="h-20 w-80 bg-white bg-opacity-20 rounded animate-pulse" />
                ) : error && !revenueData ? (
                  <div className="text-red-400 text-xl flex items-center gap-2">
                    <AlertCircle className="h-6 w-6" />
                    <span>Error loading data</span>
                  </div>
                ) : splitRevenue ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                        <p className="text-xl text-white opacity-80">Cluely</p>
                      </div>
                      <CountUp
                        value={
                          splitRevenue && typeof getDisplayValue() === "object"
                            ? (getDisplayValue() as any).cluely
                            : 0
                        }
                        prevValue={
                          splitRevenue && typeof getPrevValue() === "object"
                            ? (getPrevValue() as any).cluely
                            : 0
                        }
                        className="text-5xl font-bold text-white"
                        duration={2000}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                        <p className="text-xl text-white opacity-80">
                          Interview Coder
                        </p>
                      </div>
                      <CountUp
                        value={
                          splitRevenue && typeof getDisplayValue() === "object"
                            ? (getDisplayValue() as any).interviewCoder
                            : 0
                        }
                        prevValue={
                          splitRevenue && typeof getPrevValue() === "object"
                            ? (getPrevValue() as any).interviewCoder
                            : 0
                        }
                        className="text-5xl font-bold text-white"
                        duration={2000}
                      />
                    </div>
                  </div>
                ) : (
                  <CountUp
                    value={
                      !splitRevenue && typeof getDisplayValue() === "number"
                        ? (getDisplayValue() as number)
                        : 0
                    }
                    prevValue={
                      !splitRevenue && typeof getPrevValue() === "number"
                        ? (getPrevValue() as number)
                        : 0
                    }
                    className="text-7xl font-bold text-white"
                    duration={2000}
                  />
                )}
              </div>
            </div>

            {/* Today's Revenue - Right - Same size as Total */}
            <div className="flex-1">
              <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-8 border border-white border-opacity-20">
                <h2 className="text-3xl font-semibold text-white mb-6">
                  Today's Revenue
                </h2>

                {initialLoading ? (
                  <div className="h-20 w-80 bg-white bg-opacity-20 rounded animate-pulse" />
                ) : error && !revenueData ? (
                  <div className="text-red-400 text-xl flex items-center gap-2">
                    <AlertCircle className="h-6 w-6" />
                    <span>Error loading data</span>
                  </div>
                ) : splitRevenue ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                        <p className="text-xl text-white opacity-80">Cluely</p>
                      </div>
                      <p className="text-5xl font-bold text-white">
                        {formatCurrency(
                          splitRevenue && typeof getTodayRevenue() === "object"
                            ? (getTodayRevenue() as any).cluely
                            : 0
                        )}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                        <p className="text-xl text-white opacity-80">
                          Interview Coder
                        </p>
                      </div>
                      <p className="text-5xl font-bold text-white">
                        {formatCurrency(
                          splitRevenue && typeof getTodayRevenue() === "object"
                            ? (getTodayRevenue() as any).interviewCoder
                            : 0
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-7xl font-bold text-white">
                    {formatCurrency(
                      !splitRevenue && typeof getTodayRevenue() === "number"
                        ? (getTodayRevenue() as number)
                        : 0
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Large Chart - Extended to bottom */}
          <div className="w-full" style={{ height: "calc(100vh - 280px)" }}>
            <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 h-full">
              {initialLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                    <p className="text-sm text-white opacity-80">
                      Loading chart...
                    </p>
                  </div>
                </div>
              ) : error && !revenueData ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-red-400 text-center flex flex-col items-center gap-3">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">Chart error</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full relative">
                  {revenueData &&
                  revenueData.revenue_data &&
                  revenueData.revenue_data.length > 0 ? (
                    <>
                      <RevenueChart
                        data={revenueData.revenue_data}
                        splitRevenue={splitRevenue}
                        showARR={false}
                      />
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-white opacity-80">
                        No chart data available
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
