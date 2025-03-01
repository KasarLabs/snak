import { constants } from 'starknet';

export const DEV_CONTRACTS = {
  abbot: '0x04280b97ecb8f1e0536e41888e387a04c3796e393f7086e5e24d61614927bc30',
  absorber:
    '0x05cf86333b32580be7a73c8150f2176047bab151df7506b6e30217594798fab5',
  allocator:
    '0x00dd24daea0f6cf5ee0a206e6a27c4d5b66a978f19e3a4877de23ab5a76f905d',
  caretaker:
    '0x004eb68cdc4009f0a7af80ecb34b91822649b139713e7e9eb9b11b10ee47aada',
  controller:
    '0x0005efaa9df09e86be5aa8ffa453adc11977628ddc0cb493625ca0f3caaa94b2',
  equalizer:
    '0x013be5f3de034ca1a0dec2b2da4cce2d0fe5505511cbea7a309979c45202d052',
  flashmint:
    '0x0726e7d7bef2bcfc2814e0d5f0735b1a9326a98f2307a5edfda8db82d60d3f5f',
  purger: '0x0397fda455fd16d76995da81908931057594527b46cc99e12b8e579a9127e372',
  seer: '0x07bdece1aeb7f2c31a90a6cc73dfdba1cb9055197cca24b6117c9e0895a1832d',
  sentinel:
    '0x04c4d997f2a4b1fbf9db9c290ea1c97cb596e7765e058978b25683efd88e586d',
  shrine: '0x0398c179d65929f3652b6b82875eaf5826ea1c9a9dd49271e0d749328186713e',
} as const;

export const PROD_CONTRACTS = {
  abbot: '0x04d0bb0a4c40012384e7c419e6eb3c637b28e8363fb66958b60d90505b9c072f',
  absorber:
    '0x000a5e1c1ffe1384b30a464a61b1af631e774ec52c0e7841b9b5f02c6a729bc0',
  allocator:
    '0x06a3593f7115f8f5e0728995d8924229cb1c4109ea477655bad281b36a760f41',
  caretaker:
    '0x012a5efcb820803ba700503329567fcdddd7731e0d05e06217ed1152f956dbb0',
  controller:
    '0x07558a9da2fac57f5a4381fef8c36c92ca66adc20978063982382846f72a4448',
  equalizer:
    '0x066e3e2ea2095b2a0424b9a2272e4058f30332df5ff226518d19c20d3ab8e842',
  flashmint:
    '0x05e57a033bb3a03e8ac919cbb4e826faf8f3d6a58e76ff7a13854ffc78264681',
  purger: '0x0149c1539f39945ce1f63917ff6076845888ab40e9327640cb78dcaebfed42e4',
  seer: '0x07b4d65be7415812cea9edcfce5cf169217f4a53fce84e693fe8efb5be9f0437',
  sentinel:
    '0x06428ec3221f369792df13e7d59580902f1bfabd56a81d30224f4f282ba380cd',
  shrine: '0x0498edfaf50ca5855666a700c25dd629d577eb9afccdf3b5977aec79aee55ada',
} as const;

export type OpusContractsNames = keyof typeof PROD_CONTRACTS;

export function getOpusContractAddresses({
  chainId,
}: {
  chainId?: constants.StarknetChainId;
}) {
  if (chainId === constants.StarknetChainId.SN_SEPOLIA) {
    return DEV_CONTRACTS;
  }
  return PROD_CONTRACTS;
}

export function getOpusContractAddress<K extends OpusContractsNames>({
  chainId,
  contractName,
}: {
  chainId?: constants.StarknetChainId;
  contractName: K;
}) {
  const contractAddresses = getOpusContractAddresses({ chainId });
  return contractAddresses[contractName];
}
