import axios from 'axios'

import { errorHandler } from './error-handler'

export async function unsubscribeRequest({
  campaignId,
  recipient,
  hash,
  version,
  reason,
}: {
  campaignId: number
  recipient: string
  hash: string
  version: string
  reason: string
}): Promise<void> {
  try {
    recipient = window.encodeURIComponent(recipient)
    await axios.put(`/unsubscribe/${campaignId}/${recipient}`, {
      h: hash,
      v: version,
      reason,
    })
    return
  } catch (e) {
    errorHandler(e, 'Error unsubscribing')
  }
}

export async function subscribeAgain({
  campaignId,
  recipient,
  hash,
  version,
}: {
  campaignId: number
  recipient: string
  hash: string
  version: string
}): Promise<void> {
  try {
    recipient = window.encodeURIComponent(recipient)
    await axios.delete(`/unsubscribe/${campaignId}/${recipient}`, {
      data: {
        h: hash,
        v: version,
      },
    })
    return
  } catch (e) {
    errorHandler(e, 'Error unsubscribing')
  }
}
