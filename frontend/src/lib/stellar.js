import * as StellarSdk from '@stellar/stellar-sdk';
import { isConnected, getAddress, signTransaction } from '@stellar/freighter-api';

const CONTRACT_ID = "CDAQZDIIWIRIJ26PK7PRDOGBSDI2RFEEPI5BTFEPR3KYITRR44YOUI7E";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Helper to convert stroops to XLM
export const stroopsToXlm = (stroops) => {
  return (Number(stroops) / 10000000).toFixed(2);
};

export async function connectWallet() {
  if (!(await isConnected())) {
    alert("Please install Freighter wallet extension!");
    return null;
  }
  const { address } = await getAddress();
  return address;
}

export async function getProjectDetails(projectId) {
  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    
    // We construct the xdr args. project_id is u32
    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
    )
      .addOperation(contract.call("get_project", StellarSdk.xdr.ScVal.scvU32(projectId)))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    const result = await server.simulateTransaction(prepared);
    
    if (result.error) {
       console.error("Simulation error:", result.error);
       return null;
    }

    if (result.result && result.result.retval) {
       // Since the return type is a struct (SolarProject), it returns as a map or vec depending on the SDK mapping
       // In newer soroban-sdk, struct fields are stored as a Map or Vec.
       // For simplicity, we decode it.
       const decoded = StellarSdk.scValToNative(result.result.retval);
       return decoded;
    }
    return null;
  } catch (err) {
    console.error("Failed to get project details:", err);
    return null;
  }
}

export async function buyShares(projectId, numShares) {
  const address = await connectWallet();
  if (!address) return;

  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const account = await server.getAccount(address);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const args = [
      new StellarSdk.Address(address).toScVal(), // investor
      StellarSdk.xdr.ScVal.scvU32(projectId),    // project_id
      StellarSdk.xdr.ScVal.scvU32(numShares)     // num_shares
    ];

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("buy_shares", ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    
    const signed = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await server.sendTransaction(signed);
    return result;
  } catch (err) {
    console.error("Transaction failed:", err);
    throw err;
  }
}

export async function claimYield(projectId) {
  const address = await connectWallet();
  if (!address) return;

  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const account = await server.getAccount(address);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const args = [
      new StellarSdk.Address(address).toScVal(), // investor
      StellarSdk.xdr.ScVal.scvU32(projectId),    // project_id
    ];

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("claim_yield", ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    
    const signed = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await server.sendTransaction(signed);
    return result;
  } catch (err) {
    console.error("Claim failed:", err);
    throw err;
  }
}
