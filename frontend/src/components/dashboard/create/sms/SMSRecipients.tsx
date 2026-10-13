import { i18n } from '@lingui/core'

import type { Dispatch, SetStateAction } from 'react'
import { useContext } from 'react'

import { OutboundLink } from 'react-ga'

import styles from '../Create.module.scss'

import type { SMSCampaign, SMSPreview, SMSProgress } from 'classes'
import {
  ButtonGroup,
  CsvUpload,
  ErrorBlock,
  FileInput,
  InfoBlock,
  NextButton,
  PreviewBlock,
  SampleCsv,
  StepHeader,
  StepSection,
  TextButton,
  WarningBlock,
} from 'components/common'
import useCsvUpload from 'components/custom-hooks/use-csv-upload'
import { LINKS } from 'config'
import { CampaignContext } from 'contexts/campaign.context'

const SMSRecipients = ({
  setActiveStep,
}: {
  setActiveStep: Dispatch<SetStateAction<SMSProgress>>
}) => {
  const { campaign } = useContext(CampaignContext)
  const { demoMessageLimit, params } = campaign as SMSCampaign
  const isDemo = !!demoMessageLimit

  const {
    csvInfo,
    isCsvProcessing,
    isUploading,
    preview,
    errorMessage,
    setErrorMessage,
    uploadFile,
    clearCsvStatus,
  } = useCsvUpload({} as SMSPreview)
  const { csvFilename, numRecipients = 0 } = csvInfo

  return (
    <>
      <StepSection>
        <StepHeader title="Upload CSV File" subtitle="Step 2">
          <p>
            Only CSV format files are allowed. If you have an Excel file, please
            convert it by going to File &gt; Save As &gt; CSV (Comma delimited).
          </p>
          <p>
            CSV file must include a <b>recipient</b> column with
            recipients&apos; mobile numbers
          </p>
        </StepHeader>

        {!csvFilename && (
          <WarningBlock title={'We do not remove duplicate recipients'}>
            This is because some use cases intend to send multiple messages to
            the same recipient. If this is not intended, please remove the
            duplicates. Learn how{' '}
            <OutboundLink
              className={styles.warningHelpLink}
              eventLabel={i18n._(LINKS.guideRemoveDuplicatesUrl)}
              to={i18n._(LINKS.guideRemoveDuplicatesUrl)}
              target="_blank"
            >
              from our guide
            </OutboundLink>
            .
          </WarningBlock>
        )}

        <CsvUpload
          isCsvProcessing={isCsvProcessing}
          csvInfo={csvInfo}
          onErrorClose={clearCsvStatus}
        >
          <FileInput isProcessing={isUploading} onFileSelected={uploadFile} />
          <p>or</p>
          <SampleCsv
            params={params}
            defaultRecipient="81234567"
            setErrorMsg={setErrorMessage}
          />
        </CsvUpload>
        {isDemo && (
          <InfoBlock title="Limited to 20 recipients">
            <span>
              You can only send out to 20 recipients per demo campaign. Only the
              first 20 rows in your CSV file will be taken.
            </span>
          </InfoBlock>
        )}
        <ErrorBlock>{errorMessage}</ErrorBlock>
      </StepSection>

      {!isCsvProcessing && numRecipients > 0 && (
        <StepSection>
          <p className={styles.greyText}>Message preview</p>
          <PreviewBlock body={preview.body}></PreviewBlock>
        </StepSection>
      )}

      <ButtonGroup>
        <NextButton
          disabled={!numRecipients || !csvFilename}
          onClick={() => setActiveStep((s) => s + 1)}
        />
        <TextButton
          disabled={isCsvProcessing}
          onClick={() => setActiveStep((s) => s - 1)}
        >
          Previous
        </TextButton>
      </ButtonGroup>
    </>
  )
}

export default SMSRecipients
