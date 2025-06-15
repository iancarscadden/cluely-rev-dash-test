import { NextResponse } from "next/server"
import Stripe from "stripe"
import { parse } from "csv-parse/sync"
import fs from "fs"
import path from "path"

// Revenue adjustment configuration
const REVENUE_ADJUSTMENT_ENABLED = false // Set to false to disable the adjustment
const REVENUE_ADJUSTMENT_AMOUNT = 360000 // $360k flat adjustment

// Initialize Stripe clients with timeout - OPTIMIZED for Vercel
const interviewCoderStripe = new Stripe(
  process.env.STRIPE_INTERVIEW_CODER || "",
  {
  apiVersion: "2025-05-28.basil",
    timeout: 15000 // Reduced from 30s to 15s for Vercel
  }
)

const cluelyStripe = new Stripe(process.env.STRIPE_CLUELY || "", {
  apiVersion: "2025-05-28.basil",
  timeout: 15000 // Reduced from 30s to 15s for Vercel
})

interface DailyRevenue {
  date: string
  amount: number
  cumulative_amount?: number
}

interface CombinedRevenueData {
  date: string
  amount_interview_coder: number
  cumulative_amount_interview_coder: number
  amount_cluely: number
  cumulative_amount_cluely: number
  total_daily_revenue: number
  total_cumulative_revenue: number
}

interface CSVRecord {
  date: string
  daily_revenue_interview_coder: number
  cumulative_revenue_interview_coder: number
  daily_revenue_cluely: number
  cumulative_revenue_cluely: number
  total_daily_revenue: number
  total_cumulative_revenue: number
}

// Helper function to convert UTC timestamp to Pacific Time date string (YYYY-MM-DD)
function convertToPacificTime(timestamp: number): string {
  try {
  // Create a date object from the timestamp (in milliseconds)
  const date = new Date(timestamp * 1000)

    // Validate the date object
    if (isNaN(date.getTime())) {
      console.error(`Invalid timestamp: ${timestamp}`)
      return new Date().toISOString().slice(0, 10) // Fallback to today in ISO format
    }

    // Format the date in Pacific Time and construct YYYY-MM-DD properly
    const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Los_Angeles",
    }).format(date)
    
    // Split MM/DD/YYYY and reconstruct as YYYY-MM-DD
    const parts = formatted.split("/")
    const month = parts[0].padStart(2, "0")
    const day = parts[1].padStart(2, "0") 
    const year = parts[2]
    
    const result = `${year}-${month}-${day}`
    
    // Validate the result format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      console.error(`Invalid date format generated: ${result} from timestamp: ${timestamp}`)
      return new Date().toISOString().slice(0, 10) // Fallback to today in ISO format
    }
    
    return result
  } catch (error) {
    console.error(`Error converting timestamp ${timestamp} to Pacific time:`, error)
    return new Date().toISOString().slice(0, 10) // Fallback to today in ISO format
  }
}

export async function GET() {
  console.log("API: Revenue data request received")

  try {
    // Check if API keys are available for recent data
    if (!process.env.STRIPE_INTERVIEW_CODER || !process.env.STRIPE_CLUELY) {
      console.error("API: Missing Stripe API keys")
      return NextResponse.json(
        {
          error:
            "Please ensure both STRIPE_INTERVIEW_CODER and STRIPE_CLUELY environment variables are set"
        },
        { status: 500 }
      )
    }

    // Read historical data from CSV
    console.log("API: Reading historical data from CSV")
    let historicalData: CombinedRevenueData[] = []

    try {
      // Path to the CSV file - UPDATED to use the new June 14th comprehensive historical data
      const csvPath = path.join(
        process.cwd(),
        "app",
        "api",
        "revenue",
        "revenue_data_jun14th.csv"
      )
      console.log(`API: Attempting to read CSV from ${csvPath}`)

      // Read the CSV file
      const csvContent = fs.readFileSync(csvPath, "utf8")
      console.log(
        `API: Successfully read CSV file (${csvContent.length} bytes)`
      )

      // Parse the CSV content
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
          // Convert numeric strings to numbers
          if (context.header) return value
          return isNaN(Number(value)) ? value : Number(value)
        }
      }) as CSVRecord[]

      console.log(`API: Parsed ${records.length} records from CSV`)

      // Convert CSV records to our data format
      historicalData = records.map((record) => ({
        date: record.date,
        amount_interview_coder: record.daily_revenue_interview_coder,
        cumulative_amount_interview_coder:
          record.cumulative_revenue_interview_coder,
        amount_cluely: record.daily_revenue_cluely,
        cumulative_amount_cluely: record.cumulative_revenue_cluely,
        total_daily_revenue: record.total_daily_revenue,
        total_cumulative_revenue: record.total_cumulative_revenue
      }))

      console.log(
        `API: Successfully converted ${historicalData.length} records to data format`
      )

      // Log the optimization details
      const lastDate =
        historicalData.length > 0
          ? historicalData[historicalData.length - 1].date
          : "N/A"
      console.log(
        `API: 🚀 Using OPTIMIZED approach with comprehensive historical CSV`
      )
      console.log(
        `API: 📊 Historical data covers: ${historicalData.length} days (ending ${lastDate})`
      )
      console.log(
        `API: ⚡ API will only fetch ~1 day of recent data for blazing fast performance!`
      )
    } catch (error) {
      console.error("API: Error reading or parsing CSV:", error)
      return NextResponse.json(
        {
          error:
            "Failed to read historical data: " +
            (error instanceof Error ? error.message : String(error))
        },
        { status: 500 }
      )
    }

    // Create a set of dates that already exist in historical data
    // This will be used to prevent duplicate data
    const existingDates = new Set(historicalData.map((entry) => entry.date))
    console.log(
      `API: Found ${existingDates.size} existing dates in historical data`
    )

    // Get the last date from historical data
    const lastHistoricalDate =
      historicalData.length > 0
        ? new Date(historicalData[historicalData.length - 1].date)
        : new Date("2025-06-01") // Updated fallback to June 1st, 2025 (when new CSV ends)

    // Add one day to get the start date for recent data
    const recentDataStartDate = new Date(lastHistoricalDate)
    recentDataStartDate.setDate(recentDataStartDate.getDate() + 1)
    const recentDataStartTimestamp = Math.floor(
      recentDataStartDate.getTime() / 1000
    )

    console.log(
      `API: Fetching recent data from ${recentDataStartDate.toISOString()} to present (optimized to ~1 day for fast performance)`
    )

    // Get recent revenue data for both accounts
    console.log("API: Fetching Interview Coder recent revenue data...")
    let interviewCoderRevenue: DailyRevenue[] = []
    try {
      interviewCoderRevenue = await getStripeRevenue(
        interviewCoderStripe,
        recentDataStartTimestamp
      )
      // Filter out any dates that already exist in historical data
      interviewCoderRevenue = interviewCoderRevenue.filter(
        (entry) => !existingDates.has(entry.date)
      )
      console.log(
        `API: Filtered Interview Coder revenue to ${interviewCoderRevenue.length} entries after removing duplicates`
      )
    } catch (error) {
      console.error("Error fetching Interview Coder revenue:", error)
      // Continue with empty data instead of failing completely
    }

    console.log("API: Fetching Cluely recent revenue data...")
    let cluelyRevenue: DailyRevenue[] = []
    try {
      cluelyRevenue = await getStripeRevenue(
        cluelyStripe,
        recentDataStartTimestamp
      )
      // Filter out any dates that already exist in historical data
      cluelyRevenue = cluelyRevenue.filter(
        (entry) => !existingDates.has(entry.date)
      )
      console.log(
        `API: Filtered Cluely revenue to ${cluelyRevenue.length} entries after removing duplicates`
      )
    } catch (error) {
      console.error("Error fetching Cluely revenue:", error)
      // Continue with empty data instead of failing completely
    }

    // Get the last cumulative values from historical data
    const lastHistoricalEntry =
      historicalData.length > 0
        ? historicalData[historicalData.length - 1]
        : null
    const lastInterviewCoderCumulative = lastHistoricalEntry
      ? lastHistoricalEntry.cumulative_amount_interview_coder
      : 0
    const lastCluelyCumulative = lastHistoricalEntry
      ? lastHistoricalEntry.cumulative_amount_cluely
      : 0
    const lastTotalCumulative = lastHistoricalEntry
      ? lastHistoricalEntry.total_cumulative_revenue
      : 0

    console.log(
      `API: Starting cumulative values - Interview Coder: $${lastInterviewCoderCumulative}, Cluely: $${lastCluelyCumulative}, Total: $${lastTotalCumulative}`
    )

    // Combine recent data
    console.log("API: Combining recent revenue data...")
    const recentData = combineRecentRevenueData(
      interviewCoderRevenue,
      cluelyRevenue,
      lastInterviewCoderCumulative,
      lastCluelyCumulative,
      lastTotalCumulative
    )

    console.log(`API: Combined ${recentData.length} days of recent data`)

    // Combine historical and recent data
    const combinedData = [...historicalData, ...recentData]

    console.log(
      `API: Final combined data has ${combinedData.length} total days (${historicalData.length} historical + ${recentData.length} recent)`
    )

    if (combinedData.length === 0) {
      console.log("API: No revenue data found")
      return NextResponse.json({
        revenue_data: [],
        today_revenue: {
          interview_coder: 0,
          cluely: 0,
          total: 0
        },
        total_revenue: {
          interview_coder: 0,
          cluely: 0,
          total: 0
        }
      })
    }

    // Get today's revenue with proper date filtering
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const todayDateString = convertToPacificTime(currentTimestamp)
    console.log(`API: Current timestamp: ${currentTimestamp}, Current date object: ${new Date()}, Converted Pacific date: ${todayDateString}`)
    console.log(`API: Looking for today's revenue data for date: ${todayDateString}`)

    // Find today's specific revenue entry
    const todayEntry = combinedData.find(
      (entry) => entry.date === todayDateString
    )
    
    // If today's data isn't available yet, use the most recent entry
    const lastEntry = combinedData[combinedData.length - 1]
    const revenueEntry = todayEntry || lastEntry
    
    const usingTodayData = !!todayEntry
    console.log(
      `API: Using ${
        usingTodayData ? "today's" : "most recent"
      } revenue data from date: ${revenueEntry.date}`
    )
    
    if (!usingTodayData) {
      console.log(
        `API: Today's data (${todayDateString}) not available yet. Using most recent data from ${revenueEntry.date}`
      )
    }

    // Log revenue values for debugging
    console.log(
      `API: Revenue values - Interview Coder: $${revenueEntry.amount_interview_coder}, Cluely: $${revenueEntry.amount_cluely}, Total: $${revenueEntry.total_daily_revenue}`
    )
    console.log(
      `API: Total cumulative revenue - Interview Coder: $${revenueEntry.cumulative_amount_interview_coder}, Cluely: $${revenueEntry.cumulative_amount_cluely}, Grand Total: $${revenueEntry.total_cumulative_revenue}`
    )

    // Prepare the response with better today_revenue handling
    const response = {
      revenue_data: combinedData,
      today_revenue: {
        interview_coder: revenueEntry.amount_interview_coder,
        cluely: revenueEntry.amount_cluely,
        total: revenueEntry.total_daily_revenue,
        date: revenueEntry.date, // Include the date for debugging
        is_today: usingTodayData // Flag to show if this is actually today's data
      },
      total_revenue: {
        interview_coder: revenueEntry.cumulative_amount_interview_coder,
        cluely: revenueEntry.cumulative_amount_cluely,
        total: revenueEntry.total_cumulative_revenue
      }
    }

    console.log("API: Successfully processed revenue data")
    return NextResponse.json(response, {
      headers: {
        // Cache for 2 minutes to reduce API calls on Vercel
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
        "CDN-Cache-Control": "public, max-age=120",
        "Vercel-CDN-Cache-Control": "public, max-age=120"
      }
    })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        error:
          "Failed to fetch revenue data: " +
          (error instanceof Error ? error.message : String(error))
      },
      { status: 500 }
    )
  }
}

// REVERTED: Using the old working logic that only includes positive revenue
async function getStripeRevenue(
  stripeClient: Stripe,
  startTimestamp: number,
  endTimestamp?: number
): Promise<DailyRevenue[]> {
  // Initialize an empty map to store daily revenue
  const dailyRevenueMap = new Map<string, number>()

  console.log(
    `Stripe: Fetching balance transactions from ${new Date(
      startTimestamp * 1000
    ).toISOString()}${
      endTimestamp ? ` to ${new Date(endTimestamp * 1000).toISOString()}` : ""
    }`
  )

  try {
    // Fetch all transactions using our helper function
    const transactions = await fetchAllTransactionsImproved(
      stripeClient,
      startTimestamp,
      endTimestamp
    )

    // Process transactions and aggregate by date using OLD working logic
    for (const transaction of transactions) {
      // Only include positive revenue transactions (OLD LOGIC)
      if (
        transaction.amount > 0 &&
        (transaction.type === "charge" || transaction.type === "payment")
      ) {
        // Convert UTC timestamp to Pacific Time date string (using 'created' not 'available_on')
        const date = convertToPacificTime(transaction.created)

        // Handle currency conversion properly
        const amount =
          transaction.amount /
          (transaction.currency === "jpy" || transaction.currency === "krw"
            ? 1
            : 100)

        // Add to daily revenue map
        dailyRevenueMap.set(date, (dailyRevenueMap.get(date) || 0) + amount)
      }
    }

    console.log(`Stripe: Processed ${transactions.length} total transactions`)

    // Convert map to array and sort by date
    const dailyRevenue: DailyRevenue[] = Array.from(
      dailyRevenueMap.entries()
    ).map(([date, amount]) => ({
      date,
      amount
    }))

    // Sort by date
    dailyRevenue.sort((a, b) => a.date.localeCompare(b.date))

    console.log(
      `Stripe: Found revenue data for ${dailyRevenue.length} unique dates`
    )
    return dailyRevenue
  } catch (error) {
    console.error("Error in getStripeRevenue:", error)
    throw error
  }
}

// IMPROVED: Helper function to fetch all transactions with better filtering - OPTIMIZED for Vercel
async function fetchAllTransactionsImproved(
  stripeClient: Stripe,
  startTimestamp: number,
  endTimestamp?: number,
  maxPages = 20, // CRITICAL FIX: Increased from 8 to 20 to capture all recent transactions and prevent missing revenue data
): Promise<Stripe.BalanceTransaction[]> {
  // Initialize an array to store all transactions
  const allTransactions: Stripe.BalanceTransaction[] = []

  // Prepare parameters for Stripe API
  const params: Stripe.BalanceTransactionListParams = {
    created: {
      gte: startTimestamp,
      ...(endTimestamp && { lte: endTimestamp })
    },
    limit: 100, // Maximum allowed by Stripe
    // Use expand to get more transaction details
    expand: ["data.source"]
  }

  let hasMore = true
  let lastId: string | undefined
  let pageCount = 0

  // Manual pagination with safety limits - OPTIMIZED for Vercel
  while (hasMore && pageCount < maxPages) {
    pageCount++

    try {
      // Add starting_after parameter for pagination if we have a lastId
      if (lastId) {
        params.starting_after = lastId
      }

      // Fetch a page of transactions with reduced timeout for Vercel
      const transactions = (await Promise.race([
        stripeClient.balanceTransactions.list(params),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Stripe API request timed out")),
            10000
          )
        ) // Reduced from 20s to 10s
      ])) as Stripe.ApiList<Stripe.BalanceTransaction>

      // Add transactions to our collection
      allTransactions.push(...transactions.data)

      // Check if there are more transactions to fetch
      hasMore = transactions.has_more

      // Update lastId for the next page if needed
      if (hasMore && transactions.data.length > 0) {
        lastId = transactions.data[transactions.data.length - 1].id
      }

      console.log(
        `Stripe: Fetched page ${pageCount}, got ${transactions.data.length} transactions`
      )

      // Reduced delay for faster processing on Vercel
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 50)) // Reduced from 100ms to 50ms
      }
    } catch (error) {
      console.error(`Error fetching transactions page ${pageCount}:`, error)
      // Break the loop on error
      hasMore = false

      // If we have some data, return what we have instead of failing completely
      if (allTransactions.length > 0) {
        console.log(
          `Stripe: Returning partial data (${allTransactions.length} transactions)`
        )
        return allTransactions
      }

      // Otherwise, propagate the error
      throw error
    }
  }

  if (hasMore && pageCount >= maxPages) {
    console.log(
      `Stripe: Reached maximum page limit (${maxPages}). Returning partial data. Consider increasing limit if total revenue accuracy is affected.`
    )
    console.log(
      `Stripe: WARNING - There may be more transactions available for recent data (last 1 day). Total revenue might be underreported.`
    )
  }

  console.log(
    `Stripe: Fetched a total of ${allTransactions.length} transactions`
  )
  return allTransactions
}

function combineRecentRevenueData(
  interviewCoderRevenue: DailyRevenue[],
  cluelyRevenue: DailyRevenue[],
  lastInterviewCoderCumulative: number,
  lastCluelyCumulative: number,
  lastTotalCumulative: number
): CombinedRevenueData[] {
  // Create a set of all dates
  const allDates = new Set<string>()
  interviewCoderRevenue.forEach((entry) => allDates.add(entry.date))
  cluelyRevenue.forEach((entry) => allDates.add(entry.date))

  // Convert to array and sort
  const sortedDates = Array.from(allDates).sort()

  // Create a map for quick lookup
  const interviewCoderMap = new Map(
    interviewCoderRevenue.map((entry) => [entry.date, entry])
  )
  const cluelyMap = new Map(cluelyRevenue.map((entry) => [entry.date, entry]))

  // Combine the data
  const combinedData: CombinedRevenueData[] = []
  let interviewCoderCumulative = lastInterviewCoderCumulative
  let cluelyCumulative = lastCluelyCumulative
  let totalCumulative = lastTotalCumulative

  for (const date of sortedDates) {
    const interviewCoderEntry = interviewCoderMap.get(date)
    const cluelyEntry = cluelyMap.get(date)

    const interviewCoderAmount = interviewCoderEntry
      ? interviewCoderEntry.amount
      : 0
    const cluelyAmount = cluelyEntry ? cluelyEntry.amount : 0

    interviewCoderCumulative += interviewCoderAmount
    cluelyCumulative += cluelyAmount

    const totalDailyRevenue = interviewCoderAmount + cluelyAmount
    totalCumulative += totalDailyRevenue

    combinedData.push({
      date,
      amount_interview_coder: interviewCoderAmount,
      cumulative_amount_interview_coder: interviewCoderCumulative,
      amount_cluely: cluelyAmount,
      cumulative_amount_cluely: cluelyCumulative,
      total_daily_revenue: totalDailyRevenue,
      total_cumulative_revenue: totalCumulative
    })
  }

  return combinedData
}
