import { Handler, NextFunction, Request, Response } from 'express'
import { HydrationError } from '@core/errors'
import { TemplateError } from '@shared/templating'
import {
  AuthService,
  StatsService,
  UnsubscriberService,
  UploadService,
} from '@core/services'
import { EmailService, EmailTemplateService } from '@email/services'
import { StoreTemplateOutput } from '@email/interfaces'
import { loggerWithLabel } from '@core/logger'
import { ThemeClient } from '@shared/theme'
import { ApiInvalidTemplateError } from '@core/errors/rest-api.errors'
import {
  MISSING_TEMPLATE_MESSAGE,
  UploadMiddleware,
} from '@core/middlewares/upload.middleware'

export interface EmailTemplateMiddleware {
  storeTemplate: Handler
  uploadCompleteHandler: Handler
  pollCsvStatusHandler: Handler
  deleteCsvErrorHandler: Handler
  uploadProtectedCompleteHandler: Handler
}

export const InitEmailTemplateMiddleware = (
  authService: AuthService
): EmailTemplateMiddleware => {
  const logger = loggerWithLabel(module)
  /**
   * Store template subject and body in email template table.
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
    const {
      subject,
      body,
      reply_to: replyTo,
      from,
      show_logo: showLogo,
    } = req.body
    const logMeta = { campaignId, action: 'storeTemplate' }
    try {
      const { check, valid, updatedTemplate }: StoreTemplateOutput =
        await EmailTemplateService.storeTemplate({
          campaignId: +campaignId,
          subject,
          body,
          replyTo:
            replyTo ||
            (
              await authService.findUser(req.session?.user?.id)
            )?.email,
          from,
          showLogo,
        })

      const template = {
        body: updatedTemplate?.body,
        subject: updatedTemplate?.subject,
        params: updatedTemplate?.params,
        reply_to: updatedTemplate?.replyTo,
        from: updatedTemplate?.from,
        show_logo: updatedTemplate?.showLogo,
      }

      if (check?.reupload) {
        logger.info({
          message:
            'Email template has changed, required to re-upload recipient list',
          ...logMeta,
        })
        return res.json({
          message:
            'Please re-upload your recipient list as template has changed.',
          extra_keys: check.extraKeys,
          num_recipients: 0,
          valid: false,
          template,
        })
      } else {
        const numRecipients = await StatsService.getNumRecipients(+campaignId)
        return res.json({
          message: `Template for campaign ${campaignId} updated`,
          valid: valid,
          num_recipients: numRecipients,
          template,
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
    getFilledTemplate: EmailTemplateService.getFilledTemplate,
    enqueueUpload: (data) => EmailTemplateService.enqueueUpload(data),
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
      let numRecipients, preview, themedBody

      if (!isCsvProcessing) {
        ;[numRecipients, preview] = await Promise.all([
          StatsService.getNumRecipients(+campaignId),
          EmailService.getHydratedMessage(+campaignId),
        ])

        if (preview !== undefined) {
          const { body, agencyName, agencyLogoURI, showMasthead } = preview
          themedBody = await ThemeClient.generateThemedBody({
            body,
            unsubLink: UnsubscriberService.generateTestUnsubLink(),
            agencyName,
            agencyLogoURI,
            showMasthead,
          })
        }
      }

      res.json({
        is_csv_processing: isCsvProcessing,
        csv_filename: filename,
        temp_csv_filename: tempFilename,
        csv_error: error,
        num_recipients: numRecipients,
        preview: {
          ...preview,
          themedBody,
        },
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

  const uploadProtectedCompleteHandler =
    UploadMiddleware.makeUploadCompleteHandler({
      action: 'uploadProtectedCompleteHandler',
      getFilledTemplate: EmailTemplateService.getFilledTemplate,
      enqueueUpload: (data) => EmailTemplateService.enqueueUpload(data, true),
      missingTemplateError: () => new Error(MISSING_TEMPLATE_MESSAGE),
      getEtag: (_req, res) => res.locals.etag,
      getResponseBody: (req) => ({ transaction_id: req.body.transaction_id }),
    })

  return {
    storeTemplate,
    uploadCompleteHandler,
    pollCsvStatusHandler,
    deleteCsvErrorHandler,
    uploadProtectedCompleteHandler,
  }
}
