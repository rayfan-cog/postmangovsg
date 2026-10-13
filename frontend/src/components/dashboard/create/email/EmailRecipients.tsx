import { i18n } from '@lingui/core'

import { Dispatch, SetStateAction, useContext } from 'react'

import { OutboundLink } from 'react-ga'

import styles from '../Create.module.scss'

import { EmailPreview, EmailProgress } from 'classes'
import {
  ButtonGroup,
  CsvUpload,
  EmailPreviewBlock,
  ErrorBlock,
  FileInput,
  NextButton,
  SampleCsv,
  StepHeader,
  StepSection,
  TextButton,
  WarningBlock,
} from 'components/common'
import useCsvUpload from 'components/custom-hooks/use-csv-upload'
import { LINKS } from 'config'
import { CampaignContext } from 'contexts/campaign.context'

const EmailRecipients = ({
  setActiveStep,
  onFileSelected,
  template,
  forceReset,
}: {
  setActiveStep: Dispatch<SetStateAction<EmailProgress>>
  onFileSelected?: (campaignId: number, file: File) => Promise<any>
  template?: string
  forceReset?: boolean // this forces upload button to show without csv info and preview
}) => {
  const { campaign } = useContext(CampaignContext)
  const { params, protect } = campaign
  const {
    csvInfo,
    isCsvProcessing,
    isUploading,
    preview,
    errorMessage,
    setErrorMessage,
    uploadFile,
    clearCsvStatus,
  } = useCsvUpload({} as EmailPreview, { onFileSelected, forceReset })
  const { csvFilename, numRecipients = 0 } = csvInfo

  return (
    <>
      <StepSection>
        <StepHeader title="Upload CSV File" subtitle={protect ? '' : 'Step 2'}>
          <p>
            Only CSV format files are allowed. If you have an Excel file, please
            convert it by going to File &gt; Save As &gt; CSV (Comma delimited).
          </p>
          <p>
            CSV file must include:
            <li>
              a <b>recipient</b> column with recipients&apos; email addresses
            </li>
            {protect && (
              <li>
                a <b>password</b> column with the password to access the
                protected message
              </li>
            )}
            <li>all other keywords in the template</li>
          </p>
        </StepHeader>

        {!csvFilename && (
          <WarningBlock title={'We do not remove duplicates.'}>
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
          {/* Dont show upload button when upload completed for protected component */}
          {(!protect || !numRecipients) && (
            <>
              <FileInput
                isProcessing={isUploading}
                onFileSelected={uploadFile}
                disabled={protect && !template}
              />
              <p>or</p>
              <SampleCsv
                params={protect ? [] : params}
                protect={protect}
                template={template}
                defaultRecipient="user@email.com"
                setErrorMsg={setErrorMessage}
              />
            </>
          )}
        </CsvUpload>
        <ErrorBlock>{errorMessage}</ErrorBlock>
      </StepSection>

      {!isCsvProcessing && numRecipients > 0 && (
        <StepSection>
          <p className={styles.greyText}>Message preview</p>
          <EmailPreviewBlock
            body={preview?.body}
            themedBody={preview?.themedBody}
            subject={preview?.subject}
            replyTo={preview?.replyTo}
            from={preview?.from}
          />
        </StepSection>
      )}
      {!protect && (
        <ButtonGroup>
          <NextButton
            disabled={!numRecipients || isCsvProcessing}
            onClick={() => setActiveStep((s) => s + 1)}
          />
          <TextButton
            disabled={isCsvProcessing}
            onClick={() => setActiveStep((s) => s - 1)}
          >
            Previous
          </TextButton>
        </ButtonGroup>
      )}
    </>
  )
}
export default EmailRecipients
