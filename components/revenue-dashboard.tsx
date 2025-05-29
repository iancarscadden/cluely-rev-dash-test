"use client"

import { useState, useEffect, useRef } from "react"
import { Settings, RefreshCw, AlertCircle } from "lucide-react"
import { RevenueChart } from "./revenue-chart"
import { CountUp } from "./count-up"
import { SettingsPanel } from "./settings-panel"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { format, parseISO, isValid } from "date-fns"

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
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
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
      console.log(`Dashboard: ${isInitialLoad ? "Initial load" : "Refreshing"} revenue data...`)

      if (isInitialLoad) {
        setInitialLoading(true)
      } else {
        setRefreshing(true)

        // Store current values for animation
        if (revenueData) {
          setPrevTotal(revenueData.total_revenue.total)
          setPrevCluelyTotal(revenueData.total_revenue.cluely)
          setPrevInterviewCoderTotal(revenueData.total_revenue.interview_coder)
          console.log(`Dashboard: Previous totals set for animation - Total: ${revenueData.total_revenue.total}`)
        }
      }

      // Add a timeout to the fetch to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch("/api/revenue", {
        signal: controller.signal,
        cache: "no-store", // Ensure we don't get cached responses
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const newData = await response.json()

      console.log("Dashboard: Revenue data received", newData)

      if (newData.error) {
        console.error(`Dashboard: Error from Revenue API - ${newData.error}`)
        setError(newData.error)
      } else {
        setRevenueData(newData)
        setError(null)
        console.log("Dashboard: Revenue data updated successfully")
      }
    } catch (err) {
      console.error("Dashboard: Failed to fetch revenue data", err)
      setError(`Failed to fetch revenue data: ${err instanceof Error ? err.message : String(err)}`)
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
      60 * 1000, // 1 minute
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
    console.log(`Dashboard: Settings panel ${showSettings ? "closed" : "opened"}`)
    setShowSettings(!showSettings)
  }

  // Get the appropriate value to display based on settings
  const getDisplayValue = () => {
    if (!revenueData) return 0

    return splitRevenue
      ? {
          cluely: revenueData.total_revenue.cluely,
          interviewCoder: revenueData.total_revenue.interview_coder,
        }
      : revenueData.total_revenue.total
  }

  // Get previous values for animation
  const getPrevValue = () => {
    if (splitRevenue) {
      return {
        cluely: prevCluelyTotal,
        interviewCoder: prevInterviewCoderTotal,
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
          interviewCoder: revenueData.today_revenue.interview_coder,
        }
      : revenueData.today_revenue.total
  }

  // Get the latest date from the revenue data
  const getLatestDate = () => {
    if (!revenueData || !revenueData.revenue_data || revenueData.revenue_data.length === 0) {
      return "Latest"
    }

    try {
      const latestEntry = revenueData.revenue_data[revenueData.revenue_data.length - 1]
      // Safely format the date
      return safeFormatDate(latestEntry.date, "MMM d")
    } catch (error) {
      console.error("Error getting latest date:", error)
      return "Latest"
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          splitRevenue={splitRevenue}
          setSplitRevenue={setSplitRevenue}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Header with revenue display and controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-6">
        {/* Total Revenue */}
        <Card className="md:col-span-6 bg-white border-gray-200 shadow-md h-auto">
          <CardContent className="p-8">
            <div className="flex flex-col">
              <span className="text-2xl font-medium text-blue-600 mb-2">Total Revenue</span>

              {initialLoading ? (
                <Skeleton className="h-24 w-80 bg-gray-200" />
              ) : error && !revenueData ? (
                <div className="text-red-600 text-xl flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  <span>Error loading data</span>
                </div>
              ) : splitRevenue ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <p className="text-2xl font-medium text-gray-700">Cluely</p>
                    </div>
                    <CountUp
                      value={getDisplayValue().cluely}
                      prevValue={getPrevValue().cluely}
                      className="text-8xl font-bold font-inter tracking-tight text-gray-900"
                      duration={2000} // Longer duration for smoother animation
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                      <p className="text-2xl font-medium text-gray-700">Interview Coder</p>
                    </div>
                    <CountUp
                      value={getDisplayValue().interviewCoder}
                      prevValue={getPrevValue().interviewCoder}
                      className="text-8xl font-bold font-inter tracking-tight text-gray-900"
                      duration={2000} // Longer duration for smoother animation
                    />
                  </div>
                </div>
              ) : (
                <CountUp
                  value={getDisplayValue()}
                  prevValue={getPrevValue()}
                  className="text-9xl font-bold font-inter tracking-tight text-gray-900"
                  duration={2000} // Longer duration for smoother animation
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="md:col-span-4 bg-white border-gray-200 shadow-md h-auto">
          <CardContent className="p-8">
            <div className="flex flex-col">
              <span className="text-2xl font-medium text-indigo-600 mb-2">Today's Revenue</span>

              {initialLoading ? (
                <Skeleton className="h-16 w-64 bg-gray-200" />
              ) : error && !revenueData ? (
                <div className="text-red-600 text-xl flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  <span>Error loading data</span>
                </div>
              ) : splitRevenue ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-medium text-gray-600">Cluely</p>
                    <p className="text-6xl font-bold font-inter tracking-tight text-gray-900">
                      {formatCurrency(getTodayRevenue().cluely)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-medium text-gray-600">Interview Coder</p>
                    <p className="text-6xl font-bold font-inter tracking-tight text-gray-900">
                      {formatCurrency(getTodayRevenue().interviewCoder)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-7xl font-bold font-inter tracking-tight text-gray-900">
                  {formatCurrency(getTodayRevenue())}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-12 w-12 rounded-full bg-white border-gray-300 hover:bg-gray-100 hover:border-gray-400"
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-6 w-6 text-gray-700 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSettings}
            className="h-12 w-12 rounded-full bg-white border-gray-300 hover:bg-gray-100 hover:border-gray-400"
            aria-label="Settings"
          >
            <Settings className="h-6 w-6 text-gray-700" />
          </Button>
        </div>
      </div>

      {/* Chart Card - Make it fill the remaining space */}
      <Card className="border-gray-200 shadow-lg overflow-hidden bg-white flex-grow">
        <CardContent className="p-0 h-full">
          {initialLoading ? (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p className="text-xl text-gray-700">Loading historical data...</p>
              </div>
            </div>
          ) : error && !revenueData ? (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="text-red-600 text-center p-6 flex flex-col items-center gap-4">
                <AlertCircle className="h-12 w-12" />
                <p className="text-xl">Error loading chart data</p>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  className="mt-2 bg-white border-gray-300 hover:bg-gray-100 text-gray-700 text-lg px-6 py-3"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full relative">
              {revenueData && revenueData.revenue_data && revenueData.revenue_data.length > 0 ? (
                <>
                  <RevenueChart data={revenueData.revenue_data} splitRevenue={splitRevenue} showARR={false} />
                  {refreshing && (
                    <div className="absolute top-4 right-4 bg-white bg-opacity-70 rounded-full p-2">
                      <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                  <div className="text-gray-700 text-center p-6">
                    <p className="text-xl">No historical data available</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
