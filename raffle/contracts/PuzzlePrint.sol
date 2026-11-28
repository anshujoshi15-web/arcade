// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts@5.1.0/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts@5.1.0/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@5.1.0/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts@5.1.0/utils/Strings.sol";

interface IPuzzleVRF {
    struct Request { bytes32 keyHash; uint256 subId; uint16 confirmations; uint32 gasLimit; uint32 words; bytes extraArgs; }
    function requestRandomWords(Request calldata request) external returns (uint256);
}

contract PuzzlePrint is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    uint256 public constant PRICE = 2e6;
    uint256 public constant SUPPLY = 25000;
    uint256 public constant GATE = 18182;
    uint256 public constant COMPLETED = 26;
    uint256 public constant MAX_FREE = SUPPLY - GATE;
    struct Setup { address usdc; address coordinator; bytes32 keyHash; uint256 subscription; address house; uint64 opens; uint64 closes; }
    struct Draw { address player; uint8 quantity; bool free; bool ready; uint64 at; uint256 seed; }
    struct Offer { address maker; uint8 offered; uint8 wanted; }
    struct Winner { address wallet; uint256 usdcValue; bytes32 payout; }

    Setup public setup;
    address[] public recipients;
    Winner[10] public winners;
    uint256[10] public ladder = [uint256(5000e6),4000e6,3000e6,642860000,642860000,642860000,642860000,642860000,642860000,642840000];
    mapping(uint256 => Draw) public draws;
    mapping(uint256 => uint256) public queue;
    mapping(uint256 => address) public drawBuyer;
    mapping(uint256 => uint256[]) private drawnPieces;
    mapping(address => uint256) public pending;
    mapping(address => uint256) public held;
    mapping(address => uint256) public lastFreeWeek;
    mapping(address => uint256) public paidBy;
    mapping(address => bool) public voted;
    mapping(address => bool) public claimed;
    mapping(address => bool) public participated;
    mapping(uint256 => uint256) public votes;
    mapping(uint256 => Offer) public offers;
    mapping(bytes32 => bool) public usedReceipt;
    mapping(uint256 => uint256) private swaps;
    uint256 public head = 1;
    uint256 public tail;
    uint256 public remaining = SUPPLY;
    uint256 public reserved;
    uint256 public freeCount;
    uint256 public paidSold;
    uint256 public prizeSpent;
    uint256 public places;
    uint256 public offerCount;
    address public donationRecipient;
    bool public refundMode;
    bool public settled;
    uint256 public settlementBlock;

    event DrawRequested(uint256 indexed id, address indexed buyer, uint256 quantity, bool free);
    event DrawReady(uint256 indexed id);
    event PiecesDrawn(uint256 indexed id, address indexed buyer, uint256[] pieces);
    event DrawExpired(uint256 indexed id, address indexed buyer);
    event TradeOpened(uint256 indexed id, address indexed maker, uint256 offered, uint256 wanted);
    event TradeClosed(uint256 indexed id, address taker);
    event Nominated(address indexed player, uint256 indexed option);
    event Claimed(uint256 indexed place, address indexed player, uint256 usdcValue);
    event Settled(address indexed recipient, uint256 donation, uint256 house, uint256 unclaimed);
    event PayoutRecorded(uint256 indexed place, bytes32 indexed transactionHash);

    constructor(Setup memory config, address[] memory nominees, string memory baseURI) ERC1155(baseURI) {
        require(config.usdc.code.length > 0 && config.coordinator.code.length > 0 && config.house != address(0), "Invalid services");
        require(config.opens < config.closes && nominees.length > 0 && nominees.length <= 32, "Invalid setup");
        for (uint256 i; i < nominees.length; ++i) {
            require(nominees[i] != address(0), "Invalid recipient");
            for (uint256 j; j < i; ++j) require(nominees[i] != nominees[j], "Duplicate recipient");
        }
        setup = config;
        recipients = nominees;
    }
    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(super.uri(id), id.toString(), ".json");
    }
    function recipientCount() external view returns (uint256) { return recipients.length; }
    function claimDeadline() public view returns (uint256) { return uint256(setup.closes) + 30 days; }
    function prizeFunded() public view returns (uint256) { return paidSold * 660000; }
    function piecesFor(uint256 request) external view returns (uint256[] memory) { return drawnPieces[request]; }

    function buy(uint8 quantity) external nonReentrant returns (uint256) {
        require(quantity > 0 && quantity <= 25, "1 to 25 pieces");
        IERC20(setup.usdc).safeTransferFrom(msg.sender, address(this), PRICE * quantity);
        return _request(quantity, false);
    }
    function freePiece() external nonReentrant returns (uint256) {
        require(block.timestamp >= setup.opens && freeCount < MAX_FREE, "Free pieces unavailable");
        uint256 week = (block.timestamp - setup.opens) / 1 weeks + 1;
        require(lastFreeWeek[msg.sender] < week, "Weekly piece used");
        lastFreeWeek[msg.sender] = week;
        freeCount++;
        return _request(1, true);
    }
    function _request(uint8 quantity, bool free) private returns (uint256 request) {
        require(block.timestamp >= setup.opens && block.timestamp < setup.closes, "Entries closed");
        require(reserved + quantity <= remaining && held[msg.sender] + pending[msg.sender] + quantity <= 50, "Piece limit");
        reserved += quantity;
        pending[msg.sender] += quantity;
        request = IPuzzleVRF(setup.coordinator).requestRandomWords(IPuzzleVRF.Request(
            setup.keyHash, setup.subscription, 10, 120000, 1,
            abi.encodeWithSelector(bytes4(keccak256("VRF ExtraArgsV1")), false)
        ));
        require(request != 0 && draws[request].player == address(0) && drawBuyer[request] == address(0), "Invalid request");
        queue[++tail] = request;
        draws[request] = Draw(msg.sender, quantity, free, false, uint64(block.timestamp), 0);
        emit DrawRequested(request, msg.sender, quantity, free);
    }
    function rawFulfillRandomWords(uint256 request, uint256[] calldata words) external {
        require(msg.sender == setup.coordinator, "Coordinator only");
        Draw storage draw = draws[request];
        if (draw.player == address(0) || draw.ready) return;
        draw.seed = words[0];
        draw.ready = true;
        emit DrawReady(request);
    }
    function _advance(uint256 request) private {
        require(request != 0 && queue[head] == request, "Earlier draw pending");
        delete queue[head++];
        delete draws[request];
    }
    function finishDraw(uint256 request) external nonReentrant {
        Draw memory draw = draws[request];
        require(draw.ready, "Randomness pending");
        _advance(request);
        reserved -= draw.quantity;
        if (!draw.free) {
            paidSold += draw.quantity;
            paidBy[draw.player] += PRICE * draw.quantity;
        }
        drawBuyer[request] = draw.player;
        participated[draw.player] = true;
        uint256[] memory ids = new uint256[](draw.quantity);
        uint256[] memory values = new uint256[](draw.quantity);
        for (uint256 i; i < draw.quantity; ++i) {
            uint256 position = uint256(keccak256(abi.encode(draw.seed, request, i))) % remaining;
            uint256 item = swaps[position] == 0 ? position + 1 : swaps[position];
            --remaining;
            if (position != remaining) swaps[position] = swaps[remaining] == 0 ? remaining + 1 : swaps[remaining];
            delete swaps[remaining];
            ids[i] = (item - 1) % 25 + 1;
            values[i] = 1;
        }
        drawnPieces[request] = ids;
        _update(address(0), address(this), ids, values);
        emit PiecesDrawn(request, draw.player, ids);
    }
    function collectDraw(uint256 request) external nonReentrant {
        require(msg.sender == drawBuyer[request] && !refundMode, "Collection unavailable");
        uint256[] memory ids = drawnPieces[request];
        require(ids.length > 0, "Already collected");
        delete drawnPieces[request];
        pending[msg.sender] -= ids.length;
        uint256[] memory values = new uint256[](ids.length);
        for (uint256 i; i < ids.length; ++i) values[i] = 1;
        _safeBatchTransferFrom(address(this), msg.sender, ids, values, "");
    }
    function expireDraw(uint256 request) external nonReentrant {
        Draw memory draw = draws[request];
        require(draw.player != address(0) && !draw.ready && block.timestamp >= uint256(draw.at) + 2 days, "Cannot expire");
        _advance(request);
        reserved -= draw.quantity;
        pending[draw.player] -= draw.quantity;
        if (draw.free) {
            --freeCount;
            uint256 week = (uint256(draw.at) - setup.opens) / 1 weeks + 1;
            if (lastFreeWeek[draw.player] == week) delete lastFreeWeek[draw.player];
        } else {
            IERC20(setup.usdc).safeTransfer(draw.player, PRICE * draw.quantity);
        }
        emit DrawExpired(request, draw.player);
    }
    function nominate(uint256 option) external {
        require(block.timestamp < setup.closes && !voted[msg.sender] && option < recipients.length && participated[msg.sender], "Nomination unavailable");
        voted[msg.sender] = true;
        votes[option]++;
        emit Nominated(msg.sender, option);
    }
    function offerTrade(uint8 offered, uint8 wanted) external nonReentrant returns (uint256 id) {
        require(!refundMode && offered > 0 && offered <= 25 && wanted > 0 && wanted <= 25 &&
            offered != wanted && balanceOf(msg.sender, offered) >= 2, "Offer a duplicate");
        id = ++offerCount;
        offers[id] = Offer(msg.sender, offered, wanted);
        _update(msg.sender, address(this), _single(offered), _single(1));
        pending[msg.sender]++;
        emit TradeOpened(id, msg.sender, offered, wanted);
    }
    function acceptTrade(uint256 id) external nonReentrant {
        Offer memory offer = offers[id];
        require(!refundMode && offer.maker != address(0) && offer.maker != msg.sender, "Invalid offer");
        delete offers[id];
        pending[offer.maker]--;
        _update(msg.sender, address(this), _single(offer.wanted), _single(1));
        _safeTransferFrom(address(this), offer.maker, offer.wanted, 1, "");
        _safeTransferFrom(address(this), msg.sender, offer.offered, 1, "");
        emit TradeClosed(id, msg.sender);
    }
    function cancelTrade(uint256 id) external nonReentrant {
        Offer memory offer = offers[id];
        require(msg.sender == offer.maker, "Maker only");
        delete offers[id];
        pending[msg.sender]--;
        _safeTransferFrom(address(this), msg.sender, offer.offered, 1, "");
        emit TradeClosed(id, address(0));
    }
    function claim() external nonReentrant {
        uint256 place = places;
        require(!refundMode && !settled && block.timestamp <= claimDeadline() && paidSold >= GATE && place < 10 && !claimed[msg.sender], "Claims unavailable");
        uint256 amount = ladder[place];
        require(prizeSpent + amount <= prizeFunded(), "Place not funded");
        uint256[] memory ids = new uint256[](25);
        uint256[] memory values = new uint256[](25);
        for (uint256 i; i < 25; ++i) { ids[i] = i + 1; values[i] = 1; }
        claimed[msg.sender] = true;
        places = place + 1;
        prizeSpent += amount;
        winners[place] = Winner(msg.sender, amount, bytes32(0));
        _burnBatch(msg.sender, ids, values);
        _mint(msg.sender, COMPLETED, 1, "");
        IERC20(setup.usdc).safeTransfer(setup.house, amount);
        emit Claimed(place + 1, msg.sender, amount);
    }
    function settle() external nonReentrant {
        require(block.timestamp > claimDeadline() && reserved == 0 && !settled && paidSold >= GATE, "Settlement unavailable");
        settled = true;
        settlementBlock = block.number;
        uint256 chosen;
        for (uint256 i = 1; i < recipients.length; ++i) if (votes[i] > votes[chosen]) chosen = i;
        donationRecipient = recipients[chosen];
        uint256 donation = paidSold * 680000;
        uint256 house = paidSold * 660000;
        uint256 unclaimed = prizeFunded() - prizeSpent;
        IERC20(setup.usdc).safeTransfer(donationRecipient, donation + unclaimed);
        IERC20(setup.usdc).safeTransfer(setup.house, house);
        emit Settled(donationRecipient, donation, house, unclaimed);
    }
    function openRefunds() external {
        require(block.timestamp >= setup.closes && reserved == 0 && paidSold < GATE, "Refunds unavailable");
        refundMode = true;
    }
    function refund() external nonReentrant {
        uint256 amount = paidBy[msg.sender];
        require(refundMode && amount != 0, "No refund");
        paidBy[msg.sender] = 0;
        IERC20(setup.usdc).safeTransfer(msg.sender, amount);
    }
    function recordPayout(uint256 place, bytes32 transactionHash) external {
        require(msg.sender == setup.house && transactionHash != bytes32(0) && !usedReceipt[transactionHash], "Invalid receipt");
        require(place > 0 && place <= places && winners[place - 1].payout == bytes32(0), "Winner receipt unavailable");
        usedReceipt[transactionHash] = true;
        winners[place - 1].payout = transactionHash;
        emit PayoutRecorded(place, transactionHash);
    }
    function _single(uint256 value) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = value;
    }
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        super._update(from, to, ids, values);
        uint256 pieces;
        for (uint256 i; i < ids.length; ++i) if (ids[i] <= 25) pieces += values[i];
        if (from != address(0) && from != address(this)) held[from] -= pieces;
        if (to != address(0) && to != address(this)) {
            held[to] += pieces;
            require(held[to] + pending[to] <= 50, "Wallet cap");
        }
    }
}
