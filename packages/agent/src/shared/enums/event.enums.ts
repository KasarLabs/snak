export enum EventType {
  // Chat Model Events
  ON_CHAT_MODEL_START = 'on_chat_model_start',
  ON_CHAT_MODEL_STREAM = 'on_chat_model_stream',
  ON_CHAT_MODEL_END = 'on_chat_model_end',

  // LLM Events
  ON_LLM_START = 'on_llm_start',
  ON_LLM_STREAM = 'on_llm_stream',
  ON_LLM_END = 'on_llm_end',

  // Chain Events
  ON_CHAIN_START = 'on_chain_start',
  ON_CHAIN_STREAM = 'on_chain_stream',
  ON_CHAIN_END = 'on_chain_end',

  // Tool Events
  ON_TOOL_START = 'on_tool_start',
  ON_TOOL_STREAM = 'on_tool_stream',
  ON_TOOL_END = 'on_tool_end',
  ON_TOOL_ERROR = 'on_tool_error',

  // Retriever Events
  ON_RETRIEVER_START = 'on_retriever_start',
  ON_RETRIEVER_END = 'on_retriever_end',
  ON_RETRIEVER_ERROR = 'on_retriever_error',

  // Prompt Events
  ON_PROMPT_START = 'on_prompt_start',
  ON_PROMPT_END = 'on_prompt_end',

  // Custom Events
  ON_CUSTOM_EVENT = 'on_custom_event',
  ON_GRAPH_ABORTED = 'on_graph_aborted',
  ON_GRAPH_INTERRUPTED = 'on_graph_interrupted',
}
