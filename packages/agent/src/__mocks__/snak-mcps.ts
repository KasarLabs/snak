export const MultiServerMCPClient = jest.fn().mockImplementation(() => ({
  initializeConnections: jest.fn().mockResolvedValue(undefined),
  getTools: jest.fn().mockReturnValue([]),
}));
