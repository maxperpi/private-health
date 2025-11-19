"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import {
  FhevmInstance,
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

/**
 * @hook usePrivateHealthSurvey
 * @description Provides encryption, submission, and decryption utilities
 *              for FHEPrivateHealth contract.
 */
export const usePrivateHealth = ({
  instance,
  supportedChains,
}: {
  instance?: FhevmInstance;
  supportedChains?: Readonly<Record<number, string>>;
}) => {
  const { storage: sigStorage } = useInMemoryStorage();
  const { chainId, accounts, ethersSigner, ethersReadonlyProvider } = useWagmiEthers(supportedChains);

  const activeChain = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  const { data: contractInfo } = useDeployedContractInfo({
    contractName: "FHEPrivateHealth",
    chainId: activeChain,
  });

  type PrivateHealthContract = Contract<"FHEPrivateHealth"> & { chainId?: number };

  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const contractAvailable = Boolean(contractInfo?.address && contractInfo?.abi);
  const providerAvailable = Boolean(ethersReadonlyProvider);
  const signerAvailable = Boolean(ethersSigner);

  const getContractInstance = (mode: "read" | "write") => {
    if (!contractAvailable) return undefined;
    const connection = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!connection) return undefined;
    return new ethers.Contract(contractInfo!.address, (contractInfo as PrivateHealthContract).abi, connection);
  };

  // Read encrypted survey for connected account
  const { data: encryptedDataRaw, refetch: refreshEncrypted } = useReadContract({
    address: contractAvailable ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: contractAvailable ? ((contractInfo as PrivateHealthContract).abi as any) : undefined,
    functionName: "getEncryptedHealthData",
    args: [accounts?.[0] ?? ""],
    query: {
      enabled: !!(contractAvailable && providerAvailable),
      refetchOnWindowFocus: false,
    },
  });

  const encryptedData = useMemo(() => encryptedDataRaw as string | undefined, [encryptedDataRaw]);

  const hasAlreadySubmitted = useMemo(() => {
    return !!encryptedData && encryptedData !== ethers.ZeroHash && encryptedData !== "0x0" && encryptedData !== "0x";
  }, [encryptedData]);

  const decryptionRequests = useMemo(() => {
    if (!contractAvailable || !encryptedData) return undefined;
    return [
      {
        handle: encryptedData,
        contractAddress: contractInfo!.address,
      },
    ] as const;
  }, [contractAvailable, encryptedData, contractInfo?.address]);

  const {
    decrypt,
    results,
    message: decryptMessage,
    canDecrypt,
    isDecrypting,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    chainId,
    requests: decryptionRequests,
    fhevmDecryptionSignatureStorage: sigStorage,
  });

  const [decodedAnswer, setDecodedAnswer] = useState<number | null>(null);

  useEffect(() => {
    if (!results || Object.keys(results).length === 0) return;
    const key = Object.keys(results)[0];
    const decryptedValue = results[key];
    if (typeof decryptedValue === "bigint") {
      setDecodedAnswer(Number(decryptedValue));
    }
  }, [results]);

  useEffect(() => {
    if (decryptMessage) setStatusMessage(decryptMessage);
  }, [decryptMessage]);

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: contractInfo?.address,
  });

  const detectEncryptMethod = (fnName: "submitHealthSurvey") => {
    const fnEntry = contractInfo?.abi.find(i => i.type === "function" && i.name === fnName);
    if (!fnEntry) return { method: undefined, error: `Missing ABI entry for ${fnName}` };
    return { method: getEncryptionMethod(fnEntry.inputs?.[0]?.internalType), error: undefined };
  };

  const submitSurvey = useCallback(
    async (answer: number) => {
      if (answer == null || isPending) return;
      setIsPending(true);

      try {
        setStatusMessage("Encrypting your health survey answer...");

        const { method, error } = detectEncryptMethod("submitHealthSurvey");
        if (!method) return setStatusMessage(error ?? "Encryption method not found");

        const encryptedPayload = await encryptWith(ctx => (ctx as any)[method](answer));
        if (!encryptedPayload) return setStatusMessage("Encryption failed");

        const contractWrite = getContractInstance("write");
        if (!contractWrite) return setStatusMessage("Contract not ready");

        const params = buildParamsFromAbi(encryptedPayload, [...contractInfo!.abi] as any[], "submitHealthSurvey");

        const tx = await contractWrite.submitHealthSurvey(...params, { gasLimit: 400_000 });
        await tx.wait();

        await refreshEncrypted();
        setStatusMessage("✅ Health survey submitted!");
      } catch (err) {
        setStatusMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsPending(false);
      }
    },
    [encryptWith, getContractInstance, contractInfo?.abi, isPending, refreshEncrypted],
  );

  return {
    submitSurvey,
    decrypt,
    canDecrypt,
    isDecrypting,
    decodedAnswer,
    encryptedData,
    hasAlreadySubmitted,
    statusMessage,
    isPending,
    contractAvailable,
    signerAvailable,
    accounts,
    chainId,
  };
};
