'use server';

import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import { createClient } from '@/utils/supabase/server';
import { createOrRetrieveCustomer, generateOrderId } from '@/utils/supabase/admin';
import {
  getURL,
  getErrorRedirect,
  calculateTrialEndUnixTimestamp
} from '@/utils/helpers';
import { Tables } from '@/types_db';
import { PayHerePaymentRequest } from '../payhere/types/payhere.types';

import md5 from 'crypto-js/md5';
type Price = Tables<'prices'>;

type CheckoutResponse = {
  errorRedirect?: string;
  // sessionId?: string;
  returnData?: PayHerePaymentRequest;
};








export async function checkoutWithStripe(
  price: Price,
  redirectPath: string = '/account'
): Promise<CheckoutResponse> {
  try {
    // Get the user from Supabase auth
    const supabase = createClient();
    const {
      error,
      data: { user }
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error(error);
      throw new Error('Could not get user session.');
    }

    // Retrieve or create the customer in Stripe
    // let customer: string;

    // try {
    //   customer = await createOrRetrieveCustomer({
    //     uuid: user?.id || '',
    //     email: user?.email || ''
    //   });
    // } catch (err) {
    //   console.error(err);
    //   throw new Error('Unable to access customer record.');
    // }

    let merchent_secret = process.env.PAYHERE_MERCHANT_SECRET || 'MzM3NTYxOTc4MTQwMzA3MTg4MjgzNzAwODMwNzk0MTA2MDc3NDQzNg==';
    let merchent_id = process.env.PAYHERE_MERCHANT_ID || '1225269';
    let order_id = generateOrderId();
    let amount = price.unit_amount || 100.00;
    let hashedSecret = md5(merchent_secret).toString().toUpperCase();
    let amountFormated = parseFloat(amount.toString()).toLocaleString('en-us', { minimumFractionDigits: 2 }).replaceAll(',', '');
    let currency = price.currency || 'USD';
    console.log(merchent_id + order_id + amountFormated + currency + hashedSecret);

    console.log(merchent_secret)
    let hash = md5(merchent_id + order_id + amountFormated + currency + hashedSecret).toString().toUpperCase();




    let payhereParams: PayHerePaymentRequest = {
      merchant_id: process.env.PAYHERE_MERCHANT_ID || '1225269',
      return_url: getURL('/account'),
      cancel_url: getURL(),
      notify_url: getURL('/api/payhere/webhook'),
      first_name: 'John',
      last_name: 'Doe',
      email: user.email || '',
      phone: '',
      address: '',
      city: '',
      country: '',
      order_id: order_id || '',
      items: price.product_id || '',
      currency: price.currency || 'USD',
      recurrence: (price.interval_count && price.interval ? price.interval_count + ' ' + price.interval.charAt(0).toUpperCase() + price.interval.slice(1) : ''),
      duration: (price.interval_count && price.interval ? price.interval_count + ' ' + price.interval.charAt(0).toUpperCase() + price.interval.slice(1) : ''),
      amount: amount.toString() || "999",
      hash: hash,
    }


    return {
      returnData: payhereParams
    };

    // let params: Stripe.Checkout.SessionCreateParams = {
    //   allow_promotion_codes: true,
    //   billing_address_collection: 'required',
    //   customer,
    //   customer_update: {
    //     address: 'auto'
    //   },
    //   line_items: [
    //     {
    //       price: price.id,
    //       quantity: 1
    //     }
    //   ],
    //   cancel_url: getURL(),
    //   success_url: getURL(redirectPath)
    // };

    // console.log(
    //   'Trial end:',
    //   calculateTrialEndUnixTimestamp(price.trial_period_days)
    // );
    // if (price.type === 'recurring') {
    //   params = {
    //     ...params,
    //     mode: 'subscription',
    //     subscription_data: {
    //       trial_end: calculateTrialEndUnixTimestamp(price.trial_period_days)
    //     }
    //   };
    // } else if (price.type === 'one_time') {
    //   params = {
    //     ...params,
    //     mode: 'payment'
    //   };
    // }

    // Create a checkout session in Stripe
    // let session;
    // try {
    //   session = await stripe.checkout.sessions.create(params);
    // } catch (err) {
    //   console.error(err);
    //   throw new Error('Unable to create checkout session.');
    // }

    // // Instead of returning a Response, just return the data or error.
    // if (session) {
    //   return { sessionId: session.id };
    // } else {
    //   throw new Error('Unable to create checkout session.');
    // }









  } catch (error) {
    if (error instanceof Error) {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          error.message,
          'Please try again later or contact a system administrator.'
        )
      };
    } else {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      };
    }
  }
}

export async function createStripePortal(currentPath: string) {
  try {
    const supabase = createClient();
    const {
      error,
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      if (error) {
        console.error(error);
      }
      throw new Error('Could not get user session.');
    }

    let customer;
    try {
      customer = await createOrRetrieveCustomer({
        uuid: user.id || '',
        email: user.email || ''
      });
    } catch (err) {
      console.error(err);
      throw new Error('Unable to access customer record.');
    }

    if (!customer) {
      throw new Error('Could not get customer.');
    }

    try {
      const { url } = await stripe.billingPortal.sessions.create({
        customer,
        return_url: getURL('/account')
      });
      if (!url) {
        throw new Error('Could not create billing portal');
      }
      return url;
    } catch (err) {
      console.error(err);
      throw new Error('Could not create billing portal');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return getErrorRedirect(
        currentPath,
        error.message,
        'Please try again later or contact a system administrator.'
      );
    } else {
      return getErrorRedirect(
        currentPath,
        'An unknown error occurred.',
        'Please try again later or contact a system administrator.'
      );
    }
  }
}
