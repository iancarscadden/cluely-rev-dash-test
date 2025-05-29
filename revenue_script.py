import os
import stripe
import json
import argparse
from datetime import datetime, timedelta
import pandas as pd
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv()

def get_stripe_revenue(api_key, start_date, end_date=None):
    """Fetch revenue data from Stripe for a given account using BalanceTransaction."""
    stripe.api_key = api_key

    # Initialize an empty list to store daily revenue
    daily_revenue = []

    if not end_date:
        print(" Fetching balance transactions from Stripe API...")

    # Get all balance transactions from the start date
    params = {
        'created': {
            'gte': int(start_date.timestamp())
        },
        'limit': 1000  # Maximum allowed by Stripe
    }

    if end_date:
        params['created']['lte'] = int(end_date.timestamp())

    transactions = stripe.BalanceTransaction.list(**params)

    # Process transactions and aggregate by date
    transaction_count = 0
    if not end_date:
        print(" Processing transactions...")
    for transaction in transactions.auto_paging_iter():
        transaction_count += 1
        if transaction_count % 1000 == 0 and not end_date:
            print(f" Processed {transaction_count} transactions so far...")

        # Only include positive revenue transactions
        if (transaction.status == 'available' and 
            transaction.amount > 0 and 
            transaction.type in ['charge', 'payment']):  # Only include actual payments
            
            date = datetime.fromtimestamp(transaction.created).date()
            amount = transaction.amount / 100  # Convert from cents to dollars
            
            # Find if we already have an entry for this date
            found = False
            for entry in daily_revenue:
                if entry['date'] == date.isoformat():
                    entry['amount'] += amount
                    found = True
                    break
            
            if not found:
                daily_revenue.append({
                    'date': date.isoformat(),
                    'amount': amount
                })
    if not end_date:
        print(f" Completed processing {transaction_count} total transactions")

    # Convert to DataFrame and sort by date
    df = pd.DataFrame(daily_revenue)
    if not df.empty:
        df = df.sort_values('date')
        df['cumulative_amount'] = df['amount'].cumsum()
        if not end_date:
            print(f" Found revenue data for {len(df)} unique dates")
    elif not end_date:
        print(" No revenue data found for this period")

    return df

def get_current_month_revenue(api_key):
    """Fetch revenue data for the current month to calculate current ARR."""
    now = datetime.now()
    thirty_one_days_ago = now - timedelta(days=31)

    print(f" Fetching current revenue (from {thirty_one_days_ago.strftime('%Y-%m-%d %H:%M:%S')} to {now.strftime('%Y-%m-%d %H:%M:%S')})...")
    return get_stripe_revenue(api_key, thirty_one_days_ago, now)

def calculate_arr(df):
    """Calculate ARR based on the last month's revenue."""
    if df.empty:
        return 0

    # Calculate monthly revenue
    monthly_revenue = df['amount'].sum()

    # Calculate ARR (monthly revenue * 12)
    arr = monthly_revenue * 12

    return arr

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Fetch and display revenue data from Stripe')
    parser.add_argument('--json', action='store_true', help='Output data as JSON')
    args = parser.parse_args()

    # Get API keys from environment variables
    interview_coder_key = os.getenv('STRIPE_INTERVIEW_CODER')
    cluely_key = os.getenv('STRIPE_CLUELY')

    if not interview_coder_key or not cluely_key:
        error_msg = "Error: Please ensure both STRIPE_INTERVIEW_CODER and STRIPE_CLUELY environment variables are set"
        if args.json:
            print(json.dumps({"error": error_msg}))
        else:
            print(error_msg)
        return

    # Set start date to January 1st of current year
    start_date = datetime(datetime.now().year, 1, 1)

    # Get revenue data for both accounts
    if not args.json:
        print("\nFetching revenue data for Interview Coder account...")
    interview_coder_revenue = get_stripe_revenue(interview_coder_key, start_date)

    if not args.json:
        print("\nFetching revenue data for Cluely account...")
    cluely_revenue = get_stripe_revenue(cluely_key, start_date)

    # Get current month's revenue for ARR calculation
    if not args.json:
        print("\nFetching current revenue for Interview Coder...")
    current_month_interview_coder = get_current_month_revenue(interview_coder_key)

    if not args.json:
        print("\nFetching current revenue for Cluely...")
    current_month_cluely = get_current_month_revenue(cluely_key)

    # Create a combined DataFrame for comparison
    if not interview_coder_revenue.empty and not cluely_revenue.empty:
        if not args.json:
            print("\nCombining and formatting data...")
        
        # Convert date strings to datetime for merging
        interview_coder_revenue['date'] = pd.to_datetime(interview_coder_revenue['date'])
        cluely_revenue['date'] = pd.to_datetime(cluely_revenue['date'])
        
        combined_df = pd.merge(
            interview_coder_revenue,
            cluely_revenue,
            on='date',
            how='outer',
            suffixes=('_interview_coder', '_cluely')
        ).fillna(0)

        # Sort by date
        combined_df = combined_df.sort_values('date')

        # Calculate total revenue for each day
        combined_df['total_daily_revenue'] = combined_df['amount_interview_coder'] + combined_df['amount_cluely']
        combined_df['total_cumulative_revenue'] = combined_df['total_daily_revenue'].cumsum()

        # Calculate ARR for each account using current month's data
        interview_coder_arr = calculate_arr(current_month_interview_coder)
        cluely_arr = calculate_arr(current_month_cluely)
        total_arr = interview_coder_arr + cluely_arr

        if args.json:
            # Prepare data for JSON output
            result = {
                'revenue_data': combined_df.to_dict(orient='records'),
                'arr': {
                    'interview_coder': float(interview_coder_arr),
                    'cluely': float(cluely_arr),
                    'total': float(total_arr)
                },
                'today_revenue': {
                    'interview_coder': float(combined_df.iloc[-1]['amount_interview_coder']) if len(combined_df) > 0 else 0,
                    'cluely': float(combined_df.iloc[-1]['amount_cluely']) if len(combined_df) > 0 else 0,
                    'total': float(combined_df.iloc[-1]['total_daily_revenue']) if len(combined_df) > 0 else 0
                },
                'total_revenue': {
                    'interview_coder': float(combined_df.iloc[-1]['cumulative_amount_interview_coder']) if len(combined_df) > 0 else 0,
                    'cluely': float(combined_df.iloc[-1]['cumulative_amount_cluely']) if len(combined_df) > 0 else 0,
                    'total': float(combined_df.iloc[-1]['total_cumulative_revenue']) if len(combined_df) > 0 else 0
                }
            }
            print(json.dumps(result))
        else:
            # Format the output for display
            combined_df['date'] = combined_df['date'].dt.strftime('%Y-%m-%d')
            combined_df['amount_interview_coder'] = combined_df['amount_interview_coder'].map('${:,.2f}'.format)
            combined_df['amount_cluely'] = combined_df['amount_cluely'].map('${:,.2f}'.format)
            combined_df['cumulative_amount_interview_coder'] = combined_df['cumulative_amount_interview_coder'].map('${:,.2f}'.format)
            combined_df['cumulative_amount_cluely'] = combined_df['cumulative_amount_cluely'].map('${:,.2f}'.format)
            combined_df['total_daily_revenue'] = combined_df['total_daily_revenue'].map('${:,.2f}'.format)
            combined_df['total_cumulative_revenue'] = combined_df['total_cumulative_revenue'].map('${:,.2f}'.format)

            # Rename columns for display
            combined_df.columns = [
                'Date',
                'Daily Revenue (Interview Coder)',
                'Cumulative Revenue (Interview Coder)',
                'Daily Revenue (Cluely)',
                'Cumulative Revenue (Cluely)',
                'Total Daily Revenue',
                'Total Cumulative Revenue'
            ]

            # Print the results
            print("\nRevenue Comparison:")
            print(tabulate(combined_df, headers='keys', tablefmt='grid', showindex=False))

            # Print ARR information
            print("\nCurrent ARR (Annual Recurring Revenue) based on last 31 days:")
            print(f"Interview Coder ARR: ${interview_coder_arr:,.2f}")
            print(f"Cluely ARR: ${cluely_arr:,.2f}")
            print(f"Total ARR: ${total_arr:,.2f}")
    else:
        error_msg = "No revenue data found for one or both accounts"
        if args.json:
            print(json.dumps({"error": error_msg}))
        else:
            print(error_msg)

if __name__ == "__main__":
    main()
