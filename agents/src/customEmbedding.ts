import { HuggingFaceTransformersEmbeddings, HuggingFaceTransformersEmbeddingsParams } from "@langchain/community/embeddings/huggingface_transformers";

export interface CustomHuggingFaceEmbeddingsParams extends HuggingFaceTransformersEmbeddingsParams {
  dtype?: string;
  device?: string | Record<string, string>;
  subfolder?: string;
  model_file_name?: string;
  use_external_data_format?: boolean | Record<string, boolean>;
  session_options?: Record<string, unknown>;
}

/**
 * Extended version of HuggingFaceTransformersEmbeddings that allows for
 * specifying dtype and other ModelSpecificPretrainedOptions
 */
export class CustomHuggingFaceEmbeddings extends HuggingFaceTransformersEmbeddings {
  constructor(fields?: Partial<CustomHuggingFaceEmbeddingsParams>) {
	if (!fields) {
	  super({});
	  return;
	}

	// First create a copy of the fields
	const fieldsCopy: Partial<HuggingFaceTransformersEmbeddingsParams> = { ...fields };

	// Extract any model-specific options
	const modelSpecificOptions: Record<string, unknown> = {
	  dtype: fields.dtype,
	  device: fields.device,
	  subfolder: fields.subfolder,
	  model_file_name: fields.model_file_name,
	  use_external_data_format: fields.use_external_data_format,
	  session_options: fields.session_options
	};

	// Clean up the fields by removing model-specific options
	delete (fieldsCopy as any).dtype;
	delete (fieldsCopy as any).device;
	delete (fieldsCopy as any).subfolder;
	delete (fieldsCopy as any).model_file_name;
	delete (fieldsCopy as any).use_external_data_format;
	delete (fieldsCopy as any).session_options;

	// Initialize pretrainedOptions if it doesn't exist
	fieldsCopy.pretrainedOptions = fieldsCopy.pretrainedOptions || {};

	// Merge the model-specific options into pretrainedOptions
	// This is a bit of a hack, but the implementation should pick them up
	Object.entries(modelSpecificOptions).forEach(([key, value]) => {
	  if (value !== undefined) {
		(fieldsCopy.pretrainedOptions as Record<string, unknown>)[key] = value;
	  }
	});

	// Call the parent constructor with our modified fields
	super(fieldsCopy);
  }
}
