import { Request, Response, Router } from 'express'
import expressRateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { celebrate, Joi, Segments } from 'celebrate'
import { ProtectedMiddleware } from '@core/middlewares'
import { RedisService } from '@core/services'
import { loggerWithLabel } from '@core/logger'
import { ApiRateLimitError } from '@core/errors/rest-api.errors'
import { getRequestIp } from '@core/utils/request'

const logger = loggerWithLabel(module)

// Failed attempts allowed per (client IP, message id) within the window
export const PROTECT_VERIFY_IP_WINDOW_SECONDS = 15 * 60
export const PROTECT_VERIFY_IP_MAX_FAILURES = 10
// Failed attempts allowed per message id across all clients before lockout
export const PROTECT_VERIFY_MESSAGE_WINDOW_SECONDS = 60 * 60
export const PROTECT_VERIFY_MESSAGE_MAX_FAILURES = 30

const protectVerifyValidator = {
  [Segments.BODY]: Joi.object({
    password_hash: Joi.string().required(),
  }),
}

const createFailedAttemptLimiter = (
  redisService: RedisService,
  {
    prefix,
    windowSeconds,
    max,
    keyGenerator,
  }: {
    prefix: string
    windowSeconds: number
    max: number
    keyGenerator: (req: Request) => string
  }
) =>
  expressRateLimit({
    store: new RedisStore({
      prefix,
      client: redisService.rateLimitClient,
      expiry: windowSeconds,
    }),
    windowMs: windowSeconds * 1000,
    max,
    keyGenerator,
    // Only wrong guesses (403) count towards the limit
    skipSuccessfulRequests: true,
    handler: (req: Request, _res: Response) => {
      logger.warn({
        message: 'Too many failed attempts to verify protected message',
        messageId: req.params.id,
        limiter: prefix,
        action: 'verifyPasswordHash',
      })
      throw new ApiRateLimitError(
        'Too many failed attempts. Please try again later.'
      )
    },
  })

export const InitProtectedRoutes = (redisService: RedisService): Router => {
  const router = Router()

  const ipLimiter = createFailedAttemptLimiter(redisService, {
    prefix: 'protectVerifyIp:',
    windowSeconds: PROTECT_VERIFY_IP_WINDOW_SECONDS,
    max: PROTECT_VERIFY_IP_MAX_FAILURES,
    keyGenerator: (req: Request) => `${getRequestIp(req)}:${req.params.id}`,
  })
  const messageLimiter = createFailedAttemptLimiter(redisService, {
    prefix: 'protectVerifyMessage:',
    windowSeconds: PROTECT_VERIFY_MESSAGE_WINDOW_SECONDS,
    max: PROTECT_VERIFY_MESSAGE_MAX_FAILURES,
    keyGenerator: (req: Request) => req.params.id,
  })

  /**
   * paths:
   *   /protect/{id}:
   *     post:
   *       description: Verify password hash and return encrypted payload
   *       tags:
   *         - Email
   *       parameters:
   *         - name: id
   *           in: path
   *           required: true
   *           schema:
   *             type: string
   *       requestBody:
   *         content:
   *           application/json:
   *             schema:
   *               required:
   *                 - password_hash
   *               properties:
   *                 password_hash:
   *                   type: string
   *       responses:
   *         200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                 payload:
   *                  type: string
   *         "403":
   *           description: Wrong password or message id
   *         "429":
   *           description: Too many failed attempts
   *         "500":
   *           description: Internal Server Error
   */
  router.post(
    '/:id',
    celebrate(protectVerifyValidator),
    ipLimiter,
    messageLimiter,
    ProtectedMiddleware.verifyPasswordHash
  )

  return router
}
