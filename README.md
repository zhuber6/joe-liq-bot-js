# Flash Loan Liquidator

This liquidation bot watches the Graph for underwater accounts and will attempt to liquidate based on parameters defined in the `liquidator.js` script. The initial thresholds are querying for health between 0.75 and 1, and greater borrowing than 10USD. Some limitations of the script are that it currently only handles liquidating one asset if the maximum borrowed asset is greater than double the supplied asset. This is because the contract doesn't support multiple asset liquidation yet. The bot attempts to always flash loan WAVAX, but if the borrow position is WAVAX, we will use DAI. The bot also doesn't handle accounts that supplied XJOE as collateral.

## Liquidator Contract

This contract will calculate amount to borrow based on borrowers position, get a flashloan, repay borrowers position, redeem seized assets and transfer profit to the owner of the contract. There are several events that will be emitted during a successful liquidation as well. The contract will emit when any swaps occur, after the liquidation occurs, and after seized collateral is converted and profit is calculated. To watch the events, use `watchEvents.js` script which will print formatted event data.

## Tests

There are three test scripts:

`testLiqBorrow.js`: Creates an underwater acccount and liquidates it without using our deployed contract.

`testLiquidator.js`: Creates an underwater account and liquidates using our contract.

`testLiqLocal.js`: Used to test liquidate a borrower that was underwater on mainnet, via mainnet fork locally.