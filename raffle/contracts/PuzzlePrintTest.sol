// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {PuzzlePrint} from "./PuzzlePrint.sol";

// Local-chain test fixture. Production uses PuzzlePrint, without fixture hooks.
contract PuzzlePrintTest is PuzzlePrint {
    constructor(Setup memory config, address[] memory nominees)
        PuzzlePrint(config, nominees, "https://arcade.thehouseofjoshi.com/puzzle-nft/") {}
    function fixturePaidSold(uint256 sold) external { paidSold = sold; }
    function fixtureSet(address player) external {
        for (uint256 id = 1; id <= 25; ++id) _mint(player, id, 1, "");
    }
}

import {TestDollar} from "./TestServices.sol";
contract PuzzlePrintTestDollar is TestDollar {
    function fixtureMint(address player, uint256 amount) external { _mint(player, amount); }
}
