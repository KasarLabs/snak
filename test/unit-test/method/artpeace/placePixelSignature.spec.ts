import { placePixelSignature } from '../../../../server/agent/plugins/artpeace/actions/placePixel';
import { CallData } from 'starknet';

describe('placePixelSignature', () => {
  describe('With perfect match inputs', () => {
    it('Place 1 pixel with all params, should returns success with array of CallData', async () => {
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
      const result = await placePixelSignature(params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        transaction_type: 'INVOKE',
        results: expect.any(Array<CallData>),
      });
    });
    it('returns success with array of CallData', async () => {
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
      const result = await placePixelSignature(params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        transaction_type: 'INVOKE',
        results: expect.any(Array<CallData>),
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
      const result = await placePixelSignature(params);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        transaction_type: 'INVOKE',
        results: expect.any(Array<CallData>),
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
      const result = await placePixelSignature(params);
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
      const result = await placePixelSignature(params);
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
      const result = await placePixelSignature(params);
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
