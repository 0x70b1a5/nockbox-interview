import init, {
    Digest,
 SpendCondition,
    LockPrimitive,
    Pkh,
    GrpcClient,
} from "@nockbox/iris-wasm";
import { useEffect, useState } from "react";
import { useNockchain } from "../hooks/useNockchain";

export function MultisigTxBuilder() {
/*

// Initialize the WASM module
await init();

// Create a client pointing to your Envoy proxy
const client = new GrpcClient('http://localhost:8080');

// Get balance by wallet address
const balance = await client.get_balance_by_address(
  '6psXufjYNRxffRx72w8FF9b5MYg8TEmWq2nEFkqYm51yfqsnkJu8XqX'
);
console.log('Balance:', balance);

// Get balance by first name (note hash)
const balanceByName = await client.get_balance_by_first_name(
  '2H7WHTE9dFXiGgx4J432DsCLuMovNkokfcnCGRg7utWGM9h13PgQvsH'
);
console.log('Balance by name:', balanceByName);

// ============================================================================
// Building and signing transactions
// ============================================================================

// Derive keys from mnemonic
const mnemonic = "dice domain inspire horse time...";
const masterKey = deriveMasterKeyFromMnemonic(mnemonic, "");

// Create notes from balance query
const notes = balance.notes.map(entry => new WasmNote(
  WasmVersion.V1(),
  entry.note.noteVersion.v1.originPage.value,
  new WasmName(entry.name.first, entry.name.last),
  new WasmDigest(entry.note.noteVersion.v1.noteData.hash),
  entry.note.noteVersion.v1.assets.value
));

// Create spend condition
const pubkeyHash = new WasmDigest("your_pubkey_hash_here");
const spendCondition = new WasmSpendCondition([
  WasmLockPrimitive.newPkh(WasmPkh.single(pubkeyHash)),
  WasmLockPrimitive.newTim(WasmLockTim.coinbase())
]);

// Build transaction
const builder = WasmTxBuilder.newSimple(
  notes,
  spendCondition,
  new WasmDigest("recipient_address"),
  1234567, // gift
  2850816, // fee
  new WasmDigest("refund_address")
);

// Sign and submit
const signedTx = builder.sign(masterKey.private_key);
const txProtobuf = signedTx.toProtobuf();
await client.send_transaction(txProtobuf);

// Check if a transaction was accepted
const accepted = await client.transaction_accepted(signedTx.id.value);
console.log('Transaction accepted:', accepted);

*/
    const { nockchain, pkh, grpcEndpoint } = useNockchain();
    const [isReady, setIsReady] = useState(false);
    const [requiredPubkeys, setRequiredPubkeys] = useState<string[]>(['']);
    const [spendCondition, setSpendCondition] = useState<SpendCondition | null>(null);

    const createSpendCondition = () => {
        try {
            const digests = requiredPubkeys.filter(pk => pk).map(pk => new Digest(pk));
            console.log({ digests })
            const singles = digests.map(digest => Pkh.single(digest.value));
            console.log({ singles })
            const lockPrimitives = singles.map(single => LockPrimitive.newPkh(single));
            console.log({ lockPrimitives })
            const spendCondition = new SpendCondition(lockPrimitives);
            console.log({ spendCondition })
            return spendCondition;
        } catch (error) {
            console.error("Failed to create digests", error);
            return null;
        }
    }

    useEffect(() => {
        init().then(() => {
            setIsReady(true)
        }).catch(error => {
            console.error("Failed to initialize", error);
        });
    }, []);

    useEffect(() => {
        if (grpcEndpoint && pkh && isReady) {
            console.log({ grpcEndpoint, pkh, isReady });
            // Create a client pointing to your Envoy proxy
            const client = new GrpcClient(grpcEndpoint!);

            // Get balance by wallet address
            client.getBalanceByAddress(pkh!).then(balance => {
                console.log('Balance:', balance);
            }).catch(error => {
                console.error("Failed to get balance", error);
            });
        }
    }, [grpcEndpoint, pkh])

    useEffect(() => {
        if (requiredPubkeys.length < 1) {
            setRequiredPubkeys(['']);
        }
    }, [requiredPubkeys]);

    useEffect(() => {
        if (isReady && requiredPubkeys.length > 0 && requiredPubkeys.every(pk => pk)) {
            setSpendCondition(createSpendCondition());
        } else {
            setSpendCondition(null);
        }
    }, [requiredPubkeys, isReady]);

    const submitTransaction = () => {
        const transaction = buildTransaction();
        console.log('submitTransaction', transaction);
    }

    const buildTransaction = () => {
        console.log('buildTransaction', spendCondition);
        return null;
    }

    return (
        <div className="rounded-lg bg-iris-light-yellow p-4 flex flex-col items-stretch gap-2 self-stretch mx-4 p-4">
            <h2>Multisig Tx Builder</h2>
            <div className="flex flex-col items-stretch self-stretch gap-2">
                {requiredPubkeys.map((pk, i) => (
                    <div
                        key={i}
                        className="flex flex-col items-stretch gap-1"
                    >
                        <span className="text-sm text-iris-black">
                            Required Pubkey {i + 1}
                        </span>
                        <div className="flex gap-1">
                            <input
                                type="text"
                                defaultValue={pk}
                                onBlur={(e) => setRequiredPubkeys(prev => [...prev.slice(0, i), e.target.value, ...prev.slice(i + 1)])}
                                placeholder="ABCDEF1234567890..."
                                className="grow bg-iris-white rounded px-1"
                            />
                            <button
                                className="bg-iris-yellow text-iris-black px-2 py-1 rounded-md"
                                onClick={() => setRequiredPubkeys(prev => prev.filter((_, j) => j !== i))}
                            >
                                x
                            </button>
                        </div>
                    </div>
                ))}
                <button
                    className="bg-iris-yellow text-iris-black px-2 py-1 rounded-md"
                    onClick={() => setRequiredPubkeys(prev => [...prev, ''])}
                >
                    Add Pubkey
                </button>
            </div>
            <div className=" flex flex-col text-sm text-iris-black">
                <span>Spend Condition ({requiredPubkeys.filter(pk => pk).length} signatures required)</span>
                <code className="text-sm p-1 bg-iris-white rounded whitespace-pre-wrap">
                    {spendCondition ? JSON.stringify(spendCondition) : 'No spend condition'}
                </code>
                <button
                    className="bg-iris-yellow text-iris-black px-2 py-1 rounded-md"
                    onClick={() => submitTransaction()}
                    disabled={!spendCondition}
                >
                    Submit
                </button>
            </div>
        </div>
    );
}