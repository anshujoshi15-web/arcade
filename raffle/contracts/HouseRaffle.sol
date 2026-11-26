// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./StreakBadges.sol";

interface ICoordinator {
    struct Request { bytes32 keyHash; uint256 subId; uint16 confirmations; uint32 gasLimit; uint32 words; bytes extraArgs; }
    function requestRandomWords(Request calldata request) external returns (uint256);
}

contract HouseRaffle is ERC721Enumerable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    struct Config {
        IERC20 currency; ICoordinator coordinator; bytes32 keyHash; uint256 subscription;
        address house; address registrar; uint64 opens; uint64 closes; uint64 drawAt; uint32 edition;
    }
    Config public config;
    HouseRaffle public immutable previous;
    StreakBadges public immutable badges;
    mapping(address=>uint256) public streak;
    mapping(address=>bool) public usedBonus;
    uint256 private reservedGold;
    uint256 private regularSerial;
    uint256 public goldPriorityUntil;
    address[] public charities;
    mapping(address => uint256) public votes;
    mapping(address => bool) public nominated;
    mapping(address => uint256) public eligibleUntil;
    mapping(address => uint256) public issued;
    uint256 private lockedClose;
    bool public cancelled;
    mapping(address => uint256) public paidBy;
    mapping(address => uint256) private lastFreeWeek;
    mapping(uint256 => bool) public early;
    mapping(uint256=>address) public originalEntrant;
    uint256 public minted;
    uint256 public sold;
    uint256 public requestId;
    uint256 public seed;
    bool public seeded;
    uint256 public cursor;
    uint256 public places;
    uint256 public deadline;
    uint256 public outstanding;
    address public charity;
    mapping(address => bool) public won;
    uint256[5] public winners;
    mapping(uint256 => address) public claimant;
    mapping(uint256 => uint256) public award;
    mapping(uint256 => bool) public claimed;
    event Entry(address indexed wallet,uint256 first,uint256 count,bool free,address nominee);
    event RoundCancelled(address indexed house);
    event FundsRecovered(address indexed house, uint256 amount);
    event Requested(uint256 indexed requestId);
    event SeedReceived(uint256 indexed requestId,uint256 word);
    event Winner(uint256 indexed serial,address indexed wallet,uint256 amount);
    event Settled(address indexed charity,uint256 donation,uint256 operations);
    event PrizeClaimed(uint256 indexed serial, address indexed recipient, uint256 usdcValue);
    event Swept(address indexed charity,uint256 amount);

    constructor(Config memory c,address[] memory recipients, HouseRaffle prior) ERC721("House Raffle Ticket","HRT") {
        require(address(c.currency).code.length>0 && address(c.coordinator).code.length>0);
        require(c.house!=address(0) && c.registrar!=address(0) && c.opens<c.closes && c.closes<=c.drawAt);
        require(recipients.length>0 && recipients.length<=32);
        config=c;
        previous=prior;
        badges=new StreakBadges();
        if(address(prior)!=address(0)){
            (,,,,,,uint64 lastOpen,,,uint32 lastEdition)=prior.config();
            require(c.edition==lastEdition+1 && c.opens>=lastOpen+6 days);
            goldPriorityUntil=c.opens+1 hours;
        }
        for(uint256 i;i<recipients.length;i++){
            require(recipients[i]!=address(0));
            for(uint256 j;j<i;j++) require(recipients[j]!=recipients[i]);
            charities.push(recipients[i]);
        }
    }
    function charityCount() external view returns(uint256){return charities.length;}
    function attest(address wallet,uint256 until) external {
        require(msg.sender==config.registrar && wallet!=config.registrar && wallet!=config.house && wallet!=address(this));
        eligibleUntil[wallet]=until;
    }
    function postponementLimit() public view returns (uint256) {
        return config.closes + 4 weeks;
    }
    function expired() public view returns (bool) {
        return sold < 6000 && block.timestamp >= postponementLimit();
    }
    function salesClose() public view returns (uint256) {
        if (lockedClose != 0) return lockedClose;
        if (block.timestamp >= postponementLimit()) return postponementLimit();
        if (block.timestamp < config.closes) return config.closes;
        return config.closes + ((block.timestamp - config.closes) / 1 weeks + 1) * 1 weeks;
    }
    function drawTime() public view returns (uint256) {
        return salesClose() + config.drawAt - config.closes;
    }
    function postponements() external view returns (uint256) {
        return (salesClose() - config.closes) / 1 weeks;
    }
    function closed() public view returns (bool) {
        return cancelled || expired() || minted == 10000 || (lockedClose != 0 && block.timestamp >= lockedClose);
    }
    function remainingFreeCapacity() public view returns (uint256) {
        return 4000 - (minted - sold);
    }
    function entryWeek() private view returns (uint256) {
        return block.timestamp < config.opens ? 0 : (block.timestamp - config.opens) / 1 weeks + 1;
    }
    function usedFree(address wallet) public view returns (bool) {
        uint256 week = entryWeek();
        return week != 0 && lastFreeWeek[wallet] == week;
    }
    function buy(uint256 count,uint256 nominee) external nonReentrant {
        require(count>0 && count<=25);
        uint256 scheduledClose = salesClose();
        config.currency.safeTransferFrom(msg.sender,address(this),count*1e6);
        _enter(count,nominee,false);
        paidBy[msg.sender] += count * 1e6;
        if (lockedClose == 0 && sold >= 6000) lockedClose = scheduledClose;
    }
    function claimFree(uint256 nominee) external nonReentrant {
        require(!usedFree(msg.sender));
        lastFreeWeek[msg.sender] = entryWeek();
        _enter(1,nominee,true);
    }
    function claimBonus(uint256 nominee) external nonReentrant {
        require(address(previous)!=address(0) && previous.streak(msg.sender)==4 && !usedBonus[msg.sender]);
        usedBonus[msg.sender]=true;_enter(1,nominee,true);
    }
    function _enter(uint256 count,uint256 nominee,bool free) private {
        require(block.timestamp>=config.opens && !closed() && minted+count<=10000);
        if (free) require(count <= remainingFreeCapacity());
        require(issued[msg.sender]+count<=100 && balanceOf(msg.sender)+count<=100);
        address choice=charities[nominee];
        if(!nominated[msg.sender]){
            votes[choice]++;nominated[msg.sender]=true;
            uint256 weeksCount=1;
            if(address(previous)!=address(0))weeksCount+=previous.streak(msg.sender);
            streak[msg.sender]=weeksCount;
            if(weeksCount==8 || weeksCount==12)badges.grant(msg.sender,weeksCount);
        }
        issued[msg.sender]+=count;

        for(uint256 i;i<count;i++){
            minted++;
            bool priority=block.timestamp>=goldPriorityUntil || previous.streak(msg.sender)>=12;
            uint256 id;
            if(priority && reservedGold<100)id=++reservedGold;
            else {require(regularSerial<9900);id=100+(++regularSerial);}
            emit Entry(msg.sender,id,1,free,choice);
            if(!free) early[id]=++sold<=1000;
            originalEntrant[id]=msg.sender;_mint(msg.sender,id);
        }
    }
    function _update(address to,uint256 id,address auth) internal override returns(address){
        if(deadline==0){
            if(_ownerOf(id)!=address(0)) require(!closed());
            require(eligibleUntil[to]>=block.timestamp && balanceOf(to)<100);
        }
        return super._update(to,id,auth);
    }
    function emergencyClose() external nonReentrant {
        require(msg.sender == config.house, "House wallet only");
        require(!cancelled && requestId == 0, "Cancellation unavailable");
        cancelled = true;
        emit RoundCancelled(msg.sender);
    }
    function recoverFunds() external nonReentrant {
        require(msg.sender == config.house, "House wallet only");
        require(cancelled, "Round not cancelled");
        uint256 amount = config.currency.balanceOf(address(this));
        require(amount != 0, "No funds to recover");
        config.currency.safeTransfer(config.house, amount);
        emit FundsRecovered(config.house, amount);
    }
    function requestDraw() external nonReentrant {
        require(!cancelled && sold>=6000 && requestId==0 && (block.timestamp>=drawTime() || minted==10000));
        requestId=config.coordinator.requestRandomWords(ICoordinator.Request(config.keyHash,config.subscription,10,150000,1,
            abi.encodeWithSelector(bytes4(keccak256("VRF ExtraArgsV1")),false)));
        require(requestId!=0);emit Requested(requestId);
    }
    function rawFulfillRandomWords(uint256 id,uint256[] calldata words) external {
        require(msg.sender==address(config.coordinator) && id==requestId && id!=0 && !seeded);
        seed=words[0];seeded=true;emit SeedReceived(id,seed);
    }
    function finalize() external nonReentrant {
        require(seeded && deadline==0);
        uint256[5] memory rates=[uint256(150000),80000,50000,30000,20000];
        for(uint256 attempts;attempts<64 && places<5;attempts++){
            uint256 index=1+uint256(keccak256(abi.encode(seed,cursor++)))%minted;
            uint256 serial=index<=reservedGold?index:100+index-reservedGold;
            address player=ownerOf(serial);
            if(won[player])continue;
            won[player]=true;claimant[serial]=player;
            award[serial]=sold*rates[places];outstanding+=award[serial];
            winners[places++]=serial;emit Winner(serial,player,award[serial]);
        }
        if(places==5){
            charity=charities[0];
            for(uint256 i=1;i<charities.length;i++) if(votes[charities[i]]>votes[charity]) charity=charities[i];
            deadline=block.timestamp+30 days;
            config.currency.safeTransfer(charity,sold*340000);
            config.currency.safeTransfer(config.house,sold*330000);
            emit Settled(charity,sold*340000,sold*330000);
        }
    }
    function claim(uint256 id) external nonReentrant {
        require(deadline!=0 && block.timestamp<=deadline && claimant[id]==msg.sender && !claimed[id]);
        claimed[id]=true;outstanding-=award[id];config.currency.safeTransfer(config.house,award[id]);
        emit PrizeClaimed(id,msg.sender,award[id]);
    }
    function sweep() external nonReentrant {
        require(deadline!=0 && block.timestamp>deadline && outstanding>0);
        uint256 amount=outstanding;outstanding=0;config.currency.safeTransfer(charity,amount);emit Swept(charity,amount);
    }
    function tokenURI(uint256 id) public view override returns(string memory){
        _requireOwned(id);
        string memory number=Strings.toString(100000+id);
        bytes memory serial=new bytes(5);
        for(uint256 i;i<5;i++)serial[i]=bytes(number)[i+1];
        string memory status=(cancelled || expired())?"Cancelled":claimed[id]?"Claimed":wonSerial(id)?"Winner":deadline!=0?"Draw complete":"Entered";
        bytes memory image = ticketArtwork(serial, id <= 100, uint256(config.edition).toString());
        bytes memory attributes = ticketAttributes(id, status);
        return string.concat("data:application/json;base64,", Base64.encode(abi.encodePacked(
            '{"name":"House Raffle #', serial,
            '","image":"data:image/svg+xml;base64,', Base64.encode(image),
            '","attributes":', attributes, '}'
        )));
    }

    function ticketAttributes(uint256 id, string memory status) private view returns (bytes memory) {
        return abi.encodePacked(
            '[{"trait_type":"Result","value":"', status,
            '"},{"trait_type":"Tier","value":"', id <= 100 ? 'Gold' : 'Standard',
            '"},{"trait_type":"Streak weeks","value":', streak[originalEntrant[id]].toString(),
            '},{"trait_type":"Early","value":"', early[id] ? 'Yes' : 'No', '"}]'
        );
    }

    function ticketArtwork(bytes memory serial, bool gold, string memory edition) private pure returns (bytes memory) {
        bytes memory paper=abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><defs><linearGradient id="gold" x1="0%" y1="8%" x2="100%" y2="92%"><stop offset="0" stop-color="#986018"/><stop offset=".16" stop-color="#d6a03e"/><stop offset=".34" stop-color="#ffe7a0"/><stop offset=".43" stop-color="#fff3bf"/><stop offset=".56" stop-color="#d9a541"/><stop offset=".74" stop-color="#bc8022"/><stop offset=".90" stop-color="#f9da79"/><stop offset="1" stop-color="#ac6d1c"/></linearGradient>',
            '<pattern id="grain" width="5" height="7" patternUnits="userSpaceOnUse"><path d="M1 1h1m2 4h1" stroke="#15132b" opacity=".12"/></pattern>',
            '<mask id="ticket"><rect x="12" y="12" width="776" height="376" rx="12" fill="white"/><g fill="black"><circle cx="590" cy="12" r="13"/><circle cx="590" cy="388" r="13"/><circle cx="12" cy="200" r="10"/><circle cx="788" cy="200" r="10"/></g></mask></defs>',
            '<g mask="url(#ticket)"><rect width="800" height="400" fill="',
            gold?'url(#gold)':'#e8efff',
            '"/><rect width="800" height="400" fill="url(#grain)"/>',
            '<g fill="none" stroke="',
            gold?'#3e2407':'#0000ff',
            '"><rect x="26" y="26" width="748" height="348" rx="7" stroke-width="2"/><rect x="33" y="33" width="734" height="334" rx="4"/><path d="M590 35V365" stroke-width="2" stroke-dasharray="4 6"/><path d="M62 95H555M62 231H555M62 326H555"/><path d="M629 297v29m4-29v29m6-29v29m4-29v29m7-29v29m3-29v29m5-29v29m7-29v29m4-29v29m3-29v29m8-29v29m4-29v29m7-29v29m6-29v29m3-29v29m6-29v29m6-29v29m4-29v29m7-29v29m5-29v29"/></g>'
        );
        bytes memory mainTicket = abi.encodePacked(
            paper,
            '<g fill="',
            gold?'#2d1803':'#00184d',
            '"><text x="62" y="78" font-family="monospace" font-size="17" letter-spacing="3">THE HOUSE OF JOSHI</text>',
            '<text x="62" y="172" font-family="Georgia,serif" font-weight="bold" font-size="65">House Raffle</text>',
            '<text x="64" y="209" font-family="monospace" font-size="16" letter-spacing="2">WEEKLY CHARITABLE DRAW</text>',
            '<text x="62" y="300" font-family="monospace" font-size="49" font-weight="bold">No. ',
            serial,
            '</text>',
            '<text x="62" y="350" font-family="monospace" font-size="17" letter-spacing="2">ROUND ',
            edition,
            '</text>',
            '<text x="555" y="350" text-anchor="end" font-family="monospace" font-size="17">',
            gold?'GOLD SERIES':'STANDARD SERIES',
            '</text>'
        );
        return abi.encodePacked(
            mainTicket,
            '<g text-anchor="middle" font-family="monospace"><text x="681" y="77" font-size="15" letter-spacing="2">DRAW STUB</text><text x="681" y="139" font-family="Georgia,serif" font-size="26" font-weight="bold">ADMIT</text><text x="681" y="204" font-family="Georgia,serif" font-size="65">ONE</text><text x="681" y="263" font-size="25" font-weight="bold">',
            serial,
            '</text></g></g></g></svg>'
        );
    }
    function wonSerial(uint256 id) private view returns(bool){return claimant[id]!=address(0);}
}
