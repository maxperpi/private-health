// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEPrivateHealth
 * @notice Enables secure, private collection of health-related survey data
 *         using Fully Homomorphic Encryption (FHE). Each participant may
 *         submit exactly once, and answers are stored encrypted.
 */
contract FHEPrivateHealth is ZamaEthereumConfig {
    /// @dev Maps participant addresses to their encrypted responses
    mapping(address => euint32) private encryptedResponses;

    /// @dev Prevents multiple submissions from the same address
    mapping(address => bool) private submitted;

    /**
     * @notice Submit encrypted health survey answers
     * @param encryptedInput The encrypted uint32 payload representing user's answers
     * @param zkProof Zero-knowledge proof verifying the payload
     * @dev Only one submission per wallet is allowed
     */
    function submitHealthSurvey(externalEuint32 encryptedInput, bytes calldata zkProof) external {
        require(!submitted[msg.sender], "Submission already exists");

        euint32 cipherData = FHE.fromExternal(encryptedInput, zkProof);
        encryptedResponses[msg.sender] = cipherData;

        // Authorize decryption for the sender and this contract
        FHE.allow(cipherData, msg.sender);
        FHE.allowThis(cipherData);

        submitted[msg.sender] = true;
    }

    /**
     * @notice Check if a wallet has already submitted the survey
     * @param participant Address of the participant
     * @return True if the participant already submitted, false otherwise
     */
    function hasSubmitted(address participant) external view returns (bool) {
        return submitted[participant];
    }

    /**
     * @notice Retrieve the encrypted health survey data for a participant
     * @param participant Address to query
     * @return Encrypted euint32 data
     */
    function getEncryptedHealthData(address participant) external view returns (euint32) {
        return encryptedResponses[participant];
    }
}
