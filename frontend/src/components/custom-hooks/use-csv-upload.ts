import { useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import useIsMounted from 'components/custom-hooks/use-is-mounted'
import { CampaignContext } from 'contexts/campaign.context'
import { sendTiming } from 'services/ga.service'
import {
  CsvStatusResponse,
  deleteCsvStatus,
  getCsvStatus,
  uploadFileToS3,
} from 'services/upload.service'

export type CsvInfo = Omit<CsvStatusResponse, 'isCsvProcessing' | 'preview'>

function useCsvUpload<P>(
  initialPreview: P,
  {
    onFileSelected,
    forceReset,
  }: {
    onFileSelected?: (campaignId: number, file: File) => Promise<any>
    forceReset?: boolean // skip polling and reset csv info to only the filename
  } = {}
) {
  const { campaign, updateCampaign } = useContext(CampaignContext)
  const {
    isCsvProcessing: initialIsProcessing,
    numRecipients: initialNumRecipients,
    csvFilename: initialCsvFilename,
  } = campaign
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCsvProcessing, setIsCsvProcessing] = useState(initialIsProcessing)
  const [isUploading, setIsUploading] = useState(false)
  const [csvInfo, setCsvInfo] = useState<CsvInfo>({
    numRecipients: initialNumRecipients,
    csvFilename: initialCsvFilename,
  })
  const [preview, setPreview] = useState<P>(initialPreview)
  const { id: campaignId } = useParams<{ id: string }>()
  const { csvFilename, numRecipients = 0 } = csvInfo
  const isMounted = useIsMounted()

  // Poll csv status
  useEffect(() => {
    if (!campaignId) return

    let timeoutId: NodeJS.Timeout
    const pollStatus = async () => {
      try {
        if (forceReset) {
          setCsvInfo(({ csvFilename }) => ({ csvFilename }))
          return
        }
        const { isCsvProcessing, preview, ...newCsvInfo } = await getCsvStatus(
          +campaignId
        )
        // Prevent setting state if unmounted
        if (!isMounted.current) return

        setIsCsvProcessing(isCsvProcessing)
        setCsvInfo(newCsvInfo)
        if (preview) {
          setPreview(preview as P)
        }
        if (isCsvProcessing) {
          timeoutId = setTimeout(pollStatus, 2000)
        }
      } catch (e) {
        setErrorMessage((e as Error).message)
      }
    }

    // Retrieve status regardless of isCsvProcessing to retrieve csvError if any
    // If completed, it will only poll once
    void pollStatus()

    return () => clearTimeout(timeoutId)
  }, [campaignId, forceReset, isCsvProcessing, isMounted])

  // If campaign properties change, bubble up to root campaign object
  useEffect(() => {
    updateCampaign({
      isCsvProcessing,
      csvFilename,
      numRecipients,
    })
  }, [isCsvProcessing, csvFilename, numRecipients, updateCampaign])

  // Handle file upload
  async function uploadFile(files: FileList) {
    setIsUploading(true)
    setErrorMessage(null)
    const uploadTimeStart = performance.now()

    try {
      // user did not select a file
      if (!files[0] || !campaignId) {
        return
      }
      clearCsvStatus()
      await (onFileSelected || uploadFileToS3)(+campaignId, files[0])

      const uploadTimeEnd = performance.now()
      sendTiming('Contacts file', 'upload', uploadTimeEnd - uploadTimeStart)

      // Prevent setting state if unmounted
      if (!isMounted.current) {
        return
      }

      setIsCsvProcessing(true)
      setCsvInfo((info) => ({ ...info, tempCsvFilename: files[0].name }))
    } catch (err) {
      setErrorMessage((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  // Hide csv error from previous upload and delete from db
  function clearCsvStatus() {
    if (campaignId) {
      setCsvInfo((info) => ({ ...info, csvError: undefined }))
      void deleteCsvStatus(+campaignId)
    }
  }

  return {
    csvInfo,
    isCsvProcessing,
    isUploading,
    preview,
    errorMessage,
    setErrorMessage,
    uploadFile,
    clearCsvStatus,
  }
}

export default useCsvUpload
