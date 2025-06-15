"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  type TooltipProps,
} from "recharts"
import { format, parseISO, isValid } from "date-fns"

interface RevenueData {
  date: string
  amount_interview_coder: number
  cumulative_amount_interview_coder: number
  amount_cluely: number
  cumulative_amount_cluely: number
  total_daily_revenue: number
  total_cumulative_revenue: number
}

interface RevenueChartProps {
  data: RevenueData[]
  splitRevenue: boolean
  showARR: boolean
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
    return dateString // Fallback to original string
  }
}

export function RevenueChart({ data, splitRevenue, showARR }: RevenueChartProps) {
  console.log("Chart: Rendering revenue chart", {
    dataPoints: data.length,
    splitRevenue,
    showARR,
  })

  // Process data for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Format the data for the chart
    const formattedData = data.map((item) => {
      try {
        return {
          ...item,
          // Keep the original date for data processing
          originalDate: item.date,
          // Extract month number for even spacing
          monthNum: Number.parseInt(item.date.split("-")[1]),
          // Format the date to show only month for x-axis
          date: safeFormatDate(item.date, "MMM"),
          // Format full date for tooltip
          fullDate: safeFormatDate(item.date, "MMM d, yyyy"),
        }
      } catch (error) {
        console.error(`Error processing data point ${item.date}:`, error)
        // Return a safe fallback
        return {
          ...item,
          originalDate: item.date,
          monthNum: 0,
          date: "Unknown",
          fullDate: "Unknown Date",
        }
      }
    })

    console.log(`Chart: Processed ${formattedData.length} data points`)
    return formattedData
  }, [data])

  // Create evenly spaced month ticks
  const monthTicks = useMemo(() => {
    // Define all months we want to show (January to May or current month)
    return ["Jan", "Feb", "Mar", "Apr", "May"]
  }, [])

  // Custom tooltip formatter
  const formatTooltip = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload

      return (
        <div className="bg-white p-6 border-2 border-gray-300 rounded-lg shadow-lg">
          <p className="font-medium mb-3 text-gray-800 text-xl">{dataPoint.fullDate}</p>
          {payload.map((entry, index) => (
            <div key={`tooltip-${index}`} className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-lg font-medium text-gray-700">
                {entry.name}: {formatTooltip(entry.value as number)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-full bg-transparent rounded-lg relative">
      {/* Custom CSS for enhanced visual effects */}
      <style jsx>{`
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke: rgba(0, 0, 0, 0.1);
          stroke-width: 1;
        }
        
        .recharts-cartesian-axis-line {
          stroke: rgba(0, 0, 0, 0.3);
          stroke-width: 2;
        }
        
        .chart-glow {
          filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.3));
        }
        
        .line-glow {
          filter: drop-shadow(0 0 6px currentColor);
        }
      `}</style>
      
      <ResponsiveContainer width="100%" height="100%">
        {splitRevenue ? (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            {/* Enhanced grid with subtle lines */}
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(0,0,0,0.1)" 
              strokeWidth={1}
              className="opacity-60"
            />
            
            {/* Stylized X-axis */}
            <XAxis
              dataKey="date"
              tick={{ 
                fontSize: 14, 
                fill: "#374151", 
                fontWeight: "600"
              }}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={2}
              ticks={monthTicks}
              axisLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              tickLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              type="category"
              interval={0}
            />
            
            {/* Stylized Y-axis */}
            <YAxis
              tickFormatter={(value) => formatTooltip(value)}
              tick={{ 
                fontSize: 14, 
                fill: "#374151", 
                fontWeight: "600"
              }}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={2}
              width={100}
              axisLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              tickLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
            />

            {/* Enhanced Cluely line */}
            <Line
              type="monotone"
              dataKey="cumulative_amount_cluely"
              name="Cluely Revenue"
              stroke="#3B82F6"
              strokeWidth={4}
              dot={false}
              activeDot={{ 
                r: 8, 
                strokeWidth: 3, 
                fill: "#3B82F6",
                stroke: "#ffffff",
                filter: "drop-shadow(0 0 8px #3B82F6)"
              }}
              className="line-glow"
              animationDuration={2000}
            />
            
            {/* Enhanced Interview Coder line */}
            <Line
              type="monotone"
              dataKey="cumulative_amount_interview_coder"
              name="Interview Coder Revenue"
              stroke="#F59E0B"
              strokeWidth={4}
              dot={false}
              activeDot={{ 
                r: 8, 
                strokeWidth: 3, 
                fill: "#F59E0B",
                stroke: "#ffffff",
                filter: "drop-shadow(0 0 8px #F59E0B)"
              }}
              className="line-glow"
              animationDuration={2000}
            />
          </LineChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            {/* Enhanced gradient definitions for white background */}
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="25%" stopColor="#3B82F6" stopOpacity={0.5} />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
              </linearGradient>
              
              {/* Border gradient for white background */}
              <linearGradient id="glowBorder" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            
            {/* Enhanced grid */}
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(0,0,0,0.1)" 
              strokeWidth={1}
              className="opacity-60"
            />
            
            {/* Stylized X-axis */}
            <XAxis
              dataKey="date"
              tick={{ 
                fontSize: 14, 
                fill: "#374151", 
                fontWeight: "600"
              }}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={2}
              ticks={monthTicks}
              axisLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              tickLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              type="category"
              interval={0}
            />
            
            {/* Stylized Y-axis */}
            <YAxis
              tickFormatter={(value) => formatTooltip(value)}
              tick={{ 
                fontSize: 14, 
                fill: "#374151", 
                fontWeight: "600"
              }}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={2}
              width={100}
              axisLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
              tickLine={{ stroke: "rgba(0,0,0,0.4)", strokeWidth: 2 }}
            />
            
            {/* Enhanced area with gradient optimized for white background */}
            <Area
              type="monotone"
              dataKey="total_cumulative_revenue"
              name="Total Revenue"
              stroke="url(#glowBorder)"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              dot={false}
              activeDot={{ 
                r: 8, 
                strokeWidth: 3, 
                fill: "#3B82F6",
                stroke: "#ffffff",
                filter: "drop-shadow(0 0 12px #3B82F6)"
              }}
              className="chart-glow"
              animationDuration={2000}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
