// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Paramify is AccessControl {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    bytes32 public constant INSURANCE_ADMIN_ROLE = keccak256("INSURANCE_ADMIN_ROLE");

    AggregatorV3Interface public priceFeed;
    uint256 public insuranceAmount;
    bool public isInitialized;
    
    address public owner;

    struct Policy {
        address customer;
        uint256 premium; // Paid in wei
        uint256 coverage; // Payout amount in wei
        uint256 payoutRatePerSecond; // Payout rate per second in wei
        bool active;
        bool paidOut;
    }

    mapping(address => Policy) public policies;

    // Events
    event InsurancePurchased(address indexed customer, uint256 premium, uint256 coverage);
    event PayoutTriggered(address indexed customer, uint256 amount);
    event PayoutRateSet(address indexed user, uint256 payoutRatePerMinute);
    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized: Not owner");
        _;
    }

    constructor(address _priceFeedAddress) {
        owner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
        _grantRole(INSURANCE_ADMIN_ROLE, msg.sender);
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        isInitialized = true;
    }

    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    function setInsuranceAmount(uint256 _amount) public onlyRole(INSURANCE_ADMIN_ROLE) {
        insuranceAmount = _amount;
    }

    function setOracleAddress(address _oracleAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_oracleAddress != address(0), "Invalid oracle address");
        address oldOracle = address(priceFeed);
        priceFeed = AggregatorV3Interface(_oracleAddress);
        emit OracleAddressUpdated(oldOracle, _oracleAddress);
    }


    function buyInsurance(uint256 _payoutRatePerMinute) external payable {
        require(msg.value > 0, "Premium must be greater than 0");
        require(_payoutRatePerMinute > 0, "Payout rate must be greater than 0");
        require(!policies[msg.sender].active, "Policy already active");

        uint256 payoutRatePerSecond = _payoutRatePerMinute / 60;
        uint256 requiredPremium = _payoutRatePerMinute * 2;
        require(msg.value >= requiredPremium, "Insufficient premium");

        policies[msg.sender] = Policy({
            customer: msg.sender,
            premium: msg.value,
            coverage: 0, // Will be calculated based on duration
            payoutRatePerSecond: payoutRatePerSecond,
            active: true,
            paidOut: false
        });

        emit InsurancePurchased(msg.sender, msg.value, 0);
        emit PayoutRateSet(msg.sender, _payoutRatePerMinute);
    }

    function triggerPayout() external {
        Policy storage policy = policies[msg.sender];
        require(policy.active, "No active policy");
        require(!policy.paidOut, "Payout already issued");

        int256 outageDuration = getLatestPrice();
        require(uint256(outageDuration) > 0, "No outage recorded");

        policy.paidOut = true;
        policy.active = false;

        uint256 payoutAmount = uint256(outageDuration) * policy.payoutRatePerSecond;
        (bool sent, ) = msg.sender.call{value: payoutAmount}("");
        require(sent, "Payout failed");

        emit PayoutTriggered(msg.sender, payoutAmount);
    }

    // Check if payout conditions are met
    function isPayoutEligible(address _customer) external view returns (bool) {
        Policy memory policy = policies[_customer];
        if (!policy.active || policy.paidOut) {
            return false;
        }
        int256 outageDuration = getLatestPrice();
        return uint256(outageDuration) > 0;
    }

    // Get latest outage duration from oracle
    function getLatestOutageDuration() external view returns (int256) {
        return getLatestPrice();
    }

    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Withdrawal failed");
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }

    receive() external payable {}
}
