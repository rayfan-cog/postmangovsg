import { i18n } from '@lingui/core'
import { filter } from 'lodash'
import { Dispatch, SetStateAction, useContext, useEffect } from 'react'
import { OutboundLink } from 'react-ga'

import { useParams } from 'react-router-dom'

import styles from '../Create.module.scss'

import { confirmSendCampaign } from '../util'

import { ChannelType, GovsgProgress } from 'classes'
import {
  ButtonGroup,
  ConfirmModal,
  CsvUpload,
  ErrorBlock,
  FileInput,
  PreviewBlock,
  PrimaryButton,
  SampleCsv,
  StepHeader,
  StepSection,
  TextButton,
  WarningBlock,
} from 'components/common'
import useCsvUpload from 'components/custom-hooks/use-csv-upload'
import { LINKS } from 'config'

import { CampaignContext } from 'contexts/campaign.context'
import { ModalContext } from 'contexts/modal.context'

const GovsgRecipients = ({
  setActiveStep,
  hasLanguages,
}: {
  setActiveStep: Dispatch<SetStateAction<GovsgProgress>>
  hasLanguages: boolean
}) => {
  const { campaign, updateCampaign } = useContext(CampaignContext)
  const { params } = campaign
  const paramsWithoutPasscode = filter(params, (value) => value !== 'passcode')
  const {
    csvInfo,
    isCsvProcessing,
    isUploading,
    preview,
    errorMessage,
    uploadFile,
    clearCsvStatus,
  } = useCsvUpload<{ body: string }>({ body: '' })
  const { csvFilename, numRecipients = 0 } = csvInfo
  const { id: campaignId } = useParams<{ id: string }>()
  const modalContext = useContext(ModalContext)

  // Scroll window to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const onModalConfirm = () => {
    if (!campaignId) return
    void confirmSendCampaign({
      campaignId: +campaignId,
      channelType: ChannelType.Govsg,
      sendRate: 0,
      updateCampaign,
    })
  }
  const openModal = () => {
    modalContext.setModalContent(
      <ConfirmModal
        title="Are you absolutely sure?"
        subtitle="Sending out a campaign is irreversible."
        buttonText="Confirm send now"
        buttonIcon="bx-send"
        onConfirm={onModalConfirm}
      />
    )
  }

  return (
    <>
      <StepSection>
        <StepHeader
          title="Upload recipient list in CSV format"
          subtitle="Step 2"
        >
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
            params={
              hasLanguages
                ? ['language', ...paramsWithoutPasscode]
                : paramsWithoutPasscode
            }
            defaultParams={{ language: 'English' }}
            defaultRecipient="81234567"
            setErrorMsg={console.error}
          />
        </CsvUpload>
        <ErrorBlock>{errorMessage}</ErrorBlock>
      </StepSection>

      {!isCsvProcessing && numRecipients > 0 && (
        <StepSection>
          <p className={styles.greyText}>Message preview</p>
          <PreviewBlock body={preview.body} hideHeaders richPreview />
        </StepSection>
      )}

      <ButtonGroup>
        <PrimaryButton
          disabled={!numRecipients || !csvFilename}
          className={styles.turquoiseGreenBtn}
          onClick={openModal}
        >
          Send campaign now <i className="bx bx-send" />
        </PrimaryButton>
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

export default GovsgRecipients
