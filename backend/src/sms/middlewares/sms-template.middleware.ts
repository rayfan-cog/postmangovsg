import { NextFunction, Request, Response } from 'express'
import { HydrationError } from '@core/errors'
import { TemplateError } from '@shared/templating'
import { StatsService, UploadService } from '@core/services'
import { SmsService, SmsTemplateService } from '@sms/services'
import { StoreTemplateOutput } from '@sms/interfaces'
import { loggerWithLabel } from '@core/logger'
import { ApiInvalidTemplateError } from '@core/errors/rest-api.errors'
import {
  MISSING_TEMPLATE_MESSAGE,
  UploadMiddleware,
} from '@core/middlewares/upload.middleware'

const logger = loggerWithLabel(module)
/**
 * Store template subject and body in sms template table.
 * If an existing csv has been uploaded for this campaign but whose columns do not match the attributes provided in the new template,
 * delete the old csv, and prompt user to upload a new csv.
 * @param req
 * @param res
 * @param next
 */
const storeTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const { campaignId } = req.params
  const { body } = req.body
  const logMeta = { campaignId, action: 'storeTemplate' }
  try {
    // extract params from template, save to db (this will be done with hook)
    const { check, valid, updatedTemplate }: StoreTemplateOutput =
      await SmsTemplateService.storeTemplate({
        campaignId: +campaignId,
        body,
      })

    if (check?.reupload) {
      logger.info({
        message:
          'SMS template has changed, required to re-upload recipient list',
        ...logMeta,
      })
      return res.status(200).json({
        message:
          'Please re-upload your recipient list as template has changed.',
        extra_keys: check.extraKeys,
        num_recipients: 0,
        valid: false,
        template: {
          body: updatedTemplate?.body,
          params: updatedTemplate?.params,
        },
      })
    } else {
      const numRecipients = await StatsService.getNumRecipients(+campaignId)
      return res.status(200).json({
        message: `Template for campaign ${campaignId} updated`,
        valid: valid,
        num_recipients: numRecipients,
        template: {
          body: updatedTemplate?.body,
          params: updatedTemplate?.params,
        },
      })
    }
  } catch (err) {
    if (err instanceof HydrationError || err instanceof TemplateError) {
      logger.error({
        message: 'Failed to store template',
        error: err,
        ...logMeta,
      })
      throw new ApiInvalidTemplateError(err.message)
    }
    return next(err)
  }
}

const uploadCompleteHandler = UploadMiddleware.makeUploadCompleteHandler({
  getFilledTemplate: SmsTemplateService.getFilledTemplate,
  enqueueUpload: SmsTemplateService.enqueueUpload,
  missingTemplateError: () => new Error(MISSING_TEMPLATE_MESSAGE),
})

/*
 * Returns status of csv processing
 */
const pollCsvStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { campaignId } = req.params
    const { isCsvProcessing, filename, tempFilename, error } =
      await UploadService.getCsvStatus(+campaignId)

    // If done processing, returns num recipients and preview msg
    let numRecipients, preview
    if (!isCsvProcessing) {
      ;[numRecipients, preview] = await Promise.all([
        StatsService.getNumRecipients(+campaignId),
        SmsService.getHydratedMessage(+campaignId),
      ])
    }

    res.json({
      is_csv_processing: isCsvProcessing,
      csv_filename: filename,
      temp_csv_filename: tempFilename,
      csv_error: error,
      num_recipients: numRecipients,
      preview,
    })
  } catch (err) {
    next(err)
  }
}

/*
 * Deletes csv error and temp csv name from db
 */
const deleteCsvErrorHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { campaignId } = req.params
  await UploadService.deleteS3TempKeys(+campaignId)
  return res.status(200).json({ id: campaignId })
}

export const SmsTemplateMiddleware = {
  storeTemplate,
  uploadCompleteHandler,
  pollCsvStatusHandler,
  deleteCsvErrorHandler,
}
