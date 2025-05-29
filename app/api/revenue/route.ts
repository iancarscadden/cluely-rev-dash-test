import { NextResponse } from "next/server"
import Stripe from "stripe"
import { parse } from "csv-parse/sync"
import fs from "fs"
import path from "path"

// Initialize Stripe clients with timeout
const interviewCoderStripe = new Stripe(process.env.STRIPE_INTERVIEW_CODER || "", {
  apiVersion: "2023-10-16",
  timeout: 30000, // 30 second timeout
})

const cluelyStripe = new Stripe(process.env.STRIPE_CLUELY || "", {
  apiVersion: "2023-10-16",
  timeout: 30000, // 30 second timeout
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
  // Create a date object from the timestamp (in milliseconds)
  const date = new Date(timestamp * 1000)

  // Format the date in Pacific Time
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Los_Angeles",
  })
    .format(date)
    .split("/")
    .map((part, index) => {
      // Convert MM/DD/YYYY to YYYY-MM-DD
      if (index === 0) return part.padStart(2, "0") // month
      if (index === 1) return part.padStart(2, "0") // day
      return part // year
    })
    .reverse()
    .join("-")
}

export async function GET() {
  console.log("API: Revenue data request received")

  try {
    // Check if API keys are available for recent data
    if (!process.env.STRIPE_INTERVIEW_CODER || !process.env.STRIPE_CLUELY) {
      console.error("API: Missing Stripe API keys")
      return NextResponse.json(
        { error: "Please ensure both STRIPE_INTERVIEW_CODER and STRIPE_CLUELY environment variables are set" },
        { status: 500 },
      )
    }

    // Read historical data from CSV
    console.log("API: Reading historical data from CSV")
    let historicalData: CombinedRevenueData[] = []

    try {
      // Path to the CSV file
      const csvPath = path.join(process.cwd(), "app", "api", "revenue", "revenue_data_20250517_225551.csv")
      console.log(`API: Attempting to read CSV from ${csvPath}`)

      // Read the CSV file
      const csvContent = fs.readFileSync(csvPath, "utf8")
      console.log(`API: Successfully read CSV file (${csvContent.length} bytes)`)

      // Parse the CSV content
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
          // Convert numeric strings to numbers
          if (context.header) return value
          return isNaN(Number(value)) ? value : Number(value)
        },
      }) as CSVRecord[]

      console.log(`API: Parsed ${records.length} records from CSV`)

      // Convert CSV records to our data format
      historicalData = records.map((record) => ({
        date: record.date,
        amount_interview_coder: record.daily_revenue_interview_coder,
        cumulative_amount_interview_coder: record.cumulative_revenue_interview_coder,
        amount_cluely: record.daily_revenue_cluely,
        cumulative_amount_cluely: record.cumulative_revenue_cluely,
        total_daily_revenue: record.total_daily_revenue,
        total_cumulative_revenue: record.total_cumulative_revenue,
      }))

      console.log(`API: Successfully converted ${historicalData.length} records to data format`)
    } catch (error) {
      console.error("API: Error reading or parsing CSV:", error)
      return NextResponse.json(
        { error: "Failed to read historical data: " + (error instanceof Error ? error.message : String(error)) },
        { status: 500 },
      )
    }

    // Create a set of dates that already exist in historical data
    // This will be used to prevent duplicate data
    const existingDates = new Set(historicalData.map((entry) => entry.date))
    console.log(`API: Found ${existingDates.size} existing dates in historical data`)

    // Get the last date from historical data
    const lastHistoricalDate =
      historicalData.length > 0 ? new Date(historicalData[historicalData.length - 1].date) : new Date("2025-05-16") // Fallback to May 16th, 2025

    // Add one day to get the start date for recent data
    const recentDataStartDate = new Date(lastHistoricalDate)
    recentDataStartDate.setDate(recentDataStartDate.getDate() + 1)
    const recentDataStartTimestamp = Math.floor(recentDataStartDate.getTime() / 1000)

    console.log(`API: Fetching recent data from ${recentDataStartDate.toISOString()} to present`)

    // Get recent revenue data for both accounts
    console.log("API: Fetching Interview Coder recent revenue data...")
    let interviewCoderRevenue: DailyRevenue[] = []
    try {
      interviewCoderRevenue = await getStripeRevenue(interviewCoderStripe, recentDataStartTimestamp)
      // Filter out any dates that already exist in historical data
      interviewCoderRevenue = interviewCoderRevenue.filter((entry) => !existingDates.has(entry.date))
      console.log(
        `API: Filtered Interview Coder revenue to ${interviewCoderRevenue.length} entries after removing duplicates`,
      )
    } catch (error) {
      console.error("Error fetching Interview Coder revenue:", error)
      // Continue with empty data instead of failing completely
    }

    console.log("API: Fetching Cluely recent revenue data...")
    let cluelyRevenue: DailyRevenue[] = []
    try {
      cluelyRevenue = await getStripeRevenue(cluelyStripe, recentDataStartTimestamp)
      // Filter out any dates that already exist in historical data
      cluelyRevenue = cluelyRevenue.filter((entry) => !existingDates.has(entry.date))
      console.log(`API: Filtered Cluely revenue to ${cluelyRevenue.length} entries after removing duplicates`)
    } catch (error) {
      console.error("Error fetching Cluely revenue:", error)
      // Continue with empty data instead of failing completely
    }

    // Get the last cumulative values from historical data
    const lastHistoricalEntry = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null
    const lastInterviewCoderCumulative = lastHistoricalEntry ? lastHistoricalEntry.cumulative_amount_interview_coder : 0
    const lastCluelyCumulative = lastHistoricalEntry ? lastHistoricalEntry.cumulative_amount_cluely : 0
    const lastTotalCumulative = lastHistoricalEntry ? lastHistoricalEntry.total_cumulative_revenue : 0

    // Combine recent data
    console.log("API: Combining recent revenue data...")
    const recentData = combineRecentRevenueData(
      interviewCoderRevenue,
      cluelyRevenue,
      lastInterviewCoderCumulative,
      lastCluelyCumulative,
      lastTotalCumulative,
    )

    // Combine historical and recent data
    const combinedData = [...historicalData, ...recentData]

    if (combinedData.length === 0) {
      console.log("API: No revenue data found")
      return NextResponse.json({
        revenue_data: [],
        today_revenue: {
          interview_coder: 0,
          cluely: 0,
          total: 0,
        },
        total_revenue: {
          interview_coder: 0,
          cluely: 0,
          total: 0,
        },
      })
    }

    // Get today's revenue or the last day's revenue
    const lastEntry = combinedData[combinedData.length - 1]

    // Prepare the response
    const response = {
      revenue_data: combinedData,
      today_revenue: {
        interview_coder: lastEntry.amount_interview_coder,
        cluely: lastEntry.amount_cluely,
        total: lastEntry.total_daily_revenue,
      },
      total_revenue: {
        interview_coder: lastEntry.cumulative_amount_interview_coder,
        cluely: lastEntry.cumulative_amount_cluely,
        total: lastEntry.total_cumulative_revenue,
      },
    }

    console.log("API: Successfully processed revenue data")
    return NextResponse.json(response)
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch revenue data: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

async function getStripeRevenue(
  stripeClient: Stripe,
  startTimestamp: number,
  endTimestamp?: number,
): Promise<DailyRevenue[]> {
  // Initialize an empty map to store daily revenue
  const dailyRevenueMap = new Map<string, number>()

  console.log(
    `Stripe: Fetching balance transactions from ${new Date(startTimestamp * 1000).toISOString()}${
      endTimestamp ? ` to ${new Date(endTimestamp * 1000).toISOString()}` : ""
    }`,
  )

  try {
    // Fetch all transactions using our helper function
    const transactions = await fetchAllTransactions(stripeClient, startTimestamp, endTimestamp)

    // Process transactions and aggregate by date
    for (const transaction of transactions) {
      // Only include positive revenue transactions
      if (transaction.amount > 0 && (transaction.type === "charge" || transaction.type === "payment")) {
        // Convert UTC timestamp to Pacific Time date string
        const date = convertToPacificTime(transaction.created)

        // Handle currency conversion properly
        const amount = transaction.amount / (transaction.currency === "jpy" || transaction.currency === "krw" ? 1 : 100)

        // Add to daily revenue map
        dailyRevenueMap.set(date, (dailyRevenueMap.get(date) || 0) + amount)
      }
    }

    console.log(`Stripe: Processed ${transactions.length} total transactions`)

    // Convert map to array and sort by date
    const dailyRevenue: DailyRevenue[] = Array.from(dailyRevenueMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }))

    // Sort by date
    dailyRevenue.sort((a, b) => a.date.localeCompare(b.date))

    console.log(`Stripe: Found revenue data for ${dailyRevenue.length} unique dates`)
    return dailyRevenue
  } catch (error) {
    console.error("Error in getStripeRevenue:", error)
    throw error
  }
}

// Helper function to fetch all transactions with pagination
async function fetchAllTransactions(
  stripeClient: Stripe,
  startTimestamp: number,
  endTimestamp?: number,
  maxPages = 10, // Limit the number of pages to avoid excessive API calls
): Promise<Stripe.BalanceTransaction[]> {
  // Initialize an array to store all transactions
  const allTransactions: Stripe.BalanceTransaction[] = []

  // Prepare parameters for Stripe API
  const params: Stripe.BalanceTransactionListParams = {
    created: {
      gte: startTimestamp,
    },
    limit: 100, // Maximum allowed by Stripe
  }

  if (endTimestamp) {
    params.created.lte = endTimestamp
  }

  let hasMore = true
  let lastId: string | undefined
  let pageCount = 0

  // Manual pagination with safety limits
  while (hasMore && pageCount < maxPages) {
    pageCount++

    try {
      // Add starting_after parameter for pagination if we have a lastId
      if (lastId) {
        params.starting_after = lastId
      }

      // Fetch a page of transactions with timeout handling
      const transactions = (await Promise.race([
        stripeClient.balanceTransactions.list(params),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Stripe API request timed out")), 15000)),
      ])) as Stripe.ApiList<Stripe.BalanceTransaction>

      // Add transactions to our collection
      allTransactions.push(...transactions.data)

      // Check if there are more transactions to fetch
      hasMore = transactions.has_more

      // Update lastId for the next page if needed
      if (hasMore && transactions.data.length > 0) {
        lastId = transactions.data[transactions.data.length - 1].id
      }

      console.log(`Stripe: Fetched page ${pageCount}, got ${transactions.data.length} transactions`)

      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`Error fetching transactions page ${pageCount}:`, error)
      // Break the loop on error
      hasMore = false

      // If we have some data, return what we have instead of failing completely
      if (allTransactions.length > 0) {
        console.log(`Stripe: Returning partial data (${allTransactions.length} transactions)`)
        return allTransactions
      }

      // Otherwise, propagate the error
      throw error
    }
  }

  if (hasMore && pageCount >= maxPages) {
    console.log(`Stripe: Reached maximum page limit (${maxPages}). Returning partial data.`)
  }

  console.log(`Stripe: Fetched a total of ${allTransactions.length} transactions`)
  return allTransactions
}

function combineRecentRevenueData(
  interviewCoderRevenue: DailyRevenue[],
  cluelyRevenue: DailyRevenue[],
  lastInterviewCoderCumulative: number,
  lastCluelyCumulative: number,
  lastTotalCumulative: number,
): CombinedRevenueData[] {
  // Create a set of all dates
  const allDates = new Set<string>()
  interviewCoderRevenue.forEach((entry) => allDates.add(entry.date))
  cluelyRevenue.forEach((entry) => allDates.add(entry.date))

  // Convert to array and sort
  const sortedDates = Array.from(allDates).sort()

  // Create a map for quick lookup
  const interviewCoderMap = new Map(interviewCoderRevenue.map((entry) => [entry.date, entry]))
  const cluelyMap = new Map(cluelyRevenue.map((entry) => [entry.date, entry]))

  // Combine the data
  const combinedData: CombinedRevenueData[] = []
  let interviewCoderCumulative = lastInterviewCoderCumulative
  let cluelyCumulative = lastCluelyCumulative
  let totalCumulative = lastTotalCumulative

  for (const date of sortedDates) {
    const interviewCoderEntry = interviewCoderMap.get(date)
    const cluelyEntry = cluelyMap.get(date)

    const interviewCoderAmount = interviewCoderEntry ? interviewCoderEntry.amount : 0
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
      total_cumulative_revenue: totalCumulative,
    })
  }

  return combinedData
}
