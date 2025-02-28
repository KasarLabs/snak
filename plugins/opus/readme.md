## Opus Integration with Agent-Kit

This integration allows your agent to interact with the [Opus](https://www.opus.money/) protocol from Agent-Kit. Opus is a cross margin autonomous Decentralized Digital Bank (DDB) and its first digital asset is CASH, an algorithmic overcollateralized stablecoin soft pegged to the US dollar.

Follow the steps below to get started and set up your bot.

### Steps to Set Up Your Agent to interact with Opus

1. **Add Opus to your agent's plugin configuration**
   ```
   {
     "name": "Mito",
     ...
     "internal_plugins": ["rpc", "opus"]
   }
   ```

That's it!

## Available actions

An action in Opus is tied to a Trove, or otherwise commonly known as a collateralized
debt position (CDP). Therefore, you need to either create a Trove or specify the trove ID for each action.

### Creating a Trove

To create a trove, you will need to specify:

1. The [assets](https://docs.opus.money/current/borrowing) to deposit as collateral. You can specify multiple collateral in the same transaction;
2. The amount of CASH to borrow; and optionally
3. The acceptable amount of [borrow fees](https://docs.opus.money/current/borrowing) as a percentage of (2). If this is not specified, the prevailing borrow fee will be used.

If the transaction is successful, you will receive a trove ID.

### Managing a Trove

Once a Trove is created, there are four possible actions:

1. Deposit collateral
2. Withdraw collateral
3. Borrow CASH
4. Repay CASH

#### Deposit and withdraw collateral

To deposit or withdraw a collateral, you need to specify (1) the trove ID, (2) the asset symbol and (3) the amount of the asset to deposit or withdraw.

#### Borrow and repay CASH

To borrow or repay CASH, you need to specify (1) the trove ID and (2) the amount of CASH to borrow or repay.

When borrowing, you can additionally choose to specify the acceptable amount of borrow fees as a percentage of (2), with the default being the prevailing borrow fee.

### Fetch information

The following information can be fetched:

1. The trove IDs for an address;
2. The health of a Trove, specifically its debt, collateral value, loan-to-value ratio and liquidation threshold; and
3. The prevailing borrow fee.

## Troubleshooting

If you encounter any issues or questions specific to Opus, please reach out to us on [Discord](https://discord.gg/4enTVMudFD).
