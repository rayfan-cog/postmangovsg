import { GovsgTemplateLanguageMetadata } from '@shared/clients/whatsapp-client.class/types'

import {
  Campaign,
  CampaignRecipient,
  ChannelCampaignApiResponse,
} from './Campaign'

export enum GovsgProgress {
  PickTemplate,
  UploadRecipients,
}

export type GovsgTemplate = {
  id: number
  name: string
  body: string
  params: Array<string>
  languages: Array<GovsgTemplateLanguageMetadata>
}

export type GovsgTemplateParamMetadata = {
  displayName?: string
  defaultFromMetaField?: string
}

type GovsgParamMetadata = Record<string, GovsgTemplateParamMetadata>

export interface GovsgCampaignApiResponse extends ChannelCampaignApiResponse {
  govsg_templates?: {
    id?: number
    body?: string
    params?: Array<string> | null
    for_single_recipient?: boolean | null
    param_metadata?: GovsgParamMetadata
    languages?: Array<GovsgTemplateLanguageMetadata>
  }
}

export class GovsgCampaign extends Campaign {
  templateId: number
  body: string
  params: Array<string>
  csvFilename: string
  numRecipients: number
  progress: GovsgProgress = GovsgProgress.PickTemplate
  forSingleRecipient: boolean | null
  paramMetadata: GovsgParamMetadata
  languages: Array<GovsgTemplateLanguageMetadata>

  constructor(input: GovsgCampaignApiResponse) {
    super(input)
    const template = input.govsg_templates
    this.templateId = template?.id as number
    this.body = template?.body as string
    this.params = template?.params as Array<string>
    this.csvFilename = input.csv_filename as string
    this.numRecipients = input.num_recipients as number
    this.forSingleRecipient = template?.for_single_recipient as boolean | null
    this.paramMetadata = template?.param_metadata as GovsgParamMetadata
    this.languages = template?.languages ?? []
    this.setProgress()
  }
  setProgress() {
    if (!this.templateId) {
      this.progress = GovsgProgress.PickTemplate
    } else {
      this.progress = GovsgProgress.UploadRecipients
    }
  }
}

export class GovsgCampaignRecipient extends CampaignRecipient {
  formatErrorCode(errorCode: string): string {
    return errorCode || ''
  }
}
