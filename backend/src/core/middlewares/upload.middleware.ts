import { Request, Response, NextFunction, Handler } from 'express'

import { loggerWithLabel } from '@core/logger'
import { UploadService, MultipartUploadService } from '@core/services'
import {
  ApiInternalServerError,
  ApiInvalidTemplateError,
} from '@core/errors/rest-api.errors'
import {
  InvalidRecipientError,
  MissingTemplateKeysError,
  RecipientColumnMissing,
  UserError,
} from '@core/errors'
import { AllowedTemplateTypes, UploadData } from '@core/interfaces'

const logger = loggerWithLabel(module)

/**
 * Start an upload by returning a presigned url to the user to upload file to s3 bucket
 * @param req
 * @param res
 */
const uploadStartHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { mime_type: contentType, md5 } = req.query
  const logMeta = { contentType, md5, action: 'uploadStartHandler' }
  try {
    const { presignedUrl, signedKey } = await UploadService.getUploadParameters(
      contentType as string,
      md5 as string
    )

    logger.info({ message: 'Start file upload', presignedUrl })
    return res.status(200).json({
      presigned_url: presignedUrl,
      transaction_id: signedKey,
    })
  } catch (err) {
    logger.error({
      message: 'Unable to generate presigned URL',
      error: err,
      ...logMeta,
    })
    throw new ApiInternalServerError('Unable to generate presigned URL')
  }
}

/**
 * Starts multipart upload.
 * Once started, it should either be completed when all the parts are uploaded or aborted.
 * @param req
 * @param res
 * @param next
 */
const startMultipartUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const { mime_type: mimeType, part_count: partCount } = req.query
  const logMeta = { mimeType, partCount, action: 'startMultipartUpload' }
  try {
    const data = await MultipartUploadService.startMultipartUpload(
      mimeType as string,
      +(partCount as string)
    )
    logger.info({ messsage: 'Start multipart file upload', ...logMeta })
    return res.json({
      transaction_id: data.transactionId,
      presigned_urls: data.presignedUrls,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Complete a multipart upload.
 * Adds the s3Key to res.locals so that the middleware downstream can access it.
 * @param req
 * @param res
 * @param next
 */
const completeMultipart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const {
    transaction_id: transactionId,
    part_count: partCount,
    etags,
  } = req.body
  const logMeta = { transactionId, partCount, action: 'completeMultipart' }
  try {
    const { etag } = await MultipartUploadService.completeMultipartUpload({
      transactionId,
      partCount,
      etags,
    })
    res.locals.etag = etag

    logger.info({ message: 'Multipart file upload completed', ...logMeta })
    next()
  } catch (err) {
    next(err)
  }
}

export const MISSING_TEMPLATE_MESSAGE =
  'Error: No message template found. Please create a message template before uploading a recipient file.'

const USER_ERRORS = [
  UserError,
  RecipientColumnMissing,
  MissingTemplateKeysError,
  InvalidRecipientError,
]

interface UploadCompleteHandlerOptions<Template extends AllowedTemplateTypes> {
  action?: string
  getFilledTemplate: (campaignId: number) => Promise<Template | null>
  enqueueUpload: (data: UploadData<Template>) => Promise<string>
  missingTemplateError: () => Error
  getEtag?: (req: Request, res: Response) => string
  getResponseBody?: (req: Request) => object
}

/**
 * Creates a handler that completes a recipient list upload for a channel.
 * If a template has not yet been uploaded, do not write to the message logs, but prompt the user to upload a template first.
 * Otherwise, store the temp filename and enqueue the upload, whose columns are checked against the template's attributes.
 */
const makeUploadCompleteHandler = <Template extends AllowedTemplateTypes>({
  action = 'uploadCompleteHandler',
  getFilledTemplate,
  enqueueUpload,
  missingTemplateError,
  getEtag = (req) => req.body.etag,
  getResponseBody = (req) => ({ id: req.params.campaignId }),
}: UploadCompleteHandlerOptions<Template>): Handler => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    const { campaignId } = req.params
    const { transaction_id: transactionId, filename } = req.body
    const logMeta = { campaignId, action }

    try {
      const { s3Key } = UploadService.extractParamsFromJwt(transactionId)

      const template = await getFilledTemplate(+campaignId)
      if (template === null) {
        throw missingTemplateError()
      }

      await UploadService.storeS3TempFilename(+campaignId, filename)
      logger.info({ message: 'Stored temporary S3 filename', ...logMeta })

      await enqueueUpload({
        campaignId: +campaignId,
        template,
        s3Key,
        etag: getEtag(req, res),
        filename,
      })

      // Return early because bulk insert is slow
      return res.status(202).json(getResponseBody(req))
    } catch (err) {
      logger.error({
        message: 'Failed to complete upload to s3',
        error: err,
        ...logMeta,
      })
      if (USER_ERRORS.some((errType) => err instanceof errType)) {
        throw new ApiInvalidTemplateError((err as Error).message)
      }
      return next(err)
    }
  }
}

export const UploadMiddleware = {
  uploadStartHandler,
  startMultipartUpload,
  completeMultipart,
  makeUploadCompleteHandler,
}
