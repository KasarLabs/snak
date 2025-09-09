import { STMContext, LTMContext } from '../../../../shared/types/index.js';

export function JSONstringifySTM(stm: STMContext): string {
  return JSON.stringify(
    stm.items.filter((item) => {
      if (item) {
        return item;
      }
    }),
    null,
    2
  );
}

export function JSONstringifyLTM(ltm: LTMContext): string {
  return JSON.stringify(ltm.items, null, 2);
}
