import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';

const CONTRACT_ID = "CAZ5LVB7HDR4TXR4NBS4ISWDMH44NTYR6PXREJVPXDGXBAHBQZBMIGBK";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Helper to convert stroops to XLM
export const stroopsToXlm = (stroops) => {
  return (Number(stroops) / 10000000).toFixed(2);
};

/**
 * Connect to Freighter wallet (v6 API).
 * isConnected() returns { isConnected: bool }, not a raw boolean.
 * requestAccess() is the recommended way to get the public key.
 */
export async function connectWallet() {
  try {
    const connectionResult = await isConnected();

    if (!connectionResult.isConnected) {
      alert("Please install Freighter wallet extension!\nhttps://freighter.app");
      return null;
    }

    // requestAccess() prompts user to authorize dApp + returns public key
    const accessResult = await requestAccess();

    if (accessResult.error) {
      console.error("Freighter access denied:", accessResult.error);
      alert("Wallet connection was denied. Please approve the request in Freighter.");
      return null;
    }

    console.log("Connected:", accessResult.address);
    return accessResult.address;
  } catch (err) {
    console.error("Wallet connection error:", err);
    alert("Failed to connect wallet. Make sure Freighter is installed and on Testnet.");
    return null;
  }
}

/**
 * Read project details from the contract (simulation only, no signature needed).
 */
export async function getProjectDetails(projectId) {
  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
    )
      .addOperation(contract.call("project", StellarSdk.xdr.ScVal.scvU32(projectId)))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);

    if (result.error) {
      console.error("Simulation error:", result.error);
      return null;
    }

    if (result.result && result.result.retval) {
      const decoded = StellarSdk.scValToNative(result.result.retval);
      return decoded;
    }
    return null;
  } catch (err) {
    console.error("Failed to get project details:", err);
    return null;
  }
}

/**
 * Buy shares in a solar project. Requires Freighter signature.
 */
export async function buyShares(projectId, numShares) {
  const address = await connectWallet();
  if (!address) return;

  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const account = await server.getAccount(address);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const args = [
      new StellarSdk.Address(address).toScVal(),
      StellarSdk.xdr.ScVal.scvU32(projectId),
      StellarSdk.xdr.ScVal.scvU32(numShares),
    ];

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("buy", ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);

    const signResult = await signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (signResult.error) {
      throw new Error(signResult.error);
    }

    const signed = StellarSdk.TransactionBuilder.fromXDR(
      signResult.signedTxXdr,
      NETWORK_PASSPHRASE
    );
    const sendResult = await server.sendTransaction(signed);

    // Wait for confirmation
    if (sendResult.status === "PENDING") {
      let txResult;
      do {
        await new Promise((r) => setTimeout(r, 1000));
        txResult = await server.getTransaction(sendResult.hash);
      } while (txResult.status === "NOT_FOUND");
      return txResult;
    }

    return sendResult;
  } catch (err) {
    console.error("Transaction failed:", err);
    throw err;
  }
}

/**
 * Claim accumulated yield from a solar project.
 */
export async function claimYield(projectId) {
  const address = await connectWallet();
  if (!address) return;

  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const account = await server.getAccount(address);
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    const args = [
      new StellarSdk.Address(address).toScVal(),
      StellarSdk.xdr.ScVal.scvU32(projectId),
    ];

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("claim", ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);

    const signResult = await signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (signResult.error) {
      throw new Error(signResult.error);
    }

    const signed = StellarSdk.TransactionBuilder.fromXDR(
      signResult.signedTxXdr,
      NETWORK_PASSPHRASE
    );
    const sendResult = await server.sendTransaction(signed);

    // Wait for confirmation
    if (sendResult.status === "PENDING") {
      let txResult;
      do {
        await new Promise((r) => setTimeout(r, 1000));
        txResult = await server.getTransaction(sendResult.hash);
      } while (txResult.status === "NOT_FOUND");
      return txResult;
    }

    return sendResult;
  } catch (err) {
    console.error("Claim failed:", err);
    throw err;
  }
}
