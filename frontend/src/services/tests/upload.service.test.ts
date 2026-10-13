import { rest, server } from 'test-utils'

import { getPresignedUrl } from '../upload.service'

const CAMPAIGN_ID = 1

test('surfaces the CSV validation error for a non-CSV file', async () => {
  const nonCsvFile = new File(['\u0000\u0001\u0002'], 'not-a-csv', {
    type: '',
  })

  await expect(
    getPresignedUrl({ campaignId: CAMPAIGN_ID, uploadedFile: nonCsvFile })
  ).rejects.toThrow('Please make sure you are uploading a file in CSV format.')
})

test('surfaces the API error message when starting the upload fails', async () => {
  server.use(
    rest.get('/campaign/:campaignId/upload/start', (_req, res, ctx) =>
      res(ctx.status(400), ctx.json({ message: 'Upload start failed' }))
    )
  )
  const csvFile = new File(['recipient\nhello@example.com'], 'file.csv', {
    type: 'text/csv',
  })

  await expect(
    getPresignedUrl({ campaignId: CAMPAIGN_ID, uploadedFile: csvFile })
  ).rejects.toThrow('Upload start failed')
})
