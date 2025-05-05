import {
  interrupt,
  StateGraph,
  MemorySaver,
  Annotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger } from '@snakagent/core';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { initializeToolsList, truncateToolResults } from '../core/utils.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';

export const createHybridAgent = async (
  starknetAgent: StarknetAgentInterface,
  modelSelector: ModelSelectionAgent | null
) => {
  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    // Initialize tools with the full configuration
    const toolsList = await initializeToolsList(starknetAgent, json_config);

    // Définition de l'état du graphe
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      waiting_for_input: Annotation<boolean>({
        default: () => false,
        value: (_, y) => y,
      }),
      iterations: Annotation<number>({
        default: () => 0,
        value: (_, y) => y,
      }),
    });

    // Création du nœud d'outil
    const toolNode = new ToolNode(toolsList);

    // Add wrapper to log tool executions and truncate results
    const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (state, config) => {
      const lastMessage = state.messages[state.messages.length - 1];
      let toolCalls: Array<{ name: string; args: Record<string, any> }> = [];

      // Check if lastMessage is an AIMessage before accessing tool_calls
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls) {
        toolCalls = lastMessage.tool_calls;
      }

      if (toolCalls.length > 0) {
        logger.debug(
          `Hybrid agent: Tool execution starting: ${toolCalls.length} calls`
        );
        for (const call of toolCalls) {
          logger.debug(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        }
      }

      const startTime = Date.now();
      try {
        const result = await originalToolNodeInvoke(state, config);
        const executionTime = Date.now() - startTime;

        // Debug the structure of the result to help troubleshoot truncation issues
        if (result) {
          logger.debug(
            `Hybrid agent: Tool execution result structure: ${
              Array.isArray(result)
                ? 'Array[' + result.length + ']'
                : typeof result === 'object' && result.messages
                  ? 'Object with messages[' + result.messages.length + ']'
                  : typeof result
            }`
          );
        }

        // Use truncateToolResults function to handle result truncation
        const truncatedResult = truncateToolResults(result, 5000);

        logger.debug(
          `Hybrid agent: Tool execution completed in ${executionTime}ms`
        );
        return truncatedResult;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Hybrid agent: Tool execution failed after ${executionTime}ms: ${error}`
        );
        throw error;
      }
    };

    // Nœud d'entrée humaine qui utilise interrupt
    async function humanInputNode(state: typeof GraphState.State) {
      // Interrompre seulement quand explicitement demandé
      if (!state.waiting_for_input) {
        return {}; // Pas de changement d'état, continuer
      }

      // Obtenir le dernier message pour le montrer à l'humain
      const lastMessage = state.messages[state.messages.length - 1];
      const messageToShow = lastMessage.content;

      logger.debug(
        `Hybrid agent: Interrupting for human input. Last message: ${typeof messageToShow === 'string' ? messageToShow.substring(0, 100) + '...' : '[complex content]'}`
      );

      // Interrompre l'exécution et attendre l'entrée humaine
      const humanInput = interrupt({
        message: messageToShow,
        state_summary: {
          message_count: state.messages.length,
          iterations: state.iterations,
        },
      });

      logger.debug(
        `Hybrid agent: Received human input: ${typeof humanInput === 'string' ? humanInput.substring(0, 100) + '...' : JSON.stringify(humanInput).substring(0, 100) + '...'}`
      );

      // Ajouter le message humain à la conversation
      return {
        messages: [new HumanMessage(humanInput)],
        waiting_for_input: false, // Réinitialiser le drapeau
      };
    }

    // Nœud d'agent principal
    async function callModel(state: typeof GraphState.State) {
      // Suivre les itérations pour éviter les boucles infinies
      const currentIteration = state.iterations || 0;
      const maxIterations = json_config?.mode?.maxIteration || 50;

      if (currentIteration >= maxIterations) {
        logger.warn(`Hybrid agent: Max iterations reached (${maxIterations})`);
        return {
          messages: [
            new AIMessage({
              content: `Maximum iterations (${maxIterations}) reached. Execution stopped.`,
              additional_kwargs: {
                from: 'hybrid-agent',
                final: true,
                error: 'max_iterations_reached',
              },
            }),
          ],
          iterations: currentIteration + 1,
        };
      }

      // Validate required configuration fields
      if (!json_config?.name) {
        logger.warn('Agent name is missing in configuration');
      }

      if (!(json_config as any)?.bio) {
        logger.warn('Agent bio is missing in configuration');
      }

      if (
        !Array.isArray((json_config as any)?.objectives) ||
        (json_config as any)?.objectives.length === 0
      ) {
        logger.warn('Agent objectives are missing or empty in configuration');
      }

      if (
        !Array.isArray((json_config as any)?.knowledge) ||
        (json_config as any)?.knowledge.length === 0
      ) {
        logger.warn('Agent knowledge is missing or empty in configuration');
      }

      // Prompt système avec instructions hybrides
      const hybridSystemPrompt = `
        ${json_config?.prompt?.content || ''}

        Your name: ${json_config?.name || 'Assistant'}
        Your bio: ${(json_config as any)?.bio || 'An AI assistant specialized in Starknet blockchain operations.'}

        Your objectives:
        ${
          Array.isArray((json_config as any)?.objectives)
            ? ((json_config as any).objectives as string[])
                .map((obj: string) => `- ${obj}`)
                .join('\n')
            : '- Assist users with Starknet blockchain operations\n- Provide accurate information about blockchain data'
        }

        Your knowledge:
        ${
          Array.isArray((json_config as any)?.knowledge)
            ? ((json_config as any).knowledge as string[])
                .map((k: string) => `- ${k}`)
                .join('\n')
            : '- Starknet blockchain operations\n- Smart contract interactions'
        }

        You are now operating in HYBRID MODE. This means:
        
        1. You can work autonomously to complete tasks step by step.
        2. Break down complex tasks into manageable steps.
        3. Think step-by-step about your plan and reasoning.
        4. When you need human input, explicitly say "WAITING_FOR_HUMAN_INPUT: [your question]"
           at the end of your message.
        5. When your task is complete, respond with "FINAL ANSWER: [your conclusion]"
           
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}
      `;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', hybridSystemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      // Formater le prompt et invoquer le modèle
      const formattedPrompt = await prompt.formatMessages({
        messages: state.messages,
      });

      const selectedModelType = modelSelector
        ? await modelSelector.selectModelForMessages(state.messages)
        : 'smart';

      const modelForThisTask = modelSelector
        ? await modelSelector.getModelForTask(state.messages, selectedModelType)
        : null;

      if (!modelForThisTask) {
        throw new Error('No model available for this task');
      }

      const boundModel =
        typeof modelForThisTask.bindTools === 'function'
          ? modelForThisTask.bindTools(toolsList)
          : modelForThisTask;

      logger.debug(
        `Hybrid agent: Invoking model (${selectedModelType}) with ${state.messages.length} messages (iteration ${currentIteration + 1})`
      );

      const result = await boundModel.invoke(formattedPrompt);
      logger.debug(`Hybrid agent: Model invocation complete`);

      // Traiter le résultat pour vérifier si on attend une entrée
      let resultMessage: AIMessage;
      if (result instanceof AIMessage) {
        resultMessage = result;
      } else {
        resultMessage = new AIMessage({
          content:
            typeof result.content === 'string'
              ? result.content
              : JSON.stringify(result.content),
          tool_calls: result.tool_calls,
          additional_kwargs: {
            from: 'hybrid-agent',
          },
        });
      }

      // Log AI output for monitoring
      const contentToCheck =
        typeof resultMessage.content === 'string'
          ? resultMessage.content.trim()
          : JSON.stringify(resultMessage.content || '');

      if (contentToCheck && contentToCheck !== '') {
        logger.info(
          `Hybrid agent: AI output: ${
            typeof resultMessage.content === 'string'
              ? resultMessage.content.substring(0, 1000) +
                (resultMessage.content.length > 1000 ? '...' : '')
              : JSON.stringify(resultMessage.content).substring(0, 1000) + '...'
          }`
        );
      }

      if (resultMessage.tool_calls && resultMessage.tool_calls.length > 0) {
        logger.info(
          `Hybrid agent: Tool calls: ${resultMessage.tool_calls.length} calls - [${resultMessage.tool_calls
            .map((call) => call.name)
            .join(', ')}]`
        );
      }

      // Vérifier si nous devons attendre l'entrée humaine
      const content =
        typeof resultMessage.content === 'string' ? resultMessage.content : '';
      const waitForInput = content.includes('WAITING_FOR_HUMAN_INPUT:');

      // Vérifier si c'est une réponse finale
      const isFinal = content.includes('FINAL ANSWER:');

      if (waitForInput) {
        logger.debug(`Hybrid agent: Detected request for human input`);
        resultMessage.additional_kwargs = {
          ...resultMessage.additional_kwargs,
          wait_for_input: true,
        };
      }

      if (isFinal) {
        logger.debug(`Hybrid agent: Detected final answer`);
        resultMessage.additional_kwargs = {
          ...resultMessage.additional_kwargs,
          final: true,
        };
      }

      return {
        messages: [resultMessage],
        waiting_for_input: waitForInput,
        iterations: currentIteration + 1,
      };
    }

    // Fonction de routage d'état
    function shouldContinue(state: typeof GraphState.State) {
      // Obtenir le dernier message
      const lastMessage = state.messages[state.messages.length - 1];

      // Vérifier si nous devons attendre l'entrée humaine
      if (state.waiting_for_input) {
        logger.debug(
          `Hybrid agent: Waiting for human input, routing to human_input node`
        );
        return 'human_input';
      }

      // Vérifier si le message a des appels d'outils
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        logger.debug(`Hybrid agent: Routing to tools node`);
        return 'tools';
      }

      // Vérifier si le message contient "FINAL ANSWER" dans son contenu
      if (
        lastMessage instanceof AIMessage &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.includes('FINAL ANSWER:')
      ) {
        logger.debug(
          `Hybrid agent: Detected "FINAL ANSWER" in message content`
        );

        // Capture the FINAL ANSWER content
        const finalAnswer = lastMessage.content;

        // Create a new message instructing the agent to continue
        const continuationMessage = new AIMessage({
          content: `I've received your final answer: "${finalAnswer}"\n\nBased on the history of your actions and your objectives, what would you like to do next? You can either continue with another task or refine your previous solution.`,
          additional_kwargs: {
            from: 'hybrid-agent',
          },
        });

        // Add the continuation message to the state
        state.messages.push(continuationMessage);

        logger.debug(
          `Hybrid agent: Added continuation prompt to encourage further exploration`
        );
        return 'agent';
      }

      // Vérifier si c'est un message final (basé sur les métadonnées)
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.final === true
      ) {
        logger.debug(`Hybrid agent: Final message detected, ending execution`);
        return 'end';
      }

      // Si c'est un message humain ou un message AI non final, retourner à l'agent
      logger.debug(`Hybrid agent: Routing back to agent node`);
      return 'agent';
    }

    // Construire le flux de travail
    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addNode('human_input', humanInputNode);

    workflow.setEntryPoint('agent');

    // Connecter les nœuds
    workflow.addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      human_input: 'human_input',
      agent: 'agent',
      end: '__end__',
    });

    workflow.addEdge('tools', 'agent');
    workflow.addEdge('human_input', 'agent');

    // Compiler avec checkpointer pour le support d'interruption
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });

    return {
      app,
      json_config,
      maxIteration: json_config.mode?.maxIteration || 50,
    };
  } catch (error) {
    logger.error('Failed to create hybrid agent:', error);
    throw error;
  }
};
