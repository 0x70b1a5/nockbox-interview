import { NockchainProvider as NockchainSDK } from "@nockbox/iris-sdk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface NockchainState {
    nockchain: NockchainSDK | null;
    pkh: string | null;
    grpcEndpoint: string | null;
    errors: Record<string, string>;
    deleteError: (index: number) => void;
    addError: (error: string) => void;
}

const NockchainContext = createContext<NockchainState | null>(null);

let cachedProvider: NockchainSDK | null = null;
let cachedConnectionResult: { pkh?: string; grpcEndpoint?: string } | null = null;

export function NockchainProvider({ children }: { children: ReactNode }) {
    const [nockchain, setNockchain] = useState<NockchainSDK | null>(cachedProvider);
    const [pkh, setPkh] = useState<string | null>(cachedConnectionResult?.pkh ?? null);
    const [grpcEndpoint, setGrpcEndpoint] = useState<string | null>(cachedConnectionResult?.grpcEndpoint ?? null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const deleteError = (index: number) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[Object.keys(newErrors)[index] as keyof typeof newErrors];
            return newErrors;
        });
    };

    const addError = (error: string) => {
        setErrors(prev => ({ ...prev, [Date.now()]: error }));
    };

    useEffect(() => {
        if (cachedProvider?.isConnected) {
            setNockchain(cachedProvider);
            return;
        }

        const init = async () => {
            const provider = cachedProvider ?? new NockchainSDK();
            try {
                const result = await provider.connect();
                console.log("Connected to Nockchain", result);

                cachedProvider = provider;
                cachedConnectionResult = result;

                setNockchain(provider);
                if (!result.pkh || !result.grpcEndpoint) {
                    setErrors(prev => ({ ...prev, [Date.now()]: "Failed to connect to Nockchain" }));
                }
                if (result.pkh) {
                    setPkh(result.pkh);
                }
                if (result.grpcEndpoint) {
                    setGrpcEndpoint(result.grpcEndpoint);
                }
            } catch (error) {
                console.error("Failed to connect to Nockchain", error);
                setErrors(prev => ({ ...prev, [Date.now()]: String(error) }));
            }
        };
        init();
    }, []);

    return (
        <NockchainContext.Provider value={{ nockchain, pkh, grpcEndpoint, errors, deleteError, addError }}>
            {children}
        </NockchainContext.Provider>
    );
}

export function useNockchain(): NockchainState {
    const ctx = useContext(NockchainContext);
    if (!ctx) {
        throw new Error("useNockchain must be used within a NockchainProvider");
    }
    return ctx;
}
