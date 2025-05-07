export const verifierABI = [
  {
    inputs: [
      {
        name: 'block_hash',
        type: 'felt',
      },
      {
        name: 'program_outputs_len',
        type: 'felt',
      },
      {
        name: 'program_outputs',
        type: 'felt*',
      },
      {
        name: 'public_inputs_len',
        type: 'felt',
      },
      {
        name: 'public_inputs',
        type: 'felt*',
      },
      {
        name: 'security_level',
        type: 'felt',
      },
      {
        name: 'num_queries',
        type: 'felt',
      },
      {
        name: 'blowup_factor',
        type: 'felt',
      },
    ],
    name: 'verify_proof',
    outputs: [
      {
        name: 'is_valid',
        type: 'felt',
      },
    ],
    type: 'function',
  },
];
