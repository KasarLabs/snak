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

export const tokenAddresses: { [key: string]: string } = {
  AKU: '0x137dfca7d96cdd526d13a63176454f35c691f55837497448fad352643cfe4d4',
  ALF: '0x78d7dfcddb44667153513bd837ff534ef395484f4b6cf28faa25b2c46e063d9',
  BROTHER: '0x3b405a98c9e795d427fe82cdeeeed803f221b52471e3a757574a2b4180793ee',
  CASH: '0x498edfaf50ca5855666a700c25dd629d577eb9afccdf3b5977aec79aee55ada',
  DAI: '0x5574eb6b8789a91466f902c380d978e472db68170ff82a5b650b95a58ddf4ad',
  DAIv0: '0xda114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3',
  DICK: '0x388588584bd8c651151f6baf241a85827e7ff0574101f2a8194a3df68a7e2fe',
  EKUBO: '0x75afe6402ad5a5c20dd25e10ec3b3986acaa647b77e4ae24b0cbc9a54a27a87',
  ETH: '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  LORDS: '0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49',
  LUSD: '0x70a76fd48ca0ef910631754d77dd822147fe98a569b826ec85e3c33fde586ac',
  NSTR: '0xc530f2c0aa4c16a0806365b0898499fba372e5df7a7172dc6fe9ba777e8007',
  PAL: '0x49201f03a0f0a9e70e28dcd74cbf44931174dbe3cc4b2ff488898339959e559',
  SCHIZODIO: '0xacc2fa3bb7f6a6726c14d9e142d51fe3984dbfa32b5907e1e76425177875e2',
  SLAY: '0x2ab526354a39e7f5d272f327fa94e757df3688188d4a92c6dc3623ab79894e2',
  SLINK: '0x13ff4e86fa3e7286cc5c64b62f4099cf41e7918d727d22a5109ecfd00274d19',
  SSTR: '0x102d5e124c51b936ee87302e0f938165aec96fb6c2027ae7f3a5ed46c77573b',
  STRK: '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  SWAY: '0x4878d1148318a31829523ee9c6a5ee563af6cd87f90a30809e5b0d27db8a9b',
  UNI: '0x49210ffc442172463f3177147c1aeaa36c51d152c1b0630f2364c300d4f48ee',
  UNO: '0x719b5092403233201aa822ce928bd4b551d0cdb071a724edd7dc5e5f57b7f34',
  USDC: '0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
  USDT: '0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
  WBTC: '0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
  WIZ: '0x6e987f1e703c549991e1c13b8f1b8e1e6f8bba068a0715b9aacb51dba2800f',
  ZEND: '0x585c32b625999e6e5e78645ff8df7a9001cf5cf3eb6b80ccdd16cb64bd3a34',
  kSTRK: '0x45cd05ee2caaac3459b87e5e2480099d201be2f62243f839f00e10dde7f500c',
  rETH: '0x319111a5037cbec2b3e638cc34a3474e2d2608299f3e62866e9cc683208c610',
  sSTRK: '0x356f304b154d29d2a8fe22f1cb9107a9b564a733cf6b4cc47fd121ac1af90c9',
  wstETH: '0x42b8f0484674ca266ac5d08e4ac6a3fe65bd3129795def2dca5c34ecc5f96d2',
  xSTRK: '0x28d709c875c0ceac3dce7065bec5328186dc89fe254527084d1689910954b0a',
};
