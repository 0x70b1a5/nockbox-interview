import init, {
    Digest,
    SpendCondition,
    LockPrimitive,
    LockTim,
    Pkh,
    GrpcClient,
    TxBuilder,
    Note,
    deriveMasterKeyFromMnemonic,
} from "@nockbox/iris-wasm";
import { useEffect, useState } from "react";
import { useNockchain } from "../hooks/useNockchain";
import { trimAddress } from "../utils/truncate";
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
        note_version: {
            V1: {
                version: { value: string };
                origin_page: { value: string };
                name: { first: string, last: string };
                note_data: { entries: any[] };
                assets: { value: string };
            }
        }
    }
}
export function MultisigTxBuilder() {
    const { pkh, grpcEndpoint } = useNockchain();
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
    const [pendingTxs, setPendingTxs] = useState<{ id: string; status: 'pending' | 'confirmed' | 'failed'; submittedAt: Date }[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const count = requiredPubkeys.filter(pk => pk).length;
        setSigsCount(count);
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

            try {
                const digest = new Digest(pkh);
                
                const pkhSingle1 = Pkh.single(digest.value);
                const pkhLock1 = LockPrimitive.newPkh(pkhSingle1);
                const coinbaseLock = LockPrimitive.newTim(LockTim.coinbase());
                const coinbaseSpendCondition = new SpendCondition([pkhLock1, coinbaseLock]);
                
                const pkhSingle2 = Pkh.single(new Digest(pkh).value);
                const pkhLock2 = LockPrimitive.newPkh(pkhSingle2);
                const simpleSpendCondition = new SpendCondition([pkhLock2]);
                
                const coinbaseFirstName = coinbaseSpendCondition.firstName().value;
                const simpleFirstName = simpleSpendCondition.firstName().value;
                
                console.log('Coinbase SpendCondition firstName:', coinbaseFirstName);
                console.log('Simple SpendCondition firstName:', simpleFirstName);
                
                const firstName = coinbaseFirstName;
                const hashValue = coinbaseSpendCondition.hash().value;
                
                console.log('SpendCondition firstName:', firstName);
                console.log('SpendCondition hash value:', hashValue);
                
                const queryName = firstName || hashValue;
                console.log('Querying balance with:', queryName);
                
                if (queryName) {
                    client.getBalanceByFirstName(queryName).then((balanceData) => {
                        console.log('Balance result:', balanceData);
                        setBalanceData(balanceData);
                        if (balanceData.notes.length > 0) {
                            const total = balanceData.notes.reduce((sum: bigint, entry: any) => {
                                const value = entry.note?.note_version?.V1?.assets?.value ?? 0;
                                return BigInt(sum) + BigInt(value);
                            }, BigInt(0));
                            console.log('Total balance (raw):', total.toString());
                            setBalance(total);
                        } else {
                            setBalance(0);
                        }
                    }).catch(error => {
                        console.error("Failed to get balance:", String(error));
                    });
                }
            } catch (error) {
                console.error("Failed to create spend condition for balance query:", error);
            }
        }
    }, [grpcEndpoint, pkh, isReady, refreshTrigger])

    useEffect(() => {
        if (!grpcEndpoint || pendingTxs.length === 0) return;
        
        const pendingIds = pendingTxs.filter(tx => tx.status === 'pending');
        if (pendingIds.length === 0) return;

        const pollInterval = setInterval(async () => {
            const client = new GrpcClient(grpcEndpoint);
            
            for (const tx of pendingIds) {
                try {
                    const accepted = await client.transactionAccepted(tx.id);
                    console.log(`Tx ${tx.id} accepted:`, accepted);
                    
                    if (accepted) {
                        setPendingTxs(prev => prev.map(t => 
                            t.id === tx.id ? { ...t, status: 'confirmed' as const } : t
                        ));
                        // Refresh balance when tx is confirmed
                        setRefreshTrigger(prev => prev + 1);
                    }
                } catch (error) {
                    console.error(`Failed to check tx ${tx.id}:`, error);
                }
            }
        }, 3000); 

        return () => clearInterval(pollInterval);
    }, [grpcEndpoint, pendingTxs])

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
        setShowSigningModal(true);
    }

    const buildTransaction = (): TxBuilder | null => {
        console.log('buildTransaction', spendCondition);

        if (!validateTransaction()) {
            return null;
        }

        const notes = balanceData?.notes.map((entry: BalanceEntry) =>
            Note.fromProtobuf(entry.note)
        ) || [];

        if (notes.length === 0) {
            setErrors(['No notes available to spend']);
            return null;
        }

        const spendConditions = notes.map(() => {
            const digest = new Digest(pkh!);
            const pkhSingle = Pkh.single(digest.value);
            const pkhLock = LockPrimitive.newPkh(pkhSingle);
            const coinbaseLock = LockPrimitive.newTim(LockTim.coinbase());
            return new SpendCondition([pkhLock, coinbaseLock]);
        });

        console.log(`Building tx with ${notes.length} notes and ${spendConditions.length} spend conditions`);

        const builder = new TxBuilder(BigInt(fee || 0));
        builder.simpleSpend(
            notes,
            spendConditions,
            new Digest(recipient),
            BigInt(amount),
            null, 
            new Digest(pkh!),
            true, 
        );

        return builder;
    }

    const signAndSubmit = async () => {
        if (!grpcEndpoint) {
            setErrors(['No gRPC endpoint available']);
            return;
        }

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

            setTxStatus('Validating transaction...');
            builder.validate();

            setTxStatus('Building final transaction...');
            const nockchainTx = builder.build();
            const rawTx = nockchainTx.toRawTx();
            const protobuf = rawTx.toProtobuf();

            setTxStatus('Submitting to network...');
            const client = new GrpcClient(grpcEndpoint);
            const result = await client.sendTransaction(protobuf);

            console.log('Transaction submitted:', result);
            const txId = nockchainTx.id.value;
            setTxStatus(`✅ Transaction submitted!`);
            setShowSigningModal(false);

            // Add to pending transactions
            setPendingTxs(prev => [...prev, { id: txId, status: 'pending', submittedAt: new Date() }]);

            // Reset form
            setMnemonics(Array(sigsCount).fill(''));
            setRecipient('');
            setAmount(0);
            setFee(null);

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
            <h2 className="text-center wrap-anywhere">Multisig Tx Builder (RPC: {grpcEndpoint})</h2>
            {pkh && <h2 className="px-2 py-1 bg-iris-yellow wrap-anywhere text-center">{pkh}</h2>}
            <h1 className="text-center text-3xl text-iris-black">{(BigInt(balance || 0) / BigInt(65535))} NOCK</h1>
            <span className="text-center text-sm text-iris-black">({BigInt(balance || 0)} nick)</span>
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
                    defaultValue={''}
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

            {/* Pending Transactions */}
            {pendingTxs.length > 0 && (
                <div className="mt-4 p-3 bg-iris-white rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Recent Transactions</h3>
                    <div className="flex flex-col gap-2">
                        {pendingTxs.slice().reverse().map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                <span className="font-mono truncate max-w-[200px]" title={tx.id}>
                                    {trimAddress(tx.id, 8, 6)}
                                </span>
                                <span className={`px-2 py-0.5 rounded ${
                                    tx.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                    tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {tx.status === 'pending' ? '⏳ Pending' : 
                                     tx.status === 'confirmed' ? '✅ Confirmed' : '❌ Failed'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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