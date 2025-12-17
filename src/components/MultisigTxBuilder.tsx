import init, {
    Digest,
    SpendCondition,
    LockPrimitive,
    Pkh,
    GrpcClient,
    TxBuilder,
    Note,
    deriveMasterKeyFromMnemonic,
} from "@nockbox/iris-wasm";
import { useEffect, useState } from "react";
import { useNockchain } from "../hooks/useNockchain";
/*
{
  name: { first: "...", last: "..." },
  note: {
    noteVersion: {
      v1: {
        originPage: { value: "..." },
        noteData: { hash: "..." },
        assets: { value: 1234567 }  // ← nicks amount here
      }
    }
  }
}
*/
interface BalanceData {
    notes: BalanceEntry[];
    length: number;
    block_id: string;
    height: any;
    page: {
        next_page_token: string;
    }
}

interface BalanceEntry {
    name: { first: string, last: string };
    note: {
        noteVersion: {
            v1: {
                originPage: { value: string };
                noteData: { hash: string };
                assets: { value: number };
            }
        }
    }
}
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
    const [balance, setBalance] = useState<number | null>(null);
    const [amount, setAmount] = useState<number>(0);
    const [recipient, setRecipient] = useState<string>('');
    const [fee, setFee] = useState<number | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [sigsCount, setSigsCount] = useState<number>(0);
    const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
    const [showSigningModal, setShowSigningModal] = useState(false);
    const [mnemonics, setMnemonics] = useState<string[]>([]);
    const [txStatus, setTxStatus] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const count = requiredPubkeys.filter(pk => pk).length;
        setSigsCount(count);
        // Initialize mnemonics array to match pubkey count
        setMnemonics(prev => {
            if (prev.length < count) {
                return [...prev, ...Array(count - prev.length).fill('')];
            }
            return prev.slice(0, count);
        });
    }, [requiredPubkeys]);

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
            console.log('Fetching balance for:', { grpcEndpoint, pkh, isReady });
            const client = new GrpcClient(grpcEndpoint);

            // pkh from wallet is actually the "first name" (spend condition hash)
            client.getBalanceByFirstName(pkh).then((balanceData) => {
                console.log('Balance:', balanceData);
                setBalanceData(balanceData);
                if (balanceData.notes.length > 0) {
                    setBalance(balanceData.notes.reduce((sum: bigint, entry: BalanceEntry) => sum + BigInt(entry.note.noteVersion.v1.assets.value), BigInt(0)))
                } else {
                    setBalance(0);
                }
            }).catch(error => {
                console.error("Failed to get balance:", {
                    message: error?.message,
                    name: error?.name,
                    stack: error?.stack,
                    fullError: error,
                });
            });
        }
    }, [grpcEndpoint, pkh, isReady])

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
        if (!validateTransaction()) {
            return;
        }
        // Open the signing modal to collect mnemonics
        setShowSigningModal(true);
    }

    const buildTransaction = (): TxBuilder | null => {
        console.log('buildTransaction', spendCondition);

        if (!validateTransaction()) {
            return null;
        }

        // Convert balance notes to Note objects
        const notes = balanceData?.notes.map((entry: BalanceEntry) =>
            Note.fromProtobuf(entry.note)
        ) || [];

        if (notes.length === 0) {
            setErrors(['No notes available to spend']);
            return null;
        }

        const builder = new TxBuilder(BigInt(fee || false));
        builder.simpleSpend(
            notes,
            [spendCondition!],
            new Digest(recipient),
            BigInt(amount),
            null, // let it calculate fee
            new Digest(pkh!),
            true, // include lock data
        );

        return builder;
    }

    const signAndSubmit = async () => {
        if (!grpcEndpoint) {
            setErrors(['No gRPC endpoint available']);
            return;
        }

        // Validate all mnemonics are provided
        const emptyMnemonics = mnemonics.filter(m => !m.trim());
        if (emptyMnemonics.length > 0) {
            setErrors([`Please provide all ${sigsCount} mnemonics`]);
            return;
        }

        setIsSubmitting(true);
        setTxStatus('Building transaction...');
        setErrors([]);

        try {
            const builder = buildTransaction();
            if (!builder) {
                setIsSubmitting(false);
                return;
            }

            // Sign with each mnemonic
            setTxStatus(`Signing with ${sigsCount} keys...`);
            for (let i = 0; i < mnemonics.length; i++) {
                const mnemonic = mnemonics[i].trim();
                setTxStatus(`Deriving key ${i + 1}/${sigsCount}...`);

                const masterKey = deriveMasterKeyFromMnemonic(mnemonic, "");
                const privateKey = masterKey.privateKey;

                if (!privateKey) {
                    throw new Error(`Failed to derive private key from mnemonic ${i + 1}`);
                }

                setTxStatus(`Signing with key ${i + 1}/${sigsCount}...`);
                builder.sign(privateKey);
            }

            // Validate the transaction
            setTxStatus('Validating transaction...');
            builder.validate();

            // Build the final transaction
            setTxStatus('Building final transaction...');
            const nockchainTx = builder.build();
            const rawTx = nockchainTx.toRawTx();
            const protobuf = rawTx.toProtobuf();

            // Submit via gRPC
            setTxStatus('Submitting to network...');
            const client = new GrpcClient(grpcEndpoint);
            const result = await client.sendTransaction(protobuf);

            console.log('Transaction submitted:', result);
            setTxStatus(`✅ Transaction submitted! ID: ${nockchainTx.id.value}`);
            setShowSigningModal(false);

            // Clear mnemonics for security
            setMnemonics(Array(sigsCount).fill(''));

        } catch (error: any) {
            console.error('Transaction failed:', error);
            setErrors([`Transaction failed: ${error?.message || error}`]);
            setTxStatus(null);
        } finally {
            setIsSubmitting(false);
        }
    }

    const validateTransaction = () => {
        const theseErrors = [];
        if (!spendCondition) {
            theseErrors.push('No spend condition - add pubkeys first');
        }
        if (!recipient) {
            theseErrors.push('No recipient address');
        }
        if (amount <= 0) {
            theseErrors.push('Amount must be greater than 0');
        }
        if (!balanceData || balanceData.notes.length === 0) {
            theseErrors.push('No notes available to spend');
        }
        setErrors(theseErrors);
        return theseErrors.length === 0;
    }

    return (
        <div className="rounded-lg bg-iris-light-yellow p-4 flex flex-col items-stretch gap-2 self-stretch mx-4 p-4">
            <h2 className="text-center">Multisig Tx Builder</h2>
            <span className="text-center text-sm text-iris-black">Balance: {((balance || 0) / 65535).toFixed(6)} NOCK</span>
            <div className="flex flex-col items-stretch self-stretch gap-2">
                {requiredPubkeys.map((pk, i) => (
                    <div
                        key={i}
                        className="flex flex-col items-stretch gap-1"
                    >
                        <span className="text-sm text-iris-black">
                            Pubkey {i + 1}
                        </span>
                        <div className="flex gap-1">
                            <input
                                type="text"
                                defaultValue={pk}
                                onChange={(e) => setRequiredPubkeys(prev => [...prev.slice(0, i), e.target.value, ...prev.slice(i + 1)])}
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
                <span>Recipient</span>
                <input
                    type="text"
                    defaultValue={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Recipient address"
                    className="grow bg-iris-white rounded px-1"
                />
            </div>
            <div className=" flex flex-col text-sm text-iris-black">
                <span>Amount</span>
                <input
                    type="number"
                    defaultValue={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="Amount (in NOCK)"
                    className="grow bg-iris-white rounded px-1 text-right"
                />
            </div>
            <div className=" flex flex-col text-sm text-iris-black">
                <span>Fee</span>
                <input
                    type="number"
                    defaultValue={''}
                    onChange={(e) => setFee(Number(e.target.value))}
                    placeholder="Fee amount (in NOCK)"
                    className="grow bg-iris-white rounded px-1 text-right"
                />
            </div>
            <div className="flex flex-col text-sm text-iris-black gap-2">
                {sigsCount > 0 && <span className="text-center">({sigsCount} signatures required)</span>}
                {txStatus && (
                    <div className="text-blue-600 text-sm text-center p-2 bg-blue-50 rounded">
                        {txStatus}
                    </div>
                )}
                {errors.map((error, i) => (
                    <div key={i} className="text-red-500 text-sm text-center">
                        {error}
                    </div>
                ))}
                <button
                    className="bg-iris-yellow text-iris-black px-4 py-2 rounded-md font-medium disabled:opacity-50"
                    onClick={() => submitTransaction()}
                    disabled={!spendCondition || isSubmitting}
                >
                    {isSubmitting ? 'Processing...' : 'Build & Sign Transaction'}
                </button>
            </div>

            {/* Signing Modal */}
            {showSigningModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-iris-light-yellow rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-2 text-center">🔐 Sign Transaction</h3>
                        <p className="text-sm text-iris-black/70 mb-4 text-center">
                            Enter the mnemonic phrase for each required signer.
                            <br />
                            <span className="text-red-500 text-xs">
                                ⚠️ Demo only! Never paste real mnemonics in production.
                            </span>
                        </p>

                        <div className="flex flex-col gap-4">
                            {requiredPubkeys.filter(pk => pk).map((pk, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">
                                        Signer {i + 1}
                                        <span className="text-xs text-iris-black/50 ml-2">
                                            (PKH: {pk.slice(0, 8)}...)
                                        </span>
                                    </label>
                                    <textarea
                                        value={mnemonics[i] || ''}
                                        onChange={(e) => setMnemonics(prev => [
                                            ...prev.slice(0, i),
                                            e.target.value,
                                            ...prev.slice(i + 1)
                                        ])}
                                        placeholder="word1 word2 word3 ... word12 or word24"
                                        className="bg-iris-white rounded px-2 py-1 text-sm h-16 resize-none font-mono"
                                    />
                                </div>
                            ))}
                        </div>

                        {errors.length > 0 && (
                            <div className="mt-4 p-2 bg-red-50 rounded">
                                {errors.map((error, i) => (
                                    <div key={i} className="text-red-500 text-sm">
                                        {error}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 mt-6">
                            <button
                                className="flex-1 bg-gray-200 text-iris-black px-4 py-2 rounded-md"
                                onClick={() => {
                                    setShowSigningModal(false);
                                    setMnemonics(Array(sigsCount).fill(''));
                                    setErrors([]);
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 bg-iris-yellow text-iris-black px-4 py-2 rounded-md font-medium disabled:opacity-50"
                                onClick={() => signAndSubmit()}
                                disabled={isSubmitting || mnemonics.some(m => !m.trim())}
                            >
                                {isSubmitting ? 'Signing...' : 'Sign & Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}