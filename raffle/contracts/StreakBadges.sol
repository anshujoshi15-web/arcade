// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract StreakBadges is ERC721 {
    address private immutable round;
    uint256 public issued;
    mapping(uint256=>uint256) public weeksEarned;
    constructor() ERC721("House Raffle Streaks","HRS"){round=msg.sender;}
    function grant(address entrant,uint256 weeksCount) external {
        require(msg.sender==round);
        weeksEarned[++issued]=weeksCount;_mint(entrant,issued);
    }
    function tokenURI(uint256 id) public view override returns(string memory){
        _requireOwned(id);
        return string.concat("data:application/json;base64,",Base64.encode(bytes(string.concat('{"name":"',weeksEarned[id]==8?'Streak Keeper':'Gold Streak','","description":"House Raffle consecutive weekly entry collectible","attributes":[{"trait_type":"Weeks","value":',Strings.toString(weeksEarned[id]),'}]}'))));
    }
}
