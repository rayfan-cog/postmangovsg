import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { SMSCampaign, SMSPreview } from 'classes'
import useCsvUpload from 'components/custom-hooks/use-csv-upload'
import CampaignContextProvider from 'contexts/campaign.context'
import { sendTiming } from 'services/ga.service'
import {
  act,
  Campaign,
  INVALID_CSV_FILENAME,
  INVALID_MOBILE_CSV_FILE,
  mockCommonApis,
  renderHook,
  server,
  VALID_CSV_FILENAME,
  VALID_MOBILE_CSV_FILE,
  waitFor,
} from 'test-utils'

jest.mock('services/ga.service', () => ({
  ...jest.requireActual('services/ga.service'),
  sendTiming: jest.fn(),
}))

const TEST_SMS_CAMPAIGN: Campaign = {
  id: 1,
  name: 'Test SMS campaign',
  type: 'SMS',
  created_at: new Date(),
  valid: false,
  protect: false,
  demo_message_limit: null,
  csv_filename: null,
  is_csv_processing: false,
  num_recipients: null,
  job_queue: [],
  halted: false,
  sms_templates: {
    body: 'Test body',
    params: [],
  },
  has_credential: false,
}

function toFileList(file: File): FileList {
  return {
    0: file,
    length: 1,
    item: () => file,
  } as unknown as FileList
}

async function renderCsvUpload() {
  const { handlers } = mockCommonApis({
    curUserId: 1,
    campaigns: [{ ...TEST_SMS_CAMPAIGN }],
  })
  server.use(...handlers)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/campaigns/1']}>
      <Routes>
        <Route
          path="/campaigns/:id"
          element={
            <CampaignContextProvider
              initialCampaign={new SMSCampaign({ ...TEST_SMS_CAMPAIGN })}
            >
              {children}
            </CampaignContextProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  )

  const hook = renderHook(() => useCsvUpload({} as SMSPreview), { wrapper })
  // Wait for the initial status poll to populate the preview
  await waitFor(() => expect(hook.result.current.preview.body).toBe('Test body'))
  return hook
}

beforeEach(() => {
  jest.mocked(sendTiming).mockClear()
})

test('uploads a file, records upload timing and refreshes csv status', async () => {
  const { result } = await renderCsvUpload()

  await act(() => result.current.uploadFile(toFileList(VALID_MOBILE_CSV_FILE)))

  expect(sendTiming).toHaveBeenCalledWith(
    'Contacts file',
    'upload',
    expect.any(Number)
  )
  await waitFor(() =>
    expect(result.current.csvInfo).toMatchObject({
      csvFilename: VALID_CSV_FILENAME,
      numRecipients: 1,
    })
  )
  expect(result.current.isCsvProcessing).toBe(false)
  expect(result.current.isUploading).toBe(false)
  expect(result.current.errorMessage).toBeNull()
})

test('clearing csv status removes only the csv error', async () => {
  const { result } = await renderCsvUpload()

  await act(() =>
    result.current.uploadFile(toFileList(INVALID_MOBILE_CSV_FILE))
  )
  await waitFor(() =>
    expect(result.current.csvInfo.csvError).toBe(
      'Error: invalid recipient file'
    )
  )

  act(() => result.current.clearCsvStatus())

  expect(result.current.csvInfo.csvError).toBeUndefined()
  expect(result.current.csvInfo.tempCsvFilename).toBe(INVALID_CSV_FILENAME)
})
