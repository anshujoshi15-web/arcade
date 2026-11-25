// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/HouseRaffle.sol";
contract TestDollar is ERC20 {
    constructor() ERC20("Practice Dollar","PLAY"){}
    function decimals() public pure override returns(uint8){return 6;}
    function faucet() external {_mint(msg.sender,100e6);}
}
contract TestCoordinator is ICoordinator {
    mapping(uint256=>HouseRaffle) public consumer;
    uint256 public last;
    function requestRandomWords(Request calldata) external returns(uint256){consumer[++last]=HouseRaffle(msg.sender);return last;}
    function deliver(uint256 id,uint256 word) external {uint256[] memory words=new uint256[](1);words[0]=word;consumer[id].rawFulfillRandomWords(id,words);}
}
