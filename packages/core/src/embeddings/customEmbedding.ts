import {
  HuggingFaceTransformersEmbeddings,
  type HuggingFaceTransformersEmbeddingsParams,
} from '@langchain/community/embeddings/huggingface_transformers';

export interface CustomHuggingFaceEmbeddingsParams
  extends HuggingFaceTransformersEmbeddingsParams {
  dtype?: string;
  device?: string | Record<string, string>;
  subfolder?: string;
  model_file_name?: string;
  use_external_data_format?: boolean | Record<string, boolean>;
  session_options?: Record<string, unknown>;
}

export class CustomHuggingFaceEmbeddings extends HuggingFaceTransformersEmbeddings {
  constructor(fields?: Partial<CustomHuggingFaceEmbeddingsParams>) {
    if (!fields) {
      super({});
      return;
    }

    const {
      dtype,
      device,
      subfolder,
      model_file_name,
      use_external_data_format,
      session_options,
      ...baseFields
    } = fields;

    const modelSpecificOptions: Record<string, unknown> = {
      dtype,
      device,
      subfolder,
      model_file_name,
      use_external_data_format,
      session_options,
    };

    baseFields.pretrainedOptions = baseFields.pretrainedOptions || {};

    Object.entries(modelSpecificOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        (baseFields.pretrainedOptions as Record<string, unknown>)[key] = value;
      }
    });

    super(baseFields);
  }
}
