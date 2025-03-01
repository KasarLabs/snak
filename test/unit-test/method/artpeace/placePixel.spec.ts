import { placePixel } from '../../../../server/agent/plugins/artpeace/actions/placePixel';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrongAgent = createMockInvalidStarknetAgent();

describe('place_pixel', () => {
  describe('With perfect match inputs', () => {
    it('returns success', async () => {
      const params = {
        params: [
          {
            canvasId: 0,
            color: 'black',
            xPos: 0,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'success',
        transaction_hash: expect.any(Array<String>),
      });
    });
    it('returns success', async () => {
      const params = {
        params: [
          {
            canvasId: 0,
            color: 'black',
            xPos: 0,
            yPos: 0,
          },
          {
            canvasId: 0,
            color: 'red',
            xPos: 1,
            yPos: 0,
          },
          {
            canvasId: 0,
            color: 'green',
            xPos: 2,
            yPos: 0,
          },
          {
            canvasId: 0,
            color: 'blue',
            xPos: 3,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'success',
        transaction_hash: expect.any(Array<String>),
      });
    });
    it('returns success', async () => {
      const params = {
        params: [
          {
            canvasId: 'art-peace-iii',
            color: 'black',
            xPos: 0,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'success',
        transaction_hash: expect.any(Array<String>),
      });
    });
  });
  describe('With missing inputs', () => {
    it('returns error', async () => {
      const params = {
        params: [
          {
            canvasId: 'art-peace-iii',
            color: 'sdfsdfsd',
            xPos: 0,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'error',
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });

    it('returns error', async () => {
      const params = {
        params: [
          {
            canvasId: 'art-peace-3',
            color: 'black',
            xPos: 100000,
            yPos: 100000,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'error',
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });

    it('returns error', async () => {
      const params = {
        params: [
          {
            canvasId: 'sdfsd',
            color: 'black',
            xPos: 0,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'error',
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });

    it('returns error', async () => {
      const params = {
        params: [
          {
            canvasId: 0,
            color: 'black',
            xPos: 0,
            yPos: 0,
          },
        ],
      };
      const result = await placePixel(wrongAgent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        status: 'error',
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });
  });
});
