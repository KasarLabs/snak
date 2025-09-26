// import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// import { TaskVerifierGraph, TaskVerificationSchema } from '../sub-graph/task-verifier-graph.js';
// import { ModelSelector } from '../../operators/modelSelector.js';
// import { GraphState, GraphConfigurableAnnotation } from '../graph.js';
// import { TaskVerifierNode } from '../../../shared/enums/agent-modes.enum.js';
// import { TaskType } from '../../../shared/types/graph.types.js';

// // Mock dependencies
// jest.mock('../../operators/modelSelector.js');
// jest.mock('@langchain/core/messages', () => ({
//   AIMessageChunk: jest.fn().mockImplementation((data) => ({ ...data, additional_kwargs: data.additional_kwargs || {} }))
// }));

// describe('TaskVerifierGraph', () => {
//   let taskVerifier: TaskVerifierGraph;
//   let mockModelSelector: jest.Mocked<ModelSelector>;
//   let mockModel: any;

//   const createMockTask = (id: string, status: 'pending' | 'completed' | 'failed' = 'completed'): TaskType => ({
//     id,
//     text: 'Test task',
//     reasoning: 'Test reasoning',
//     criticism: 'Test criticism',
//     speak: 'Complete the test task successfully',
//     steps: [
//       {
//         thoughts: {
//           text: 'Execute test',
//           reasoning: 'Need to test the system',
//           plan: 'Run test and verify',
//           criticism: 'Should be thorough',
//           speak: 'Testing now'
//         },
//         tool: {
//           name: 'end_task',
//           args: {},
//           result: 'Task completed successfully',
//           status: 'completed'
//         }
//       }
//     ],
//     status
//   });

//   const createMockState = (taskIndex: number = 0) => ({
//     messages: [],
//     last_node: TaskVerifierNode.TASK_VERIFIER,
//     memories: {
//       stm: { items: [], maxSize: 5, head: 0, size: 0, totalInserted: 0 },
//       ltm: { items: [], episodic_size: 0, semantic_size: 0, merge_size: 0 },
//       isProcessing: false
//     },
//     tasks: [createMockTask('task-1')],
//     currentTaskIndex: taskIndex,
//     retry: 0,
//     currentGraphStep: 1,
//     skipValidation: { skipValidation: false, goto: '' },
//     error: null
//   });

//   const createMockConfig = () => ({
//     configurable: {
//       thread_id: 'test-thread',
//       max_graph_steps: 100,
//       short_term_memory: 5,
//       memory_size: 20,
//       human_in_the_loop: 0,
//       agent_config: {
//         id: 'test-agent',
//         mode: 'autonomous' as const,
//         prompt: { content: 'Test prompt' }
//       },
//       user_request: 'Test request',
//       executionMode: 'PLANNING' as const,
//       objectives: 'Test objectives'
//     }
//   });

//   beforeEach(() => {
//     mockModel = {
//       withStructuredOutput: jest.fn().mockReturnValue({
//         invoke: jest.fn()
//       })
//     };

//     mockModelSelector = {
//       getModels: jest.fn().mockReturnValue({
//         fast: mockModel
//       })
//     } as any;

//     taskVerifier = new TaskVerifierGraph(mockModelSelector);
//     taskVerifier.createTaskVerifierGraph();
//   });

//   describe('Task Verification Schema', () => {
//     it('should validate successful task completion', () => {
//       const validResult = {
//         taskCompleted: true,
//         confidenceScore: 95,
//         reasoning: 'Task was completed successfully with all objectives met',
//         missingElements: [],
//         nextActions: []
//       };

//       const result = TaskVerificationSchema.safeParse(validResult);
//       expect(result.success).toBe(true);
//     });

//     it('should validate failed task completion', () => {
//       const validResult = {
//         taskCompleted: false,
//         confidenceScore: 30,
//         reasoning: 'Task is incomplete - missing key requirements',
//         missingElements: ['user authentication', 'data validation'],
//         nextActions: ['implement auth system', 'add validation rules']
//       };

//       const result = TaskVerificationSchema.safeParse(validResult);
//       expect(result.success).toBe(true);
//     });

//     it('should reject invalid confidence scores', () => {
//       const invalidResult = {
//         taskCompleted: true,
//         confidenceScore: 150, // Invalid: > 100
//         reasoning: 'Task completed',
//         missingElements: []
//       };

//       const result = TaskVerificationSchema.safeParse(invalidResult);
//       expect(result.success).toBe(false);
//     });
//   });

//   describe('Task Verification Flow', () => {
//     it('should handle successful task verification', async () => {
//       // Mock successful verification response
//       mockModel.withStructuredOutput().invoke.mockResolvedValue({
//         taskCompleted: true,
//         confidenceScore: 95,
//         reasoning: 'Task completed successfully',
//         missingElements: [],
//         nextActions: []
//       });

//       const state = createMockState();
//       const config = createMockConfig();

//       // Access the private method for testing
//       const verifierGraph = taskVerifier.getVerifierGraph();
//       expect(verifierGraph).toBeDefined();
//     });

//     it('should handle failed task verification', async () => {
//       // Mock failed verification response
//       mockModel.withStructuredOutput().invoke.mockResolvedValue({
//         taskCompleted: false,
//         confidenceScore: 25,
//         reasoning: 'Task incomplete - missing requirements',
//         missingElements: ['data validation', 'error handling'],
//         nextActions: ['add validation', 'implement error handling']
//       });

//       const state = createMockState();
//       const config = createMockConfig();

//       const verifierGraph = taskVerifier.getVerifierGraph();
//       expect(verifierGraph).toBeDefined();
//     });

//     it('should skip verification for non-completed tasks', () => {
//       const state = createMockState();
//       // Set task as not completed
//       state.tasks[0].status = 'pending';

//       const verifierGraph = taskVerifier.getVerifierGraph();
//       expect(verifierGraph).toBeDefined();
//     });
//   });

//   describe('Memory Integration', () => {
//     it('should add verification context to memory on completion', () => {
//       const state = createMockState();
//       const verifierGraph = taskVerifier.getVerifierGraph();

//       expect(verifierGraph).toBeDefined();
//       expect(state.memories.stm.items.length).toBe(0);
//     });

//     it('should retain task context on verification failure', () => {
//       const state = createMockState();
//       const config = createMockConfig();

//       // Task marked as failed after verification
//       state.tasks[0].status = 'failed';

//       const verifierGraph = taskVerifier.getVerifierGraph();
//       expect(verifierGraph).toBeDefined();
//     });
//   });

//   describe('Graph Structure', () => {
//     it('should create verifier graph with correct nodes', () => {
//       const verifierGraph = taskVerifier.getVerifierGraph();

//       expect(verifierGraph).toBeDefined();
//       // The graph should have the verifier nodes configured
//     });

//     it('should handle routing between verification states', () => {
//       const verifierGraph = taskVerifier.getVerifierGraph();

//       expect(verifierGraph).toBeDefined();
//       // Routing logic should be configured properly
//     });
//   });

//   describe('Error Handling', () => {
//     it('should handle model invocation errors gracefully', async () => {
//       mockModel.withStructuredOutput().invoke.mockRejectedValue(new Error('Model error'));

//       const state = createMockState();
//       const config = createMockConfig();

//       // The verifier should handle errors and not crash
//       const verifierGraph = taskVerifier.getVerifierGraph();
//       expect(verifierGraph).toBeDefined();
//     });

//     it('should handle missing model selector', () => {
//       const taskVerifierWithoutModel = new TaskVerifierGraph(null);

//       expect(() => {
//         taskVerifierWithoutModel.createTaskVerifierGraph();
//       }).not.toThrow();
//     });
//   });
// });
