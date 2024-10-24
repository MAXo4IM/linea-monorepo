import { BytesLike, Transaction, Wallet, ethers } from "ethers";
import { commitmentsToVersionedHashes } from "@ethereumjs/util";
import * as kzg from "c-kzg";
import submissionDataJson from "./blocks-1-46.json";
import submissionDataJson2 from "./blocks-47-92.json";
import submissionDataJson3 from "./blocks-93-127.json";
import aggregateProof1to46 from "./aggregatedProof-1-46.json";
import aggregateProof47to127 from "./aggregatedProof-47-127.json";
import { DataHexString } from "ethers/lib.commonjs/utils/data";

type SubmissionData = {
  parentStateRootHash: string;
  dataParentHash: string;
  finalStateRootHash: string;
  firstBlockInData: bigint;
  finalBlockInData: bigint;
  snarkHash: string;
};

export function generateSubmissionDataFromJSON(
  startingBlockNumber: number,
  endingBlockNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedJSONData: any,
): { submissionData: SubmissionData; blob: Uint8Array } {
  const returnData = {
    parentStateRootHash: parsedJSONData.parentStateRootHash,
    dataParentHash: parsedJSONData.parentDataHash,
    finalStateRootHash: parsedJSONData.finalStateRootHash,
    firstBlockInData: BigInt(startingBlockNumber),
    finalBlockInData: BigInt(endingBlockNumber),
    snarkHash: parsedJSONData.snarkHash,
  };

  return {
    submissionData: returnData,
    blob: ethers.decodeBase64(parsedJSONData.compressedData),
  };
}
export function generateSubmissionCallDataFromJSON(
  startingBlockNumber: number,
  endingBlockNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedJSONData: any,
): { submissionData: SubmissionData } {
  const returnData = {
    parentStateRootHash: parsedJSONData.parentStateRootHash,
    dataParentHash: parsedJSONData.parentDataHash,
    finalStateRootHash: parsedJSONData.finalStateRootHash,
    firstBlockInData: BigInt(startingBlockNumber),
    finalBlockInData: BigInt(endingBlockNumber),
    snarkHash: parsedJSONData.snarkHash,
    compressedData: ethers.hexlify(ethers.decodeBase64(parsedJSONData.compressedData)),
  };

  return {
    submissionData: returnData,
  };
}

function requireEnv(name: string): string {
  const envVariable = process.env[name];
  if (!envVariable) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return envVariable;
}

function kzgCommitmentsToVersionedHashes(commitments: Uint8Array[]): string[] {
  const versionedHashes = commitmentsToVersionedHashes(commitments);
  return versionedHashes.map((versionedHash) => ethers.hexlify(versionedHash));
}

async function main() {
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY");
  const destinationAddress = requireEnv("DESTINATION_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  kzg.loadTrustedSetup(`${__dirname}/../trusted_setup.txt`);

  const { submissionData } = generateSubmissionCallDataFromJSON(1, 46, submissionDataJson);
  const { submissionData: submissionData2, blob: blob2 } = generateSubmissionDataFromJSON(47, 92, submissionDataJson2);
  const { submissionData: submissionData3, blob: blob3 } = generateSubmissionDataFromJSON(93, 127, submissionDataJson3);

  const commitments2 = kzg.blobToKzgCommitment(blob2);
  const commitments3 = kzg.blobToKzgCommitment(blob3);

  const [versionedHashes2, versionedHashes3] = kzgCommitmentsToVersionedHashes([commitments2, commitments3]);

  await submitCalldata(submissionData);

  let encodedCall = encodeCall(submissionData2, [commitments2], submissionDataJson2);
  await submitBlob(provider, wallet, encodedCall, destinationAddress, [versionedHashes2], blob2);

  encodedCall = encodeCall(submissionData3, [commitments3], submissionDataJson3);
  await submitBlob(provider, wallet, encodedCall, destinationAddress, [versionedHashes3], blob3);

  await sendProof(aggregateProof1to46);
  await sendProof(aggregateProof47to127);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function encodeCall(submissionData: SubmissionData, commitments: BytesLike[], submissionDataJson: any): DataHexString {
  const encodedCall = ethers.concat([
    "0x2d3c12e5",
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bytes32,bytes32,bytes32,uint256,uint256,bytes32)", "uint256", "bytes", "bytes"],
      [
        [
          submissionData.parentStateRootHash,
          submissionData.dataParentHash,
          submissionData.finalStateRootHash,
          submissionData.firstBlockInData,
          submissionData.finalBlockInData,
          submissionData.snarkHash,
        ],
        submissionDataJson.expectedY,
        commitments[0],
        submissionDataJson.kzgProofContract,
      ],
    ),
  ]);

  return encodedCall;
}

async function submitBlob(
  provider: ethers.JsonRpcProvider,
  wallet: Wallet,
  encodedCall: string,
  destinationAddress: string,
  versionedHashes: string[],
  fullblob: Uint8Array,
) {
  const { maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData();
  const nonce = await provider.getTransactionCount(wallet.address);

  console.log("nonce", nonce);
  const transaction = Transaction.from({
    data: encodedCall,
    maxPriorityFeePerGas: maxPriorityFeePerGas!,
    maxFeePerGas: maxFeePerGas!,
    to: destinationAddress,
    chainId: 31648428,
    type: 3,
    nonce,
    value: 0,
    kzg,
    blobs: [fullblob],
    gasLimit: 5_000_000,
    blobVersionedHashes: versionedHashes,
    maxFeePerBlobGas: maxFeePerGas!,
  });

  const tx = await wallet.sendTransaction(transaction);
  const receipt = await tx.wait();
  console.log({ transaction: tx, receipt });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendProof(proofFile: any) {
  console.log("proof");

  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY");
  const destinationAddress = requireEnv("DESTINATION_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const encodedCall = ethers.concat([
    "0xd630280f",
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "bytes",
        "uint256",
        "tuple(bytes32,bytes32[],bytes32,uint256,uint256,uint256,bytes32,uint256,bytes32[],uint256,bytes)",
      ],
      [
        proofFile.aggregatedProof,
        0,
        [
          proofFile.parentStateRootHash,
          proofFile.dataHashes,
          proofFile.dataParentHash,
          proofFile.finalBlockNumber,
          proofFile.parentAggregationLastBlockTimestamp,
          proofFile.finalTimestamp,
          proofFile.l1RollingHash,
          proofFile.l1RollingHashMessageNumber,
          proofFile.l2MerkleRoots,
          proofFile.l2MerkleTreesDepth,
          proofFile.l2MessagingBlocksOffsets,
        ],
      ],
    ),
  ]);

  const { maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData();
  const nonce = await provider.getTransactionCount(wallet.address);

  const transaction = Transaction.from({
    data: encodedCall,
    maxPriorityFeePerGas: maxPriorityFeePerGas!,
    maxFeePerGas: maxFeePerGas!,
    to: destinationAddress,
    chainId: 31648428,
    nonce,
    value: 0,
    gasLimit: 5_000_000,
  });

  const tx = await wallet.sendTransaction(transaction);
  const receipt = await tx.wait();
  console.log({ transaction: tx, receipt });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function submitCalldata(calldata: any) {
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY");
  const destinationAddress = requireEnv("DESTINATION_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const encodedCall = ethers.concat([
    "0x7a776315",
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bytes32,bytes32,bytes32,uint256,uint256,bytes32,bytes)"],
      [
        [
          calldata.parentStateRootHash,
          calldata.dataParentHash,
          calldata.finalStateRootHash,
          calldata.firstBlockInData,
          calldata.finalBlockInData,
          calldata.snarkHash,
          calldata.compressedData,
        ],
      ],
    ),
  ]);

  const { maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData();
  const nonce = await provider.getTransactionCount(wallet.address);

  const transaction = Transaction.from({
    data: encodedCall,
    maxPriorityFeePerGas: maxPriorityFeePerGas!,
    maxFeePerGas: maxFeePerGas!,
    to: destinationAddress,
    chainId: 31648428,
    nonce,
    value: 0,
    gasLimit: 5_000_000,
  });

  const tx = await wallet.sendTransaction(transaction);
  const receipt = await tx.wait();
  console.log({ transaction: tx, receipt });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
