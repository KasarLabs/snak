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

    const fieldsCopy: Partial<HuggingFaceTransformersEmbeddingsParams> = {
      ...fields,
    };

    const modelSpecificOptions: Record<string, unknown> = {
      dtype: fields.dtype,
      device: fields.device,
      subfolder: fields.subfolder,
      model_file_name: fields.model_file_name,
      use_external_data_format: fields.use_external_data_format,
      session_options: fields.session_options,
    };

    delete (fieldsCopy as any).dtype;
    delete (fieldsCopy as any).device;
    delete (fieldsCopy as any).subfolder;
    delete (fieldsCopy as any).model_file_name;
    delete (fieldsCopy as any).use_external_data_format;
    delete (fieldsCopy as any).session_options;

    fieldsCopy.pretrainedOptions = fieldsCopy.pretrainedOptions || {};
    Object.entries(modelSpecificOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        (fieldsCopy.pretrainedOptions as Record<string, unknown>)[key] = value;
      }
    });

    super(fieldsCopy);
  }
}
