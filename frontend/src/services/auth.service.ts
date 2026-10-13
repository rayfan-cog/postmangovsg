import * as Sentry from '@sentry/browser'
import axios from 'axios'

import { statusErrorHandler } from './error-handler'
import { setGAUserId } from './ga.service'

async function getOtpWithEmail(email: string): Promise<void> {
  try {
    await axios.post('/auth/otp', {
      email,
    })
  } catch (e) {
    statusErrorHandler(e)
  }
}

async function loginWithOtp(email: string, otp: string): Promise<void> {
  try {
    await axios.post('/auth/login', {
      email,
      otp,
    })
  } catch (e) {
    statusErrorHandler(e, {
      400: 'Invalid OTP format, enter an 8-character code',
      401: 'Invalid OTP',
    })
  }
}

// Hands one.gov.sg's redirect params (code, state, iss or error) to the backend
async function loginWithOneGovSg(
  params: Record<string, string>
): Promise<void> {
  try {
    await axios.post('/auth/one-gov-sg/callback', params)
  } catch (e) {
    statusErrorHandler(e)
  }
}

async function getUser(): Promise<
  | {
      email: string
      id: number
      experimental_data: { [key: string]: Record<string, string> }
    }
  | undefined
> {
  try {
    const response = await axios.get('/auth/userinfo')
    return response.data
  } catch (e) {
    console.error(e)
  }
}

// Resolves true if the session was a one.gov.sg login
async function logout(): Promise<boolean> {
  const response = await axios.get('/auth/logout')
  setUserAnalytics(null)
  return !!response.data?.oneGovSg
}

function setUserAnalytics(user?: { email: string; id: number } | null) {
  // set user id to track logged in user
  setGAUserId(user?.id || null)

  Sentry.configureScope((scope) => {
    const scopeUser = user?.email
      ? { email: user?.email, id: `${user?.id}` }
      : null
    scope.setUser(scopeUser)
  })
}

export {
  getOtpWithEmail,
  loginWithOtp,
  loginWithOneGovSg,
  getUser,
  logout,
  setUserAnalytics,
}
